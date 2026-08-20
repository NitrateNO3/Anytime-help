const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  phone_number: { type: String, required: true, unique: true },
  firebase_uid: { type: String, required: false },
  role: { type: String, enum: ['Resident', 'Staff', 'Admin'], default: 'Resident' },
  assigned_category: { type: String, required: false }, // Only for Staff (e.g., 'Plumbing')
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
