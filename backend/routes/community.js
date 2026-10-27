const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Community = require('../models/Community');
const CommunitySection = require('../models/CommunitySection');
const CommunityMessage = require('../models/CommunityMessage');
const User = require('../models/User');

/**
 * Check if a user can access/view a community based on role
 */
const canUserAccessCommunity = (community, user) => {
  if (user.role === 'Admin' || user.role === 'SubAdmin') return true;
  if (!community.target_roles || community.target_roles.length === 0) return true;
  if (community.target_roles.includes('All')) return true;
  return community.target_roles.includes(user.role);
};

/**
 * Helper to determine a user's permissions on a specific community section
 * Followers get read-only access ("just for visible read access nothing else").
 * Assigned members are scoped strictly to their particular section.
 */
const getSectionUserAccess = (section, user) => {
  const isAdmin = user.role === 'Admin' || user.role === 'SubAdmin';
  if (isAdmin) {
    return {
      can_view: true,
      can_send: true,
      is_assigned: true,
      is_following: true,
      is_admin: true
    };
  }

  const userIdStr = user._id.toString();

  // Check if member is assigned specifically to this section
  const isAssigned = (section.assigned_members || []).some(
    m => (m._id || m).toString() === userIdStr
  );

  // Check if user is following this section
  const isFollowing = (section.followers || []).some(
    f => (f._id || f).toString() === userIdStr
  );

  if (isAssigned) {
    return {
      can_view: true,
      can_send: true,
      is_assigned: true,
      is_following: true,
      is_admin: false
    };
  }

  if (isFollowing) {
    // Followers have visible read-only access only
    return {
      can_view: true,
      can_send: false,
      is_assigned: false,
      is_following: true,
      is_admin: false
    };
  }

  // Not following and not assigned
  return {
    can_view: false,
    can_send: false,
    is_assigned: false,
    is_following: false,
    is_admin: false
  };
};

// ==========================================
// 1. COMMUNITY MANAGEMENT (ADMIN & LISTING)
// ==========================================

// @route   GET api/community
// @desc    Get all communities visible to current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = req.user;
    const includeSections = req.query.include_sections === 'true';

    let query = { is_active: true };
    if (user.role !== 'Admin' && user.role !== 'SubAdmin') {
      query.$or = [
        { target_roles: 'All' },
        { target_roles: user.role },
        { target_roles: { $size: 0 } }
      ];
    }

    const communities = await Community.find(query)
      .populate('created_by', 'name role')
      .sort({ createdAt: -1 });

    const communityIds = communities.map(c => c._id);

    // Fetch active sections for these communities
    const sections = await CommunitySection.find({
      community_id: { $in: communityIds },
      is_active: true
    })
      .populate('assigned_members', 'name phone_number designation member_id role')
      .sort({ createdAt: 1 });

    // Format output with sections count & user status
    const formatted = communities.map(comm => {
      const commObj = comm.toObject();
      const commSections = sections.filter(
        s => s.community_id.toString() === comm._id.toString()
      );

      const formattedSections = commSections.map(s => {
        const sObj = s.toObject();
        const access = getSectionUserAccess(s, user);
        return {
          ...sObj,
          followers_count: (s.followers || []).length,
          assigned_count: (s.assigned_members || []).length,
          user_access: access
        };
      });

      commObj.sections_count = commSections.length;
      commObj.total_followers = commSections.reduce(
        (acc, curr) => acc + (curr.followers?.length || 0),
        0
      );
      commObj.is_following_any = formattedSections.some(
        s => s.user_access.is_following
      );

      if (includeSections) {
        commObj.sections = formattedSections;
      }

      return commObj;
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching communities:', err);
    res.status(500).json({ msg: 'Server error fetching communities' });
  }
});

// @route   POST api/community
// @desc    Admin creates a new community
// @access  Private (Admin / SubAdmin)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Access denied: Only Admins can create communities' });
    }

    const { name, description, icon, color, target_roles } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Community name is required' });
    }

    const roles = Array.isArray(target_roles) && target_roles.length > 0
      ? target_roles
      : ['All'];

    const newCommunity = new Community({
      name: name.trim(),
      description: (description || '').trim(),
      icon: icon || 'flash',
      color: color || '#F59E0B',
      target_roles: roles,
      created_by: req.user._id
    });

    await newCommunity.save();
    await newCommunity.populate('created_by', 'name role');

    const io = req.app.get('io');
    if (io) {
      io.emit('community_created', newCommunity);
    }

    res.status(201).json({ success: true, community: newCommunity });
  } catch (err) {
    console.error('Error creating community:', err);
    res.status(500).json({ msg: 'Server error creating community' });
  }
});

// @route   GET api/community/:id
// @desc    Get single community details with its sections
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id).populate('created_by', 'name role');
    if (!community || !community.is_active) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    if (!canUserAccessCommunity(community, req.user)) {
      return res.status(403).json({ msg: 'Access denied: You do not have role access to this community' });
    }

    const sections = await CommunitySection.find({
      community_id: community._id,
      is_active: true
    })
      .populate('assigned_members', 'name phone_number designation member_id role')
      .sort({ createdAt: 1 });

    const formattedSections = sections.map(s => {
      const sObj = s.toObject();
      const access = getSectionUserAccess(s, req.user);
      return {
        ...sObj,
        followers_count: (s.followers || []).length,
        assigned_count: (s.assigned_members || []).length,
        user_access: access
      };
    });

    res.json({
      ...community.toObject(),
      sections: formattedSections
    });
  } catch (err) {
    console.error('Error fetching community details:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT api/community/:id
// @desc    Update community info (Admin only)
// @access  Private (Admin / SubAdmin)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { name, description, icon, color, target_roles, is_active } = req.body;
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ msg: 'Community not found' });

    if (name !== undefined) community.name = name.trim();
    if (description !== undefined) community.description = description.trim();
    if (icon !== undefined) community.icon = icon;
    if (color !== undefined) community.color = color;
    if (Array.isArray(target_roles)) community.target_roles = target_roles;
    if (is_active !== undefined) community.is_active = !!is_active;

    await community.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('community_updated', community);
    }

    res.json({ success: true, community });
  } catch (err) {
    console.error('Error updating community:', err);
    res.status(500).json({ msg: 'Server error updating community' });
  }
});

// @route   DELETE api/community/:id
// @desc    Delete community & soft delete sections
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ msg: 'Only Super Admins can delete communities' });
    }

    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ msg: 'Community not found' });

    community.is_active = false;
    await community.save();

    // Also mark its sections inactive
    await CommunitySection.updateMany({ community_id: community._id }, { is_active: false });

    const io = req.app.get('io');
    if (io) {
      io.emit('community_deleted', { community_id: community._id });
    }

    res.json({ success: true, msg: 'Community archived successfully' });
  } catch (err) {
    console.error('Error deleting community:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 2. COMMUNITY SECTIONS (CHANNELS/GROUPS)
// ==========================================

// @route   POST api/community/:id/sections
// @desc    Admin creates a new community section (channel/group)
// @access  Private (Admin / SubAdmin)
router.post('/:id/sections', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Access denied: Only Admins can create community sections' });
    }

    const community = await Community.findById(req.params.id);
    if (!community || !community.is_active) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    const { name, description, icon, section_type, assigned_members } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Section name is required' });
    }

    // Validate assigned members if provided
    let validatedMemberIds = [];
    if (Array.isArray(assigned_members) && assigned_members.length > 0) {
      const validUsers = await User.find({ _id: { $in: assigned_members } }).select('_id');
      validatedMemberIds = validUsers.map(u => u._id);
    }

    const newSection = new CommunitySection({
      community_id: community._id,
      name: name.trim(),
      description: (description || '').trim(),
      icon: icon || (section_type === 'discussion' ? 'chatbubbles' : 'megaphone'),
      section_type: section_type || 'announcement',
      assigned_members: validatedMemberIds,
      followers: [] // Empty initial followers, members follow for read access
    });

    await newSection.save();
    await newSection.populate('assigned_members', 'name phone_number designation member_id role');

    const io = req.app.get('io');
    if (io) {
      io.emit('community_section_created', newSection);
    }

    res.status(201).json({ success: true, section: newSection });
  } catch (err) {
    console.error('Error creating community section:', err);
    res.status(500).json({ msg: 'Server error creating community section' });
  }
});

// @route   GET api/community/:id/sections
// @desc    Get all active sections of a community
// @access  Private
router.get('/:id/sections', auth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community || !community.is_active) {
      return res.status(404).json({ msg: 'Community not found' });
    }

    const sections = await CommunitySection.find({
      community_id: community._id,
      is_active: true
    })
      .populate('assigned_members', 'name phone_number designation member_id role')
      .sort({ createdAt: 1 });

    const formatted = sections.map(s => {
      const sObj = s.toObject();
      const access = getSectionUserAccess(s, req.user);
      return {
        ...sObj,
        followers_count: (s.followers || []).length,
        assigned_count: (s.assigned_members || []).length,
        user_access: access
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching community sections:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/community/sections/:sectionId
// @desc    Get single community section details
// @access  Private
router.get('/sections/:sectionId', auth, async (req, res) => {
  try {
    const section = await CommunitySection.findById(req.params.sectionId)
      .populate('community_id', 'name icon color target_roles')
      .populate('assigned_members', 'name phone_number designation member_id role');

    if (!section || !section.is_active) {
      return res.status(404).json({ msg: 'Section not found' });
    }

    const access = getSectionUserAccess(section, req.user);

    res.json({
      ...section.toObject(),
      followers_count: (section.followers || []).length,
      assigned_count: (section.assigned_members || []).length,
      user_access: access
    });
  } catch (err) {
    console.error('Error fetching section details:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT api/community/sections/:sectionId
// @desc    Update section details or assign members (Admin only)
// @access  Private (Admin / SubAdmin)
router.put('/sections/:sectionId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Access denied: Only Admins can modify community sections' });
    }

    const { name, description, icon, section_type, assigned_members, is_active } = req.body;
    const section = await CommunitySection.findById(req.params.sectionId);
    if (!section) return res.status(404).json({ msg: 'Section not found' });

    if (name !== undefined) section.name = name.trim();
    if (description !== undefined) section.description = description.trim();
    if (icon !== undefined) section.icon = icon;
    if (section_type !== undefined) section.section_type = section_type;
    if (is_active !== undefined) section.is_active = !!is_active;

    if (Array.isArray(assigned_members)) {
      const validUsers = await User.find({ _id: { $in: assigned_members } }).select('_id');
      section.assigned_members = validUsers.map(u => u._id);
    }

    await section.save();
    await section.populate('assigned_members', 'name phone_number designation member_id role');

    const io = req.app.get('io');
    if (io) {
      io.emit('community_section_updated', section);
    }

    res.json({ success: true, section });
  } catch (err) {
    console.error('Error updating community section:', err);
    res.status(500).json({ msg: 'Server error updating section' });
  }
});

// @route   DELETE api/community/sections/:sectionId
// @desc    Delete community section (Admin only)
// @access  Private (Admin only)
router.delete('/sections/:sectionId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ msg: 'Only Super Admins can delete sections' });
    }

    const section = await CommunitySection.findById(req.params.sectionId);
    if (!section) return res.status(404).json({ msg: 'Section not found' });

    section.is_active = false;
    await section.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('community_section_deleted', { section_id: section._id });
    }

    res.json({ success: true, msg: 'Community section archived' });
  } catch (err) {
    console.error('Error deleting section:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 3. FOLLOW / UNFOLLOW (FOR READ ACCESS)
// ==========================================

// @route   POST api/community/sections/:sectionId/follow
// @desc    User follows a community section for read access
// @access  Private
router.post('/sections/:sectionId/follow', auth, async (req, res) => {
  try {
    const section = await CommunitySection.findById(req.params.sectionId);
    if (!section || !section.is_active) {
      return res.status(404).json({ msg: 'Community section not found' });
    }

    const userId = req.user._id;

    // Add to followers if not already following
    await CommunitySection.findByIdAndUpdate(section._id, {
      $addToSet: { followers: userId }
    });

    const updated = await CommunitySection.findById(section._id);
    const followerCount = (updated.followers || []).length;

    const io = req.app.get('io');
    if (io) {
      io.to(`community_section_${section._id}`).emit('community_section_followers_changed', {
        section_id: section._id,
        follower_count: followerCount
      });
      io.emit('community_section_updated', {
        _id: section._id,
        community_id: section.community_id,
        followers_count: followerCount
      });
    }

    res.json({
      success: true,
      is_following: true,
      follower_count: followerCount,
      msg: 'Successfully followed channel. You now have read access.'
    });
  } catch (err) {
    console.error('Error following section:', err);
    res.status(500).json({ msg: 'Server error following section' });
  }
});

// @route   POST api/community/sections/:sectionId/unfollow
// @desc    User unfollows a community section
// @access  Private
router.post('/sections/:sectionId/unfollow', auth, async (req, res) => {
  try {
    const section = await CommunitySection.findById(req.params.sectionId);
    if (!section || !section.is_active) {
      return res.status(404).json({ msg: 'Community section not found' });
    }

    const userId = req.user._id;

    await CommunitySection.findByIdAndUpdate(section._id, {
      $pull: { followers: userId }
    });

    const updated = await CommunitySection.findById(section._id);
    const followerCount = (updated.followers || []).length;

    const io = req.app.get('io');
    if (io) {
      io.to(`community_section_${section._id}`).emit('community_section_followers_changed', {
        section_id: section._id,
        follower_count: followerCount
      });
      io.emit('community_section_updated', {
        _id: section._id,
        community_id: section.community_id,
        followers_count: followerCount
      });
    }

    res.json({
      success: true,
      is_following: false,
      follower_count: followerCount,
      msg: 'Unfollowed channel.'
    });
  } catch (err) {
    console.error('Error unfollowing section:', err);
    res.status(500).json({ msg: 'Server error unfollowing section' });
  }
});

// ==========================================
// 4. MESSAGES / UPDATES IN COMMUNITY SECTION
// ==========================================

// @route   GET api/community/sections/:sectionId/messages
// @desc    Get message feed for a section (Follower or Assigned Member or Admin)
// @access  Private
router.get('/sections/:sectionId/messages', auth, async (req, res) => {
  try {
    const section = await CommunitySection.findById(req.params.sectionId);
    if (!section || !section.is_active) {
      return res.status(404).json({ msg: 'Section not found' });
    }

    const access = getSectionUserAccess(section, req.user);

    // If user cannot view because they haven't followed yet:
    if (!access.can_view) {
      return res.status(200).json({
        messages: [],
        requires_follow: true,
        user_access: access,
        msg: 'Please follow this channel to view updates and messages.'
      });
    }

    const limit = parseInt(req.query.limit, 10) || 50;
    const before = req.query.before;

    const msgQuery = {
      section_id: section._id,
      is_deleted: false
    };

    if (before) {
      msgQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await CommunityMessage.find(msgQuery)
      .populate('sender', 'name designation role member_id')
      .populate('reply_to.message_id', 'text sender_name is_deleted')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Format message senders with priority for titles/roles
    const formatted = messages.reverse().map(m => {
      const obj = m.toObject();
      if (obj.sender && typeof obj.sender === 'object') {
        const isAdmin = obj.sender.role === 'Admin' || obj.sender.role === 'SubAdmin';
        if (isAdmin) {
          obj.sender_name = obj.sender.role === 'Admin' ? 'Super Admin' : 'Admin';
        } else if (obj.sender.member_id && obj.sender.member_id.trim()) {
          obj.sender_name = obj.sender.member_id.trim();
        } else if (obj.sender.name && obj.sender.name.trim()) {
          obj.sender_name = obj.sender.name.trim();
        }
      }
      return obj;
    });

    res.json({
      messages: formatted,
      requires_follow: false,
      user_access: access
    });
  } catch (err) {
    console.error('Error fetching section messages:', err);
    res.status(500).json({ msg: 'Server error fetching messages' });
  }
});

// @route   POST api/community/sections/:sectionId/messages
// @desc    Post message or update into community section (Admin or Assigned Members)
// @access  Private
router.post('/sections/:sectionId/messages', auth, async (req, res) => {
  try {
    const section = await CommunitySection.findById(req.params.sectionId);
    if (!section || !section.is_active) {
      return res.status(404).json({ msg: 'Section not found' });
    }

    const access = getSectionUserAccess(section, req.user);

    if (!access.can_send) {
      return res.status(403).json({
        msg: 'Read-only access: Followers are only permitted to view updates. Only Admins or assigned section members can post updates.'
      });
    }

    const { text, attachments, reply_to_message_id } = req.body;
    if ((!text || !text.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ msg: 'Message text or attachment is required' });
    }

    let replyPayload = undefined;
    if (reply_to_message_id) {
      const parentMsg = await CommunityMessage.findById(reply_to_message_id).populate('sender', 'name role member_id');
      if (parentMsg && parentMsg.section_id.toString() === section._id.toString()) {
        replyPayload = {
          message_id: parentMsg._id,
          sender_name: parentMsg.sender_name,
          text: parentMsg.text
        };
      }
    }

    const senderRole = req.user.role;
    let senderDisplayName = req.user.name || 'Admin';
    if (senderRole === 'Admin') senderDisplayName = 'Super Admin';
    else if (senderRole === 'SubAdmin') senderDisplayName = 'Admin';
    else if (req.user.member_id && req.user.member_id.trim()) senderDisplayName = req.user.member_id.trim();

    const newMsg = new CommunityMessage({
      community_id: section.community_id,
      section_id: section._id,
      sender: req.user._id,
      sender_name: senderDisplayName,
      sender_role: senderRole,
      sender_designation: req.user.designation || '',
      text: (text || '').trim(),
      attachments: attachments || [],
      reply_to: replyPayload,
      read_by: [req.user._id]
    });

    await newMsg.save();
    await newMsg.populate('sender', 'name designation role member_id');

    // Update section last_message
    section.last_message = {
      text: newMsg.text || 'Shared an attachment',
      sender_id: req.user._id,
      sender_name: senderDisplayName,
      sender_role: senderRole,
      timestamp: new Date()
    };
    await section.save();

    const io = req.app.get('io');
    if (io) {
      // Emit to room for live message feed
      io.to(`community_section_${section._id}`).emit('new_community_message', newMsg);
      // Emit to all for section card preview updates
      io.emit('community_section_last_message', {
        section_id: section._id,
        community_id: section.community_id,
        last_message: section.last_message
      });
    }

    res.status(201).json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Error posting community message:', err);
    res.status(500).json({ msg: 'Server error sending message' });
  }
});

// @route   DELETE api/community/sections/:sectionId/messages/:messageId
// @desc    Admin deletes a message in community section
// @access  Private (Admin only)
router.delete('/sections/:sectionId/messages/:messageId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'SubAdmin') {
      return res.status(403).json({ msg: 'Only Admins can delete community messages' });
    }

    const msg = await CommunityMessage.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ msg: 'Message not found' });

    msg.is_deleted = true;
    msg.deleted_at = new Date();
    await msg.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`community_section_${req.params.sectionId}`).emit('community_message_deleted', {
        message_id: msg._id,
        section_id: req.params.sectionId
      });
    }

    res.json({ success: true, msg: 'Message removed' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
