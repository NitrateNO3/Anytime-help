const mongoose = require('mongoose');

const BottomBannerSchema = new mongoose.Schema({
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
    default: '',
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
  targetAudience: {
    type: String,
    enum: ['All', 'Resident', 'Member', 'Staff'],
    default: 'All',
  },
  duration: {
    type: Number,
    default: 4, // Duration in seconds for auto-slider
    min: 1,
    max: 60,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

BottomBannerSchema.index({ targetAudience: 1, isActive: 1, order: 1 });

module.exports = mongoose.model('BottomBanner', BottomBannerSchema);
