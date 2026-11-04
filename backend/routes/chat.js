const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ChatGroup = require('../models/ChatGroup');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const ChatReadState = require('../models/ChatReadState');
const { sendPushNotifications } = require('../utils/push');

// Unread counting starts when the feature shipped, so old history does not
// show up as hundreds of unread messages for everyone.
const UNREAD_COUNTING_SINCE = new Date('2026-11-04T14:00:00Z');

/**
 * Helper to determine a user's permissions on a specific group
 * Returns: { can_view: boolean, can_send: boolean, is_member: boolean, is_view_only: boolean, is_admin: boolean }
 */
const getGroupPermissions = (group, user) => {
  const isAdmin = user.role === 'Admin' || user.role === 'SubAdmin' || user.role === 'SuperAdmin';
  if (isAdmin) {
    return { can_view: true, can_send: true, is_member: true, is_view_only: false, is_admin: true };
  }

  // Active chat participant in this group
  const isChatMember = (group.members || []).some(
    (mId) => (mId._id || mId).toString() === user._id.toString()
  );

  // Specifically granted VIEW-ONLY access to this group by Admin
  const isViewOnlyMember = (group.view_only_members || []).some(
    (vId) => (vId._id || vId).toString() === user._id.toString()
  );

  if (user.role === 'Member') {
    if (isChatMember) {
      // Can view and can chat in own group
      return { can_view: true, can_send: true, is_member: true, is_view_only: false, is_admin: false };
    }
    // If specifically added to view_only_members by Admin OR group allows all other members
    if (isViewOnlyMember || group.can_other_members_view) {
      return { can_view: true, can_send: false, is_member: false, is_view_only: true, is_admin: false };
    }
    return { can_view: false, can_send: false, is_member: false, is_view_only: false, is_admin: false };
  }

  if (user.role === 'Resident') {
    if (isChatMember) {
      return { can_view: true, can_send: true, is_member: true, is_view_only: false, is_admin: false };
    }
    if (isViewOnlyMember || group.can_residents_view) {
      return { can_view: true, can_send: false, is_member: false, is_view_only: true, is_admin: false };
    }
    return { can_view: false, can_send: false, is_member: false, is_view_only: false, is_admin: false };
  }

  return { can_view: false, can_send: false, is_member: false, is_view_only: false, is_admin: false };
};

// Recompute a group's cached last_message from its newest message, so the chat
// list never keeps showing text that was edited or deleted.
const refreshGroupLastMessage = async (groupId, io) => {
  const latest = await ChatMessage.findOne({ group_id: groupId }).sort({ createdAt: -1, _id: -1 }).lean();
  const last_message = latest
    ? {
        text: latest.is_deleted ? 'This message was deleted' : (latest.text || 'Sent an attachment'),
        sender_id: latest.sender,
        sender_name: latest.sender_name,
        sender_role: latest.sender_role,
        timestamp: latest.createdAt,
      }
    : { text: '', sender_name: '', sender_role: '' };
  await ChatGroup.updateOne({ _id: groupId }, { $set: { last_message } });
  if (io) io.emit('chat_group_last_message', { group_id: groupId, last_message });
};

// Who gets a push for a new message: chat members (can reply) and users given
// view access by name, plus every committee member when the group is open to
// all members. Residents who can only browse a resident-visible group are not
// pinged for every message. The sender is never notified.
const notifyGroupMessage = async (group, msg, sender) => {
  const memberIds = (group.members || []).map((id) => id.toString());
  const viewIds = (group.view_only_members || []).map((id) => id.toString());

  const or = [{ _id: { $in: [...memberIds, ...viewIds] } }];
  if (group.can_other_members_view) or.push({ role: 'Member' });

  const recipients = await User.find({
    $or: or,
    _id: { $ne: sender._id },
    expoPushToken: { $exists: true, $nin: [null, ''] },
  }).select('_id expoPushToken').lean();
  if (!recipients.length) return;

  const text = msg.text || '';
  const preview = text.length > 140 ? `${text.slice(0, 137)}...` : text;
  const body = `${msg.sender_name}: ${preview || 'Sent an attachment'}`;
  const base = { type: 'chat', groupId: group._id.toString(), groupName: group.name, groupType: group.group_type || '' };

  // canSend decides whether the chat opens with the message box
  const canSendTokens = [];
  const viewTokens = [];
  recipients.forEach((u) => {
    (memberIds.includes(u._id.toString()) ? canSendTokens : viewTokens).push(u.expoPushToken);
  });
  // badge null: leave the app icon badge as it is
  if (canSendTokens.length) await sendPushNotifications(canSendTokens, group.name, body, { ...base, canSend: '1' }, null);
  if (viewTokens.length) await sendPushNotifications(viewTokens, group.name, body, { ...base, canSend: '0' }, null);
};

// ==========================================
// 1. CHAT GROUP MANAGEMENT (ADMIN & LISTING)
// ==========================================

// @route   POST api/chat/groups
// @desc    Admin creates a new chat group with targeted members & permissions
// @access  Private (Admin / SubAdmin only)
router.post('/groups', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Access denied: Only Admins can create chat groups' });
    }

    const { 
      name, 
      description, 
      group_type, 
      members, 
      view_only_members,
      can_other_members_view, 
      can_residents_view,
      target_phases 
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Group name is required' });
    }

    // Verify member IDs exist and are of role 'Member' (or Admin)
    let validatedMemberIds = [];
    if (Array.isArray(members) && members.length > 0) {
      const validUsers = await User.find({ _id: { $in: members } }).select('_id');
      validatedMemberIds = validUsers.map(u => u._id);
    }

    let validatedViewOnlyMemberIds = [];
    if (Array.isArray(view_only_members) && view_only_members.length > 0) {
      const validViewUsers = await User.find({ _id: { $in: view_only_members } }).select('_id');
      validatedViewOnlyMemberIds = validViewUsers.map(u => u._id);
    }

    const newGroup = new ChatGroup({
      name: name.trim(),
      description: (description || '').trim(),
      group_type: group_type || 'General',
      created_by: req.user._id,
      members: validatedMemberIds,
      view_only_members: validatedViewOnlyMemberIds,
      can_other_members_view: !!can_other_members_view,
      can_residents_view: !!can_residents_view,
      target_phases: target_phases || []
    });

    await newGroup.save();
    await newGroup.populate('members', 'name phone_number designation member_id role');
    await newGroup.populate('view_only_members', 'name phone_number designation member_id role');

    // Emit live event to real-time clients
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_group_created', newGroup);
    }

    res.status(201).json({ success: true, group: newGroup });
  } catch (err) {
    console.error('Error creating chat group:', err);
    res.status(500).json({ msg: 'Server error creating chat group' });
  }
});

// @route   GET api/chat/groups
// @desc    Get all chat groups accessible by current user based on role & permissions
// @access  Private
// Groups a user may open (null = none)
const visibleGroupsQuery = (user) => {
  if (user.role === 'Admin' || user.role === 'SubAdmin' || user.role === 'SuperAdmin') {
    return { is_active: true };
  }
  if (user.role === 'Member') {
    return { is_active: true, $or: [{ members: user._id }, { view_only_members: user._id }, { can_other_members_view: true }] };
  }
  if (user.role === 'Resident') {
    return { is_active: true, $or: [{ members: user._id }, { view_only_members: user._id }, { can_residents_view: true }] };
  }
  return null;
};

// { groupId: unreadCount } for the given groups
const unreadCountsFor = async (user, groupIds) => {
  if (!groupIds.length) return {};
  const states = await ChatReadState.find({ user: user._id, group: { $in: groupIds } }).lean();
  const lastRead = new Map(states.map((st) => [st.group.toString(), st.last_read_at]));
  const counts = await Promise.all(groupIds.map((gid) => {
    const read = lastRead.get(gid.toString());
    const after = read && read > UNREAD_COUNTING_SINCE ? read : UNREAD_COUNTING_SINCE;
    return ChatMessage.countDocuments({
      group_id: gid,
      sender: { $ne: user._id },
      is_deleted: { $ne: true },
      createdAt: { $gt: after },
    });
  }));
  const out = {};
  groupIds.forEach((gid, i) => { out[gid.toString()] = counts[i]; });
  return out;
};

// @route   GET api/chat/unread
// @desc    Unread message counts for the chat tab badge
// @access  Private
router.get('/unread', auth, async (req, res) => {
  try {
    const query = visibleGroupsQuery(req.user);
    if (!query) return res.json({ total: 0, groups: {} });
    const groups = await ChatGroup.find(query).select('_id').lean();
    const counts = await unreadCountsFor(req.user, groups.map((g) => g._id));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ total, groups: counts });
  } catch (err) {
    console.error('Error fetching unread counts:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/chat/groups/:id/read
// @desc    Mark a group as read up to now
// @access  Private
router.post('/groups/:id/read', auth, async (req, res) => {
  try {
    const group = await ChatGroup.findById(req.params.id)
      .select('_id members view_only_members can_other_members_view can_residents_view is_active');
    if (!group || !group.is_active) return res.status(404).json({ msg: 'Chat group not found' });
    if (!getGroupPermissions(group, req.user).can_view) return res.status(403).json({ msg: 'Access denied' });
    await ChatReadState.updateOne(
      { user: req.user._id, group: group._id },
      { $set: { last_read_at: new Date() } },
      { upsert: true },
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking chat read:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/groups', auth, async (req, res) => {
  try {
    const user = req.user;
    let query = { is_active: true };

    if (user.role === 'Admin' || user.role === 'SubAdmin' || user.role === 'SuperAdmin') {
      // Admins see all groups
      query = { is_active: true };
    } else if (user.role === 'Member') {
      // Members see groups they are a chat member of OR specifically granted view_only access OR open to all other members
      query = {
        is_active: true,
        $or: [
          { members: user._id },
          { view_only_members: user._id },
          { can_other_members_view: true }
        ]
      };
    } else if (user.role === 'Resident') {
      // Residents see groups with can_residents_view enabled OR if they are an assigned member
      query = {
        is_active: true,
        $or: [
          { members: user._id },
          { view_only_members: user._id },
          { can_residents_view: true }
        ]
      };
    } else {
      return res.json([]);
    }

    // ?lite=1 (mobile chat list): skip the member arrays, which the list never
    // shows and which grow with every member. Older clients get the full shape.
    const lite = req.query.lite === '1';
    let groupsQuery = ChatGroup.find(query)
      .populate('created_by', 'name role')
      .sort({ 'last_message.timestamp': -1, updatedAt: -1 });
    if (!lite) {
      groupsQuery = groupsQuery
        .populate('members', 'name phone_number designation member_id role')
        .populate('view_only_members', 'name phone_number designation member_id role');
    }
    const groups = await groupsQuery;

    // Attach permission flag to each group for frontend ease and ensure real names in last_message
    const formatted = groups.map(g => {
      const perms = getGroupPermissions(g, user);
      const gObj = g.toObject();
      if (lite) {
        // Permissions are already computed; drop the raw id arrays from the payload
        delete gObj.members;
        delete gObj.view_only_members;
      }
      if (!lite && gObj.last_message && gObj.last_message.sender_id) {
        const sid = gObj.last_message.sender_id.toString();
        const found = (g.members || []).find(m => m._id.toString() === sid) ||
                      (g.view_only_members || []).find(m => m._id.toString() === sid) ||
                      (g.created_by && g.created_by._id.toString() === sid ? g.created_by : null);
        if (found) {
          const isAdmin = found.role === 'Admin' || found.role === 'SubAdmin' || found.role === 'SuperAdmin';
          if (isAdmin) {
            gObj.last_message.sender_name = (found.role === 'Admin' || found.role === 'SuperAdmin') ? 'Super Admin' : 'Admin';
          } else if (found.member_id && found.member_id.trim()) {
            gObj.last_message.sender_name = found.member_id.trim();
          } else if (found.name) {
            gObj.last_message.sender_name = found.name.trim();
          }
        }
      }
      return {
        ...gObj,
        user_access: perms // { can_view, can_send, is_member, is_admin }
      };
    });

    const unread = await unreadCountsFor(user, groups.map((g) => g._id)).catch(() => ({}));
    formatted.forEach((g) => { g.unread_count = unread[g._id.toString()] || 0; });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching chat groups:', err);
    res.status(500).json({ msg: 'Server error fetching chat groups' });
  }
});

// @route   GET api/chat/groups/:id
// @desc    Get group details with member permissions
// @access  Private
router.get('/groups/:id', auth, async (req, res) => {
  try {
    const group = await ChatGroup.findById(req.params.id)
      .populate('members', 'name phone_number designation member_id role')
      .populate('view_only_members', 'name phone_number designation member_id role')
      .populate('created_by', 'name role');

    if (!group || !group.is_active) {
      return res.status(404).json({ msg: 'Chat group not found' });
    }

    const perms = getGroupPermissions(group, req.user);
    if (!perms.can_view) {
      return res.status(403).json({ msg: 'Access denied: You do not have permission to view this group' });
    }

    res.json({
      ...group.toObject(),
      user_access: perms
    });
  } catch (err) {
    console.error('Error fetching group details:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT api/chat/groups/:id
// @desc    Update group name, members, or permissions
// @access  Private (Admin only)
router.put('/groups/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Access denied: Only Admins can modify chat groups' });
    }

    const { 
      name, 
      description, 
      group_type, 
      members, 
      view_only_members,
      can_other_members_view, 
      can_residents_view,
      target_phases,
      is_active 
    } = req.body;

    const group = await ChatGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (group_type !== undefined) group.group_type = group_type;
    if (can_other_members_view !== undefined) group.can_other_members_view = !!can_other_members_view;
    if (can_residents_view !== undefined) group.can_residents_view = !!can_residents_view;
    if (target_phases !== undefined) group.target_phases = target_phases;
    if (is_active !== undefined) group.is_active = !!is_active;

    if (Array.isArray(members)) {
      const validUsers = await User.find({ _id: { $in: members } }).select('_id');
      group.members = validUsers.map(u => u._id);
    }

    if (Array.isArray(view_only_members)) {
      const validViewUsers = await User.find({ _id: { $in: view_only_members } }).select('_id');
      group.view_only_members = validViewUsers.map(u => u._id);
    }

    await group.save();
    await group.populate('members', 'name phone_number designation member_id role');
    await group.populate('view_only_members', 'name phone_number designation member_id role');

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_group_updated', group);
    }

    res.json({ success: true, group });
  } catch (err) {
    console.error('Error updating chat group:', err);
    res.status(500).json({ msg: 'Server error updating chat group' });
  }
});

// @route   DELETE api/chat/groups/:id
// @desc    Soft delete or permanently archive chat group
// @access  Private (Admin only)
router.delete('/groups/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ msg: 'Only Super Admins can delete groups' });
    }

    const group = await ChatGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ msg: 'Group not found' });

    group.is_active = false;
    await group.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_group_deleted', { group_id: group._id });
    }

    res.json({ success: true, msg: 'Chat group archived' });
  } catch (err) {
    console.error('Error deleting chat group:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 2. CHAT MESSAGING (SEND, REPLY, EDIT, DELETE)
// ==========================================

// @route   GET api/chat/groups/:id/messages
// @desc    Get message history for a group (paginated)
// @access  Private
router.get('/groups/:id/messages', auth, async (req, res) => {
  try {
    const group = await ChatGroup.findById(req.params.id);
    if (!group || !group.is_active) {
      return res.status(404).json({ msg: 'Chat group not found' });
    }

    const perms = getGroupPermissions(group, req.user);
    if (!perms.can_view) {
      return res.status(403).json({ msg: 'Access denied: You do not have permission to view messages' });
    }

    // Paging, WhatsApp-style: the app opens a chat with the newest page and
    // fetches older pages only as the user scrolls up.
    //   ?limit=30              newest 30 messages
    //   ?before_id=<msgId>     the page just older than that message
    //   ?since=<ISO date>      everything created OR edited/deleted after that
    //                          time (catch-up after reconnect / app resume)
    //   ?before=<ISO date>     legacy date cursor, still accepted
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const { before, before_id, since, q } = req.query;

    const msgQuery = { group_id: group._id };
    let sortNewestFirst = true;
    if (q && String(q).trim()) {
      // ?q=<text>: search inside this group, newest matches first
      const escaped = String(q).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      msgQuery.text = { $regex: escaped, $options: 'i' };
      msgQuery.is_deleted = { $ne: true };
    } else if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        msgQuery.updatedAt = { $gt: sinceDate };
        sortNewestFirst = false;
      }
    } else if (before_id && /^[a-f0-9]{24}$/i.test(before_id)) {
      msgQuery._id = { $lt: before_id };
    } else if (before) {
      msgQuery.createdAt = { $lt: new Date(before) };
    }

    // reply_to already stores the quoted sender and text, so it needs no populate
    const fetched = await ChatMessage.find(msgQuery)
      .select('-edit_history -read_by')
      .populate('sender', 'name designation role member_id')
      .sort(sortNewestFirst ? { _id: -1 } : { updatedAt: 1 })
      .limit(limit + 1)
      .lean();

    const has_more = fetched.length > limit;
    const page = has_more ? fetched.slice(0, limit) : fetched;
    if (sortNewestFirst) page.reverse();

    // Chronological order; Member ID first for committee members
    const formattedMessages = page.map(obj => {
      if (obj.sender && typeof obj.sender === 'object') {
        const isAdmin = obj.sender.role === 'Admin' || obj.sender.role === 'SubAdmin' || obj.sender.role === 'SuperAdmin';
        if (isAdmin) {
          obj.sender_name = (obj.sender.role === 'Admin' || obj.sender.role === 'SuperAdmin') ? 'Super Admin' : 'Admin';
        } else if (obj.sender.member_id && obj.sender.member_id.trim()) {
          obj.sender_name = obj.sender.member_id.trim();
        } else if (obj.sender.name && obj.sender.name.trim()) {
          obj.sender_name = obj.sender.name.trim();
        }
      }
      return obj;
    });

    res.json({
      messages: formattedMessages,
      has_more,
      server_time: new Date().toISOString(),
      user_access: perms
    });
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    res.status(500).json({ msg: 'Server error fetching messages' });
  }
});

// @route   POST api/chat/groups/:id/messages
// @desc    Send a message (Supports WhatsApp-style Reply)
// @access  Private (Assigned Members or Admins only)
router.post('/groups/:id/messages', auth, async (req, res) => {
  try {
    const group = await ChatGroup.findById(req.params.id);
    if (!group || !group.is_active) {
      return res.status(404).json({ msg: 'Chat group not found' });
    }

    const perms = getGroupPermissions(group, req.user);
    if (!perms.can_send) {
      return res.status(403).json({ 
        msg: 'Read-only access: You are not authorized to send messages in this group' 
      });
    }

    const { text, attachments, reply_to_message_id } = req.body;
    if ((!text || !text.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ msg: 'Message text or attachment is required' });
    }

    // Handle WhatsApp-like Reply if provided
    let replyPayload = undefined;
    if (reply_to_message_id) {
      const parentMsg = await ChatMessage.findById(reply_to_message_id).populate('sender', 'member_id role name');
      if (parentMsg && parentMsg.group_id.toString() === group._id.toString()) {
        let replySenderName = parentMsg.sender_name;
        if (parentMsg.sender && typeof parentMsg.sender === 'object') {
          const parentIsAdmin = parentMsg.sender.role === 'Admin' || parentMsg.sender.role === 'SubAdmin' || parentMsg.sender.role === 'SuperAdmin';
          if (parentIsAdmin) {
            replySenderName = (parentMsg.sender.role === 'Admin' || parentMsg.sender.role === 'SuperAdmin') ? 'Super Admin' : 'Admin';
          } else if (parentMsg.sender.member_id && parentMsg.sender.member_id.trim()) {
            replySenderName = parentMsg.sender.member_id.trim();
          }
        }
        replyPayload = {
          message_id: parentMsg._id,
          sender_name: replySenderName,
          text: parentMsg.is_deleted ? 'This message was deleted' : parentMsg.text
        };
      }
    }

    const isAdmin = req.user.role === 'Admin' || req.user.role === 'SubAdmin' || req.user.role === 'SuperAdmin';
    let senderName = '';
    if (isAdmin) {
      senderName = (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') ? 'Super Admin' : 'Admin';
    } else if (req.user.member_id && req.user.member_id.trim()) {
      senderName = req.user.member_id.trim();
    } else {
      senderName = (req.user.name || 'Member').trim();
    }

    const senderDesignation = req.user.designation || (req.user.role === 'Admin' ? 'Management' : req.user.role === 'SubAdmin' ? 'Office' : '');

    const newMsg = new ChatMessage({
      group_id: group._id,
      sender: req.user._id,
      sender_name: senderName,
      sender_role: req.user.role,
      sender_designation: senderDesignation,
      text: (text || '').trim(),
      attachments: attachments || [],
      reply_to: replyPayload,
      read_by: [req.user._id]
    });

    await newMsg.save();
    await newMsg.populate('sender', 'name designation role member_id');

    // Update last_message in group for fast preview
    group.last_message = {
      text: newMsg.text || 'Sent an attachment',
      sender_id: req.user._id,
      sender_name: senderName,
      sender_role: req.user.role,
      timestamp: new Date()
    };
    await group.save();

    // Real-time broadcast via Socket.io to the group room and globally
    const io = req.app.get('io');
    if (io) {
      io.to(`chat_group_${group._id}`).emit('new_message', newMsg);
      io.emit('new_message', newMsg);
      io.emit('chat_group_last_message', {
        group_id: group._id,
        last_message: group.last_message
      });
    }

    res.status(201).json({ success: true, message: newMsg });

    // Push notification after the response, so sending never waits for it
    setImmediate(() => {
      notifyGroupMessage(group, newMsg, req.user).catch((e) => console.error('Chat push failed:', e.message));
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ msg: 'Server error sending message' });
  }
});

// @route   PUT api/chat/messages/:message_id
// @desc    WhatsApp-style Edit Message (Only original sender can edit)
// @access  Private
router.put('/messages/:message_id', auth, async (req, res) => {
  try {
    const { new_text } = req.body;
    if (!new_text || !new_text.trim()) {
      return res.status(400).json({ msg: 'Updated text cannot be empty' });
    }

    const message = await ChatMessage.findById(req.params.message_id);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    if (message.is_deleted) {
      return res.status(400).json({ msg: 'Cannot edit a deleted message' });
    }

    // Only the original author can edit their message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ msg: 'You can only edit your own messages' });
    }

    // Save previous version to edit_history
    message.edit_history.push({
      text: message.text,
      edited_at: new Date()
    });

    message.text = new_text.trim();
    message.is_edited = true;
    message.edited_at = new Date();
    await message.save();

    // Emit live update
    const io = req.app.get('io');
    if (io) {
      const editPayload = {
        message_id: message._id,
        group_id: message.group_id,
        new_text: message.text,
        is_edited: true,
        edited_at: message.edited_at
      };
      io.to(`chat_group_${message.group_id}`).emit('message_edited', editPayload);
      io.emit('message_edited', editPayload);
    }
    await refreshGroupLastMessage(message.group_id, io).catch((e) => console.error('last_message refresh failed:', e.message));

    res.json({ success: true, message });
  } catch (err) {
    console.error('Error editing message:', err);
    res.status(500).json({ msg: 'Server error editing message' });
  }
});

// @route   DELETE api/chat/messages/:message_id
// @desc    WhatsApp-style Soft Delete Message ("This message was deleted")
// @access  Private (Sender or Admin)
router.delete('/messages/:message_id', auth, async (req, res) => {
  try {
    const message = await ChatMessage.findById(req.params.message_id);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    const isSender = message.sender.toString() === req.user._id.toString();
    const roleLower = (req.user.role || '').toLowerCase();
    const isAdmin = roleLower === 'admin' || roleLower === 'subadmin';

    // A regular member can ONLY delete their own message.
    // Admin or SubAdmin can delete their own messages AND any member's message.
    if (!isSender && !isAdmin) {
      return res.status(403).json({ msg: 'You are not authorized to delete this message' });
    }

    message.is_deleted = true;
    message.text = 'This message was deleted';
    message.attachments = [];
    message.deleted_at = new Date();
    await message.save();

    const io = req.app.get('io');
    if (io) {
      const deletePayload = {
        message_id: message._id,
        group_id: message.group_id
      };
      io.to(`chat_group_${message.group_id}`).emit('message_deleted', deletePayload);
      io.emit('message_deleted', deletePayload);
    }
    await refreshGroupLastMessage(message.group_id, io).catch((e) => console.error('last_message refresh failed:', e.message));

    res.json({ success: true, msg: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
