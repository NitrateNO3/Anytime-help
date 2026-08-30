const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: false, unique: true, sparse: true },
  password: { type: String, required: false },
  phone_number: { type: String, required: false, unique: true, sparse: true },
  firebase_uid: { type: String, required: false },
  role: { type: String, enum: ['Resident', 'Staff', 'Admin', 'PaidStaff'], default: 'Resident' },
  assigned_category: { type: String, required: false }, // Only for Staff (e.g., 'Plumbing')
  address: { type: String, required: false }, // For Resident
  relation: { type: String, required: false }, // e.g., 'Tenant', 'Family Member'
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
