const express = require('express');
const router = express.Router();
const Directory = require('../models/Directory');
const auth = require('../middleware/auth');

// @route   GET /api/directory
// @desc    Get all directory contacts
router.get('/', async (req, res) => {
  try {
    const directories = await Directory.find().sort({ order: 1, createdAt: -1 });
    res.json(directories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/directory
// @desc    Create a directory contact
router.post('/', auth, async (req, res) => {
  const { name, role, phone, icon, order } = req.body;

  try {
    const directory = new Directory({
      name,
      role,
      phone,
      icon: icon || 'call',
      order: order || 0
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
  const { name, role, phone, icon, order } = req.body;

  try {
    let directory = await Directory.findById(req.params.id);
    if (!directory) return res.status(404).json({ msg: 'Contact not found' });

    if (name) directory.name = name;
    if (role) directory.role = role;
    if (phone) directory.phone = phone;
    if (icon) directory.icon = icon;
    if (order !== undefined) directory.order = order;

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