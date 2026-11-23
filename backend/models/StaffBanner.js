const mongoose = require('mongoose');

const StaffBannerSchema = new mongoose.Schema({
  title: {
    type: String,
    default: '',
    trim: true,
  },
  // Image is optional for 'card' banners (text card; image then fills the side tile)
  url: {
    type: String,
    default: '',
  },
  public_id: {
    type: String,
    default: '',
  },
  // 'image' = full picture banner, 'card' = text card (tag, title, subtitle, button, icon)
  style: {
    type: String,
    enum: ['image', 'card'],
    default: 'image',
  },
  tag: { type: String, default: '', trim: true },
  subtitle: { type: String, default: '', trim: true },
  ctaLabel: { type: String, default: '', trim: true },
  icon: { type: String, default: '', trim: true },
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

StaffBannerSchema.plugin(require('./plugins/areaScope'));

module.exports = mongoose.model('StaffBanner', StaffBannerSchema);
