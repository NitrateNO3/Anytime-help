const mongoose = require('mongoose');

const paidServiceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  icon: { type: String, required: true }, // e.g., 'flash', 'water'
  basePrice: { type: String, required: true }, // e.g., 'Paid', '₹500', 'Hourly'
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('PaidService', paidServiceSchema);
