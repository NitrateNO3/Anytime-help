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

// @route   POST api/users/staff
// @desc    Create a new staff member
// @access  Admin Private
router.post('/staff', auth, async (req, res) => {
  let { name, phone_number, assigned_category } = req.body;

  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Ensure phone number starts with +91 to match auth logic
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
    
    // Return the created user
    const userToReturn = {
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
      assigned_category: user.assigned_category
    };

    res.status(201).json(userToReturn);
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
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
