const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/subadmins
// @desc    Create a new Super Admin or Sub-Admin
// @access  Private (Super Admin only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can manage admin accounts' });
    }

    const { email, password, name, permissions, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: cleanEmail });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const targetRole = role === 'Admin' ? 'Admin' : 'SubAdmin';

    user = new User({
      name: name || (targetRole === 'Admin' ? 'Super Admin' : 'Sub-Admin'),
      email: cleanEmail,
      password,
      role: targetRole,
      permissions: targetRole === 'Admin' ? [] : (permissions || [])
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    res.json({ 
      message: `${targetRole === 'Admin' ? 'Super Admin' : 'Sub-Admin'} created successfully`, 
      user: { 
        _id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        permissions: user.permissions 
      } 
    });
  } catch (err) {
    console.error('Error creating admin:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/subadmins
// @desc    Get all Super Admins and Sub-Admins
// @access  Private (Super Admin only)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const admins = await User.find({ role: { $in: ['Admin', 'SubAdmin'] } })
      .select('-password')
      .sort({ role: 1, createdAt: -1 });
    res.json(admins);
  } catch (err) {
    console.error('Error fetching admins:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/subadmins/:id
// @desc    Delete a Sub-Admin or another Super Admin
// @access  Private (Super Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own admin account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['Admin', 'SubAdmin'].includes(user.role)) {
      return res.status(400).json({ message: 'Cannot delete non-admin users from this route' });
    }

    // Safety: ensure at least one Super Admin remains
    if (user.role === 'Admin') {
      const remainingAdmins = await User.countDocuments({ role: 'Admin', _id: { $ne: user._id } });
      if (remainingAdmins === 0) {
        return res.status(400).json({ message: 'Cannot delete the only remaining Super Admin account' });
      }
    }

    await user.deleteOne();
    res.json({ message: `${user.role === 'Admin' ? 'Super Admin' : 'Sub-Admin'} deleted successfully` });
  } catch (err) {
    console.error('Error deleting admin:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/subadmins/:id
// @desc    Update a Super Admin or Sub-Admin
// @access  Private (Super Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, email, password, permissions, role } = req.body;
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['Admin', 'SubAdmin'].includes(user.role)) {
      return res.status(400).json({ message: 'Cannot edit non-admin users from this route' });
    }

    if (role && ['Admin', 'SubAdmin'].includes(role)) {
      // Prevent self-demotion if they are the only remaining Super Admin
      if (user.role === 'Admin' && role === 'SubAdmin') {
        const remainingAdmins = await User.countDocuments({ role: 'Admin', _id: { $ne: user._id } });
        if (remainingAdmins === 0) {
          return res.status(400).json({ message: 'Cannot demote the only remaining Super Admin account' });
        }
      }
      user.role = role;
    }

    if (name) user.name = name;
    if (email) user.email = email.trim().toLowerCase();
    
    if (user.role === 'SubAdmin') {
      user.permissions = permissions !== undefined ? permissions : user.permissions;
    } else {
      user.permissions = [];
    }

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password.trim(), salt);
    }

    await user.save();
    res.json({ 
      message: `${user.role === 'Admin' ? 'Super Admin' : 'Sub-Admin'} updated successfully`, 
      user: { 
        _id: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        permissions: user.permissions 
      } 
    });
  } catch (err) {
    console.error('Error updating admin:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
