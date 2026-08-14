const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Resident', 'Staff', 'Admin'], default: 'Resident' },
  assigned_category: { type: String, required: false }, // Only for Staff (e.g., 'Plumbing')
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
