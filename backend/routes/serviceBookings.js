const express = require('express');
const router = express.Router();
const ServiceBooking = require('../models/ServiceBooking');
const auth = require('../middleware/auth');

// @route   POST api/service-bookings
// @desc    Create a new service booking
// @access  Resident Private
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Resident') {
      return res.status(403).json({ message: 'Only residents can book services' });
    }

    const { service, description, preferred_time, address } = req.body;

    // Generate random 4-digit OTPs
    const start_otp = Math.floor(1000 + Math.random() * 9000).toString();
    const end_otp = Math.floor(1000 + Math.random() * 9000).toString();

    const booking = new ServiceBooking({
      resident: req.user.id,
      service,
      description,
      preferred_time,
      address,
      start_otp,
      end_otp
    });

    await booking.save();
    
    // Populate service details for real-time broadcast
    await booking.populate('service');
    await booking.populate('resident', 'name phone_number address');

    // Notify admin dashboard via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('new_service_booking', booking);
    }

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/service-bookings/me
// @desc    Get user's service bookings
// @access  Private (Resident/Admin)
router.get('/me', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Resident') {
      query = { resident: req.user.id };
    } else if (req.user.role === 'Admin') {
      query = {}; // Admins see all
    }

    const pageNum = parseInt(req.query.page || '1', 10);
    const limitNum = Math.min(parseInt(req.query.limit || '15', 10), 20);
    const skip = (pageNum - 1) * limitNum;

    const bookings = await ServiceBooking.find(query)
      .select('-__v')
      .populate('service')
      .populate('resident', 'name phone_number address')
      .populate('assigned_staff', 'name phone_number')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
      
    const total = await ServiceBooking.countDocuments(query);
    
    if (!req.query.page && !req.query.limit) return res.json(bookings);
    
    res.json({ bookings, total, page: pageNum, totalPages: Math.ceil(total / limitNum) || 1 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE api/service-bookings/:id
// @desc    Delete a service booking
// @access  Admin Private
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only admins can delete bookings' });
    }
    const booking = await ServiceBooking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
