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

    // Notify paid staff via socket
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
// @access  Private (Resident/PaidStaff)
router.get('/me', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Resident') {
      query = { resident: req.user.id };
    } else if (req.user.role === 'PaidStaff') {
      query = { assigned_staff: req.user.id };
    } else if (req.user.role === 'Admin') {
      query = {}; // Admins see all
    }

    const bookings = await ServiceBooking.find(query)
      .populate('service')
      .populate('resident', 'name phone_number address')
      .populate('assigned_staff', 'name phone_number')
      .sort({ createdAt: -1 });
      
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET api/service-bookings/available
// @desc    Get available unassigned bookings for staff's category
// @access  PaidStaff Private
router.get('/available', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PaidStaff') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // We could filter by the staff's assigned_category matching the service's name
    // For simplicity, let's fetch all pending. In production, we'd do a lookup.
    const bookings = await ServiceBooking.find({ status: 'PENDING' })
      .populate('service')
      .populate('resident', 'name address');
      
    // Filter in JS to only those matching the staff's assigned category
    const filtered = bookings.filter(b => b.service.name === req.user.assigned_category);

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/service-bookings/:id/accept
// @desc    Staff accepts a booking
// @access  PaidStaff Private
router.put('/:id/accept', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PaidStaff') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const booking = await ServiceBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'PENDING') return res.status(400).json({ message: 'Booking is no longer available' });

    booking.status = 'ACCEPTED';
    booking.assigned_staff = req.user.id;
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('booking_updated', booking);
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/service-bookings/:id/start
// @desc    Staff verifies start OTP to begin job
// @access  PaidStaff Private
router.put('/:id/start', auth, async (req, res) => {
  try {
    const { otp } = req.body;
    const booking = await ServiceBooking.findById(req.params.id);
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'ACCEPTED') return res.status(400).json({ message: 'Invalid status' });
    if (booking.start_otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    booking.status = 'IN_PROGRESS';
    await booking.save();

    const io = req.app.get('io');
    if (io) io.emit('booking_updated', booking);

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT api/service-bookings/:id/complete
// @desc    Staff verifies end OTP to complete job
// @access  PaidStaff Private
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const { otp } = req.body;
    const booking = await ServiceBooking.findById(req.params.id);
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Invalid status' });
    if (booking.end_otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    booking.status = 'COMPLETED';
    await booking.save();

    const io = req.app.get('io');
    if (io) io.emit('booking_updated', booking);

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
