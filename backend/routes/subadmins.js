const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { runUnscoped } = require('../utils/areaContext');

// Sub-Admins sign in to the admin panel with an OTP sent to their phone number
// (see /api/auth/admin/send-otp), so the number is their login ID.
const cleanPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return d.length === 10 ? `+91${d}` : null;
};

// A number can belong to only one Sub-Admin (across all areas)
const phoneTakenBy = (phone, exceptId) => runUnscoped(() => User.findOne({
  role: 'SubAdmin',
  phone_number: { $in: [phone, phone.replace(/^\+91/, '')] },
  ...(exceptId ? { _id: { $ne: exceptId } } : {}),
}).select('name').lean().exec());

const publicSubAdmin = (u) => ({ _id: u._id, email: u.email, phone_number: u.phone_number, name: u.name, role: u.role, permissions: u.permissions });

// @route   POST api/subadmins
// @desc    Create a new Sub-Admin
// @access  Private (Super Admin only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: Only Super Admin can create Sub-Admins' });
    }

    const { name, phone_number, permissions } = req.body;
    const phone = cleanPhone(phone_number);
    if (!phone) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    const taken = await phoneTakenBy(phone);
    if (taken) {
      return res.status(400).json({ message: `This number is already used by Sub-Admin "${taken.name || 'Sub-Admin'}"` });
    }

    const user = new User({
      name: name || 'Sub-Admin',
      phone_number: phone,
      role: 'SubAdmin',
      permissions: permissions || []
    });

    await user.save();
    res.json({ message: 'Sub-Admin created successfully', user: publicSubAdmin(user) });
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

// @route   PUT api/subadmins/:id
// @desc    Update a Sub-Admin
// @access  Private (Super Admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, phone_number, permissions } = req.body;
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'SubAdmin') {
      return res.status(400).json({ message: 'Cannot edit non-SubAdmin users from this route' });
    }

    if (phone_number !== undefined) {
      const phone = cleanPhone(phone_number);
      if (!phone) return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
      const taken = await phoneTakenBy(phone, user._id);
      if (taken) return res.status(400).json({ message: `This number is already used by Sub-Admin "${taken.name || 'Sub-Admin'}"` });
      user.phone_number = phone;
    }

    user.name = name || user.name;
    user.permissions = permissions || user.permissions;

    await user.save();
    res.json({ message: 'Sub-Admin updated successfully', user: publicSubAdmin(user) });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
