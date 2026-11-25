const mongoose = require('mongoose');

// Partner promo card on the resident/member home screen (e.g. a partner
// hospital offer). Universal: one set for every area, managed only by the
// platform Super Admin. Deliberately NOT area scoped.
const PartnerPromoSchema = new mongoose.Schema({
  partnerName: { type: String, default: '', trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  points: { type: [String], default: [] },
  phone: { type: String, default: '', trim: true },
  buttonText: { type: String, default: '', trim: true },
  url: { type: String, default: '' },
  public_id: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

PartnerPromoSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('PartnerPromo', PartnerPromoSchema);
