const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET api/users/staff
// @desc    Get all staff members (supports pagination)
// @access  Admin Private
router.get('/staff', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { page, limit, phase } = req.query;
    let query = { role: 'Staff' };

    if (phase && phase !== 'All' && phase !== 'All Groups (Show Everything)') {
      if (phase === 'Universal' || phase === 'Universal Staff Only') {
        query.$or = [
          { phase: 'Universal' },
          { phase: 'All' },
          { phase: 'All Groups' },
          { name: { $regex: 'universal', $options: 'i' } }
        ];
      } else if (phase === 'Sushant Lok 2 - C,D,E') {
        query.$or = [
          { phase: 'Sushant Lok 2 - C,D,E' },
          { phase: 'Sushant Lok 2 Option 1' },
          { name: { $regex: 'Sushant Lok 2 - C,D,E', $options: 'i' } }
        ];
      } else if (phase === 'Sushant Lok 2 - F,G') {
        query.$or = [
          { phase: 'Sushant Lok 2 - F,G' },
          { phase: 'Sushant Lok 2 Option 2' },
          { name: { $regex: 'Sushant Lok 2 - F,G', $options: 'i' } }
        ];
      } else {
        query.$or = [
          { phase },
          { name: { $regex: phase, $options: 'i' } }
        ];
      }
    }

    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      const staff = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum);
      const total = await User.countDocuments(query);
      return res.json({ staff, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
    }

    const staff = await User.find(query).select('-password').sort({ createdAt: -1 });
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
// @desc    Get all resident members (supports pagination)
// @access  Admin Private
router.get('/residents', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { page, limit, phase, search, relation } = req.query;
    let query = { role: 'Resident' };
    const andConditions = [];

    if (phase && phase !== 'All Groups (Show Everything)') {
      if (phase === 'Sushant Lok 2 - C,D,E') {
        andConditions.push({ $or: [{ phase: 'Sushant Lok 2 - C,D,E' }, { phase: 'Sushant Lok 2 Option 1' }] });
      } else if (phase === 'Sushant Lok 2 - F,G') {
        andConditions.push({ $or: [{ phase: 'Sushant Lok 2 - F,G' }, { phase: 'Sushant Lok 2 Option 2' }] });
      } else {
        andConditions.push({ phase: phase });
      }
    }

    if (relation && relation !== 'ALL' && relation !== 'All Relations') {
      if (relation.toLowerCase() === 'owner') {
        andConditions.push({
          $or: [
            { relation: { $regex: /^(owner|owned)$/i } },
            { relation: null },
            { relation: { $exists: false } },
            { relation: '' }
          ]
        });
      } else if (relation.toLowerCase() === 'rented') {
        andConditions.push({
          $or: [
            { relation: { $regex: /rent/i } },
            { relation: { $regex: /tenant/i } }
          ]
        });
      } else {
        andConditions.push({ relation: { $regex: new RegExp(relation.trim(), 'i') } });
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      andConditions.push({
        $or: [
          { name: { $regex: s, $options: 'i' } },
          { phone_number: { $regex: s, $options: 'i' } },
          { address: { $regex: s, $options: 'i' } },
          { phase: { $regex: s, $options: 'i' } }
        ]
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    if (page && limit) {
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      const residents = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum);
      const total = await User.countDocuments(query);
      return res.json({ residents, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
    }

    const residents = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(residents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/users/staff
// @desc    Create a new staff member
// @access  Admin Private
router.post('/staff', auth, async (req, res) => {
  let { name, phone_number, assigned_category, phase } = req.body;

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
      assigned_category,
      phase
    });

    await user.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('staff_changed', { action: 'create', data: user });
    }

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
    
    const io = req.app.get('io');
    if (io) {
      io.emit('staff_changed', { action: 'create', data: user });
    }

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
    
    // Emit live event for remote logout and realtime update
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { id: req.params.id });
      if (user.role === 'Staff' || user.role === 'PaidStaff') {
        io.emit('staff_changed', { action: 'delete', id: req.params.id });
      }
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
