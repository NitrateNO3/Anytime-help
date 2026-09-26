const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

// @route   GET api/announcements
// @desc    Get all active announcements
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = { active: true };
    if (req.user.role === 'Resident') {
      const user = await User.findById(req.user.id);
      if (user && user.phase) {
        query.phases = { $in: [user.phase, 'All', 'Resident'] };
      } else {
        // If user has no phase, fallback to 'All', 'Resident', or empty
        query.$or = [{ phases: 'All' }, { phases: 'Resident' }, { phases: { $size: 0 } }];
      }
      query.targetAudience = { $ne: 'Members' }; // Residents cannot see 'Members' only announcements
    } else if (req.user.role === 'Staff') {
      const user = await User.findById(req.user.id);
      if (user && user.phase) {
        query.phases = { $in: [user.phase, 'All'] };
      }
    } else if (req.user.role === 'Admin') {
      const { phase } = req.query;
      if (phase && phase !== 'All Groups (Show Everything)') {
        if (phase === 'Universal (Sent to Everyone)') {
          query.$or = [{ phases: 'All' }, { phases: { $size: 0 } }, { phases: { $exists: false } }];
        } else if (phase === 'Sushant Lok 2 - C,D,E') {
          query.phases = { $in: ['Sushant Lok 2 - C,D,E', 'Sushant Lok 2 Option 1'] };
        } else if (phase === 'Sushant Lok 2 - F,G') {
          query.phases = { $in: ['Sushant Lok 2 - F,G', 'Sushant Lok 2 Option 2'] };
        } else {
          query.phases = phase;
        }
      }
    }

    const { page, limit, search, dateFrom, dateTo } = req.query;

    if (search && search.trim()) {
      const s = search.trim();
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [
          { title: { $regex: s, $options: 'i' } },
          { message: { $regex: s, $options: 'i' } },
          { creatorName: { $regex: s, $options: 'i' } }
        ]
      });
    }

    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      if (!query.$and) query.$and = [];
      query.$and.push({ date: dateFilter });
    }

    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      const announcements = await Announcement.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name');
      const total = await Announcement.countDocuments(query);
      return res.json({ announcements, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
    }

    const announcements = await Announcement.find(query)
      .sort({ date: -1 })
      .populate('createdBy', 'name');
    res.json(announcements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/announcements
// @desc    Create an announcement (Admin only)
// @access  Private
router.post('/', auth, async (req, res) => {
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || 
    ((req.user.role === 'SubAdmin' || req.user.role === 'Member') && req.user.permissions && req.user.permissions.some(p => p.startsWith('Announcements')));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  const { title, message, phases, targetAudience, image } = req.body;

  try {
    let creatorName = req.user.name;
    let creatorId = req.user.member_id;

    // Optional: if name is missing from token, fetch from db
    if (!creatorName) {
      const userObj = await User.findById(req.user.id);
      creatorName = userObj?.name || req.user.role;
      creatorId = userObj?.member_id || '';
    }

    const newAnnouncement = new Announcement({
      title,
      message,
      createdBy: req.user.id,
      creatorName: creatorName || req.user.role,
      creatorId: creatorId || '',
      phases: phases || [],
      targetAudience: targetAudience || 'All',
      image: image || null
    });

    const announcement = await newAnnouncement.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'create', data: announcement });
    }

    try {
      // Find users to notify
      let userQuery = {};
      const audience = targetAudience || 'All';
      if (audience === 'Members') {
        userQuery.role = 'Member';
      } else {
        userQuery.role = { $in: ['Resident', 'Member'] }; // Notify residents and members for 'All'
      }

      const targetPhases = phases || [];
      if (targetPhases.length > 0 && !targetPhases.includes('All')) {
        userQuery.$or = [{ phase: { $in: targetPhases } }, { phase: { $exists: false } }, { phase: '' }];
      }
      
      userQuery.expoPushToken = { $exists: true, $ne: '' };

      const User = require('../models/User');
      const usersToNotify = await User.find(userQuery).select('expoPushToken');
      const tokens = usersToNotify.map(u => u.expoPushToken);
      
      if (tokens.length > 0) {
        const { sendPushNotifications } = require('../utils/push');
        // We don't await to not block the API response
        sendPushNotifications(tokens, '📢 ' + title, message, { type: 'announcement', id: announcement._id });
      }
    } catch (pushErr) {
      console.error('Push notification error:', pushErr.message);
    }

    res.json(announcement);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/announcements/:id
// @desc    Delete (or deactivate) an announcement
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || 
    ((req.user.role === 'SubAdmin' || req.user.role === 'Member') && req.user.permissions && req.user.permissions.some(p => p.startsWith('Announcements')));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ msg: 'Announcement not found' });
    }

    // In a real app we might just set active to false
    await announcement.deleteOne();
      
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'delete', id: req.params.id });
    }

    res.json({ msg: 'Announcement removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Announcement not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/announcements/:id
// @desc    Update an announcement
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || 
    ((req.user.role === 'SubAdmin' || req.user.role === 'Member') && req.user.permissions && req.user.permissions.some(p => p.startsWith('Announcements')));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  const { title, message, phases, targetAudience, image } = req.body;

  try {
    let announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ msg: 'Announcement not found' });
    }

    if (title) announcement.title = title;
    if (message !== undefined) announcement.message = message;
    if (phases !== undefined) announcement.phases = phases;
    if (targetAudience !== undefined) announcement.targetAudience = targetAudience;
    if (image !== undefined) announcement.image = image;

    await announcement.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'update', data: announcement });
    }

    res.json({ msg: 'Announcement updated successfully', announcement });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Announcement not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
