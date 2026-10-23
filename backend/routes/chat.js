const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ChatGroup = require('../models/ChatGroup');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

/**
 * Helper to determine a user's permissions on a specific group
 * Returns: { can_view: boolean, can_send: boolean, is_member: boolean, is_view_only: boolean, is_admin: boolean }
 */
const getGroupPermissions = (group, user) => {
  const isAdmin = user.role === 'Admin' || user.role === 'SubAdmin';
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
    if (group.can_residents_view) {
      return { can_view: true, can_send: false, is_member: false, is_view_only: true, is_admin: false };
    }
    return { can_view: false, can_send: false, is_member: false, is_view_only: false, is_admin: false };
  }

  return { can_view: false, can_send: false, is_member: false, is_view_only: false, is_admin: false };
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
router.get('/groups', auth, async (req, res) => {
  try {
    const user = req.user;
    let query = { is_active: true };

    if (user.role === 'Admin' || user.role === 'SubAdmin') {
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
      // Residents see groups with can_residents_view enabled
      query = {
        is_active: true,
        can_residents_view: true
      };
    } else {
      return res.json([]);
    }

    const groups = await ChatGroup.find(query)
      .populate('members', 'name phone_number designation member_id role')
      .populate('view_only_members', 'name phone_number designation member_id role')
      .populate('created_by', 'name role')
      .sort({ 'last_message.timestamp': -1, updatedAt: -1 });

    // Attach permission flag to each group for frontend ease
    const formatted = groups.map(g => {
      const perms = getGroupPermissions(g, user);
      return {
        ...g.toObject(),
        user_access: perms // { can_view, can_send, is_member, is_admin }
      };
    });

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

    const limit = parseInt(req.query.limit, 10) || 50;
    const before = req.query.before; // For infinite scrolling / pagination

    const msgQuery = { group_id: group._id };
    if (before) {
      msgQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(msgQuery)
      .populate('sender', 'name designation role member_id')
      .populate('reply_to.message_id', 'text sender_name is_deleted')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Return in chronological order
    res.json({
      messages: messages.reverse(),
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
      const parentMsg = await ChatMessage.findById(reply_to_message_id);
      if (parentMsg && parentMsg.group_id.toString() === group._id.toString()) {
        replyPayload = {
          message_id: parentMsg._id,
          sender_name: parentMsg.sender_name,
          text: parentMsg.is_deleted ? 'This message was deleted' : parentMsg.text
        };
      }
    }

    const senderName = req.user.name || (req.user.role === 'Admin' ? 'Super Admin' : req.user.role === 'SubAdmin' ? 'Admin' : 'Member');
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

    // Update last_message in group for fast preview
    group.last_message = {
      text: newMsg.text || 'Sent an attachment',
      sender_id: req.user._id,
      sender_name: req.user.name || 'Member',
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

    res.json({ success: true, msg: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
