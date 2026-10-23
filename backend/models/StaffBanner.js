const mongoose = require('mongoose');

const StaffBannerSchema = new mongoose.Schema({
  title: {
    type: String,
    default: '',
    trim: true,
  },
  url: {
    type: String,
    required: true,
  },
  public_id: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  link: {
    type: String,
    default: '',
    trim: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  audience: {
    type: String,
    enum: ['Staff', 'Resident', 'Member'],
    default: 'Staff',
  },
  duration: {
    type: Number,
    default: 4, // Slide duration in seconds (app display time)
    min: 1,
    max: 120,
  },
  expiresAt: {
    type: Date,
    default: null, // Optional expiry date/time
  }
}, { timestamps: true });

module.exports = mongoose.model('StaffBanner', StaffBannerSchema);
