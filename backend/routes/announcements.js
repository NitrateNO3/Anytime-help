const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// @route   GET api/announcements
// @desc    Get all active announcements
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = { active: true };
    if (req.user.role === 'Resident') {
      const user = await User.findById(req.user.id);
      if (user && user.phase) {
        const parentGroup = user.phase.split(' - ')[0];
        const basePhase = user.phase.split(' - ').slice(0, 2).join(' - ');
        query.phases = { $in: [user.phase, parentGroup, basePhase, 'All', 'Resident', 'Resident + Member'] };
      } else {
        // If user has no phase, fallback to 'All', 'Resident', or empty
        query.$or = [{ phases: 'All' }, { phases: 'Resident' }, { phases: 'Resident + Member' }, { phases: { $size: 0 } }];
      }
      query.targetAudience = { $ne: 'Members' }; // Residents cannot see 'Members' only announcements
    } else if (req.user.role === 'Staff') {
      const user = await User.findById(req.user.id);
      let phasesToMatch = ['All', 'Staff'];
      if (user && user.phase) {
        const parentGroup = user.phase.split(' - ')[0];
        const basePhase = user.phase.split(' - ').slice(0, 2).join(' - ');
        phasesToMatch.push(user.phase, parentGroup, basePhase);
      }
      query.$or = [
        { phases: { $in: phasesToMatch } },
        { createdBy: req.user.id }
      ];
    } else if (req.user.role === 'Member') {
      const user = await User.findById(req.user.id);
      let phasesToMatch = ['All', 'Members', 'Resident + Member', 'Resident'];
      if (user && user.phase) {
        const parentGroup = user.phase.split(' - ')[0];
        const basePhase = user.phase.split(' - ').slice(0, 2).join(' - ');
        phasesToMatch.push(user.phase, parentGroup, basePhase);
        query.$or = [
          { phases: { $in: phasesToMatch } },
          { targetAudience: 'Members' },
          { createdBy: req.user.id }
        ];
      } else {
        query.$or = [
          { phases: { $in: phasesToMatch } },
          { targetAudience: 'Members' },
          { targetAudience: 'All' },
          { createdBy: req.user.id }
        ];
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

    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 20);
    const skip = (pageNum - 1) * limitNum;
    const announcements = await Announcement.find(query)
      .select('-__v')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name')
      .lean();
    const total = await Announcement.countDocuments(query);
    
    const processedAnnouncements = announcements.map(a => {
      let img = a.image;
      if (img && img.includes('cloudinary.com') && !img.includes('upload/f_auto,q_auto')) {
        img = img.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
      }
      
      let modifiedCreatorName = a.creatorName;
      let modifiedCreatedBy = a.createdBy;

      // Clean up creator name for Residents (removes address/designation in parenthesis)
      if (req.user.role === 'Resident') {
        const formatName = (rawName) => {
          if (!rawName) return '';
          if (rawName.includes('(')) return rawName.split('(')[0].trim();
          if (rawName.includes(',')) return rawName.split(',')[0].trim();
          if (rawName.includes('-')) return rawName.split('-')[0].trim();
          return rawName;
        };
        
        if (modifiedCreatedBy && modifiedCreatedBy.name) {
          modifiedCreatedBy = { ...modifiedCreatedBy, name: formatName(modifiedCreatedBy.name) };
        }
        if (modifiedCreatorName) {
          modifiedCreatorName = formatName(modifiedCreatorName);
        }
      }

      return { ...a, image: img, creatorName: modifiedCreatorName, createdBy: modifiedCreatedBy };
    });

    if (!page && !limit) {
      return res.json(processedAnnouncements);
    }
    
    return res.json({ announcements: processedAnnouncements, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
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
    let creatorPhase = null;

    // Fetch from db to guarantee accuracy
    const userObj = await User.findById(req.user.id);
    if (userObj) {
      if (!creatorName) {
        creatorName = userObj.name || req.user.role;
        creatorId = userObj.member_id || '';
      }
      creatorPhase = userObj.phase;
    }

    let finalPhases = phases || [];
    if (!phases || phases.length === 0) {
      if (req.user.role === 'Staff' || req.user.role === 'SubAdmin') {
        if (creatorPhase && creatorPhase !== 'Universal' && creatorPhase !== 'All') {
          finalPhases = [creatorPhase.split(' - ').slice(0, 2).join(' - ')];
        } else {
          finalPhases = ['All'];
        }
      }
    }

    let imageUrl = null;
    if (image && image.startsWith('data:image')) {
      try {
        const result = await cloudinary.uploader.upload(image, {
          folder: 'anytime_help/announcements',
          transformation: [{ quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' }]
        });
        imageUrl = result.secure_url;
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        imageUrl = image; // fallback
      }
    } else if (image) {
      imageUrl = image;
    }

    const newAnnouncement = new Announcement({
      title,
      message,
      createdBy: req.user.id,
      creatorName: creatorName || req.user.role,
      creatorId: creatorId || '',
      phases: finalPhases,
      targetAudience: targetAudience || 'All',
      image: imageUrl
    });

    const announcement = await newAnnouncement.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'create', data: announcement });
    }

    try {
      // Find users to notify
      let userQuery = {};
      const targetPhases = finalPhases || [];
      
      let rolesToNotify = [];
      let isAll = false;
      
      if (targetPhases.includes('All')) {
        isAll = true;
      }

      // Strict routing based on frontend options (Resident(All) vs RWA(Members))
      if (targetAudience === 'Members' || targetPhases.includes('Members')) {
        rolesToNotify = ['Member', 'Staff', 'Admin', 'SubAdmin'];
      } else {
        // 'All' (Resident)
        rolesToNotify = ['Resident', 'Member'];
      }
      
      if (rolesToNotify.length > 0) {
        userQuery.role = { $in: rolesToNotify };
      } else if (isAll) {
        userQuery.role = { $in: ['Resident', 'Member', 'Staff', 'Admin', 'SubAdmin', 'PaidStaff'] };
      } else {
        userQuery.role = { $in: ['Resident', 'Member', 'Staff', 'Admin', 'SubAdmin'] };
      }

      const locationPhases = targetPhases.filter(p => p !== 'All' && p !== 'Resident' && p !== 'Members' && p !== 'Staff' && p !== 'Resident + Member');
      
      if (locationPhases.length > 0) {
        const phaseRegexes = locationPhases.map(p => new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        userQuery.$or = [{ phase: { $in: phaseRegexes } }, { phase: { $exists: false } }, { phase: '' }];
      }
      
      userQuery.expoPushToken = { $exists: true, $ne: '' };

      const User = require('../models/User');
      
      // Increment the unread_notifications for all matching users
      await User.updateMany(userQuery, { $inc: { unread_notifications: 1 } });

      // Retrieve to get push tokens and new unread counts
      const usersToNotify = await User.find(userQuery).select('expoPushToken unread_notifications');
      const tokenObjects = usersToNotify.map(u => ({
        to: u.expoPushToken,
        badge: u.unread_notifications
      }));
      
      if (tokenObjects.length > 0) {
        const { sendPushNotifications } = require('../utils/push');
        // We don't await to not block the API response
        sendPushNotifications(tokenObjects, '📢 ' + title, message, { type: 'announcement', id: announcement._id });
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
