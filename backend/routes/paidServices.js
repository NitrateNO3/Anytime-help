const express = require('express');
const router = express.Router();
const PaidService = require('../models/PaidService');
const auth = require('../middleware/auth');

// @route   GET api/paid-services
// @desc    Get all paid services
// @access  Public or Resident
router.get('/', async (req, res) => {
  try {
    const services = await PaidService.find({ isActive: true });
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/paid-services/all
// @desc    Get all paid services (including inactive)
// @access  Admin Private
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const services = await PaidService.find();
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST api/paid-services
// @desc    Create a new paid service
// @access  Admin Private
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { name, icon, basePrice, isActive } = req.body;
    const newService = new PaidService({ name, icon, basePrice, isActive });
    await newService.save();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('service_changed', { action: 'create', data: newService });
    }

    res.status(201).json(newService);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Service with this name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/paid-services/:id
// @desc    Delete a paid service
// @access  Admin Private
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const service = await PaidService.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('service_changed', { action: 'delete', id: req.params.id });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
