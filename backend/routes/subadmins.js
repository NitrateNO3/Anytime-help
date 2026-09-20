const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/subadmins
// @desc    Create a new Sub-Admin
// @access  Private (Super Admin only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can create Sub-Admins' });
    }

    const { email, password, name, permissions } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    user = new User({
      name: name || 'Sub-Admin',
      email,
      password,
      role: 'SubAdmin',
      permissions: permissions || []
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    res.json({ message: 'Sub-Admin created successfully', user: { _id: user._id, email: user.email, name: user.name, role: user.role, permissions: user.permissions } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/subadmins
// @desc    Get all Sub-Admins
// @access  Private (Super Admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const subAdmins = await User.find({ role: 'SubAdmin' }).select('-password');
    res.json(subAdmins);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/subadmins/:id
// @desc    Delete a Sub-Admin
// @access  Private (Super Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'SubAdmin') {
      return res.status(400).json({ message: 'Cannot delete non-SubAdmin users from this route' });
    }

    await user.deleteOne();
    res.json({ message: 'Sub-Admin deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
