const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: false, unique: true, sparse: true },
  password: { type: String, required: false },
  phone_number: { type: String, required: false, unique: true, sparse: true },
  firebase_uid: { type: String, required: false },
  expoPushToken: { type: String, required: false },
  role: { type: String, enum: ['Resident', 'Staff', 'Admin', 'SubAdmin', 'PaidStaff', 'Member'], default: 'Resident' },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  assigned_category: { type: String, required: false }, // Legacy support
  assigned_categories: { type: [String], default: [] }, // New array for multiple categories
  phase: { type: String, required: false }, // For phase/entity-based routing
  address: { type: String, required: false }, // For Resident/Member
  relation: { type: String, required: false }, // e.g., 'Tenant', 'Family Member'
  designation: { type: String, required: false }, // For Member (e.g. 'President', 'Secretary')
  member_id: { type: String, required: false }, // For Members
  permissions: { type: [String], default: [] }, // For SubAdmin granular access
  family_members: [{
    relation: { type: String },
    name: { type: String },
    phone_number: { type: String }
  }],
  has_logged_in: { type: Boolean, default: false },
  last_login_at: { type: Date, required: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
