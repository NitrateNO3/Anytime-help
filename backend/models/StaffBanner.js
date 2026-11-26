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
  },
  // Resident/Member banners only: when `enabled`, tapping the banner opens an
  // "Offer details" page in the app built from these fields.
  offer: {
    enabled: { type: Boolean, default: false },
    theme: { type: String, default: 'teal' },
    tag: { type: String, default: '', trim: true },
    title: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    partnerName: { type: String, default: '', trim: true },
    partnerVerified: { type: Boolean, default: true },
    distance: { type: String, default: '', trim: true },
    rating: { type: Number, default: null },
    ratingCount: { type: Number, default: null },
    points: { type: [String], default: [] },
    validText: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    mapLink: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    terms: { type: [String], default: [] },
    footerLabel: { type: String, default: '', trim: true },
    ctaLabel: { type: String, default: '', trim: true },
    ctaLink: { type: String, default: '', trim: true },
    couponCode: { type: String, default: '', trim: true },
  },
}, { timestamps: true });

StaffBannerSchema.plugin(require('./plugins/areaScope'));

module.exports = mongoose.model('StaffBanner', StaffBannerSchema);
