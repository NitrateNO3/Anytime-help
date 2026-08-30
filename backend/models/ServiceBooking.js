const mongoose = require('mongoose');

const serviceBookingSchema = new mongoose.Schema({
  resident: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'PaidService', required: true },
  assigned_staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  description: { type: String, required: true },
  preferred_time: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 
    default: 'PENDING' 
  },
  start_otp: { type: String, required: true },
  end_otp: { type: String, required: true },
  address: { type: String, required: true }, // Snapshotted from resident at time of booking
}, { timestamps: true });

module.exports = mongoose.model('ServiceBooking', serviceBookingSchema);
