const mongoose = require('mongoose');

const paidServiceSchema = new mongoose.Schema({
  name: { type: String, required: true }, // unique per area, see index below
  icon: { type: String, required: true }, // e.g., 'flash', 'water'
  basePrice: { type: String, required: true }, // e.g., 'Paid', '₹500', 'Hourly'
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

paidServiceSchema.plugin(require('./plugins/areaScope'));
paidServiceSchema.index({ area: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PaidService', paidServiceSchema);
