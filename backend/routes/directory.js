const express = require('express');
const router = express.Router();
const Directory = require('../models/Directory');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET /api/directory
// @desc    Get all directory contacts
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Resident') {
      const user = await User.findById(req.user.id);
      if (user && user.phase) {
        query.phases = { $in: [user.phase, 'All'] };
      } else {
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
      const directories = await Directory.find(query).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limitNum);
      const total = await Directory.countDocuments(query);
      return res.json({ directory: directories, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
    }

    const directories = await Directory.find(query).sort({ order: 1, createdAt: -1 });
    res.json(directories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/directory
// @desc    Create a directory contact
router.post('/', auth, async (req, res) => {
  const { name, role, phone, icon, order, phases } = req.body;

  try {
    const directory = new Directory({
      name,
      role,
      phone,
      icon: icon || 'call',
      order: order || 0,
      phases: phases || []
    });

    await directory.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('directory_updated', { action: 'create', data: directory });
    }

    res.json(directory);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/directory/:id
// @desc    Update a directory contact
router.put('/:id', auth, async (req, res) => {
  const { name, role, phone, icon, order, phases } = req.body;

  try {
    let directory = await Directory.findById(req.params.id);
    if (!directory) return res.status(404).json({ msg: 'Contact not found' });

    if (name) directory.name = name;
    if (role !== undefined) directory.role = role;
    if (phone) directory.phone = phone;
    if (icon) directory.icon = icon;
    if (order !== undefined) directory.order = order;
    if (phases !== undefined) directory.phases = phases;

    await directory.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('directory_updated', { action: 'update', data: directory });
    }

    res.json(directory);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/directory/:id
// @desc    Delete a directory contact
router.delete('/:id', auth, async (req, res) => {
  try {
    let directory = await Directory.findById(req.params.id);
    if (!directory) return res.status(404).json({ msg: 'Contact not found' });

    await Directory.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('directory_updated', { action: 'delete', id: req.params.id });
    }

    res.json({ msg: 'Contact removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;