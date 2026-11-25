const mongoose = require('mongoose');

// "Sponsored" ad cards on the resident/member home screen. Universal: one set
// for every area, managed only by the platform Super Admin. Deliberately NOT
// area scoped.
const SponsoredAdSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  sub: { type: String, default: '', trim: true },
  icon: { type: String, default: 'megaphone-outline' },
  theme: { type: String, default: 'amber' },
  link: { type: String, default: '', trim: true },
  url: { type: String, default: '' },
  public_id: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

SponsoredAdSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('SponsoredAd', SponsoredAdSchema);
