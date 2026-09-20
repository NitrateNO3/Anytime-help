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
        query.phases = { $in: [user.phase, 'All'] };
      } else {
        // If user has no phase, maybe fallback to 'All' or empty
        query.$or = [{ phases: 'All' }, { phases: { $size: 0 } }];
      }
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

    const { page, limit } = req.query;
    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      const announcements = await Announcement.find(query).sort({ date: -1 }).skip(skip).limit(limitNum);
      const total = await Announcement.countDocuments(query);
      return res.json({ announcements, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
    }

    const announcements = await Announcement.find(query).sort({ date: -1 });
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
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || (req.user.role === 'SubAdmin' && req.user.permissions && req.user.permissions.includes('Announcements'));
  if (!hasAccess) {
    return res.status(403).json({ msg: 'Authorization denied' });
  }

  const { title, message, phases } = req.body;

  try {
    const newAnnouncement = new Announcement({
      title,
      message,
      createdBy: req.user.id,
      phases: phases || []
    });

    const announcement = await newAnnouncement.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('announcement_changed', { action: 'create', data: announcement });
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
  const hasAccess = req.user.role === 'Admin' || req.user.role === 'Staff' || (req.user.role === 'SubAdmin' && req.user.permissions && req.user.permissions.includes('Announcements'));
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

module.exports = router;
