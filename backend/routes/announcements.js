const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Announcement = require('../models/Announcement');

// @route   GET api/announcements
// @desc    Get all active announcements
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const announcements = await Announcement.find({ active: true }).sort({ date: -1 });
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
  if (req.user.role !== 'Admin' && req.user.role !== 'Staff') {
    return res.status(403).json({ msg: 'Authorization denied, admin or staff only' });
  }

  const { title, message } = req.body;

  try {
    const newAnnouncement = new Announcement({
      title,
      message,
      createdBy: req.user.id
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
  if (req.user.role !== 'Admin' && req.user.role !== 'Staff') {
    return res.status(403).json({ msg: 'Authorization denied, admin or staff only' });
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
