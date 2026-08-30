const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET api/users/staff
// @desc    Get all staff members
// @access  Admin Private
router.get('/staff', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const staff = await User.find({ role: 'Staff' }).select('-password');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/paid-staff
// @desc    Get all paid staff members
// @access  Admin Private
router.get('/paid-staff', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const staff = await User.find({ role: 'PaidStaff' }).select('-password');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/users/residents
// @desc    Get all resident members
// @access  Admin Private
router.get('/residents', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const residents = await User.find({ role: 'Resident' }).select('-password').sort({ createdAt: -1 });
    res.json(residents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/staff
// @desc    Create a new staff member
// @access  Admin Private
router.post('/staff', auth, async (req, res) => {
  let { name, phone_number, assigned_category } = req.body;

  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!phone_number.startsWith('+')) {
      phone_number = `+91${phone_number}`;
    }

    let user = await User.findOne({ phone_number });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      name,
      phone_number,
      role: 'Staff',
      assigned_category
    });

    await user.save();
    
    res.status(201).json({
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
      assigned_category: user.assigned_category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/paid-staff
// @desc    Create a new paid staff member
// @access  Admin Private
router.post('/paid-staff', auth, async (req, res) => {
  let { name, phone_number, assigned_category } = req.body;

  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!phone_number.startsWith('+')) {
      phone_number = `+91${phone_number}`;
    }

    let user = await User.findOne({ phone_number });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      name,
      phone_number,
      role: 'PaidStaff',
      assigned_category
    });

    await user.save();
    
    res.status(201).json({
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
      assigned_category: user.assigned_category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/users/:id
// @desc    Delete a user
// @access  Admin Private
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Emit live event for remote logout
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { id: req.params.id });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
