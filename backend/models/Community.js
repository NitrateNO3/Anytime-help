const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  icon: { 
    type: String, 
    default: 'flash' // default icon identifier (e.g. 'flash' for Electricity, 'water', 'shield', etc.)
  },
  color: {
    type: String,
    default: '#F59E0B' // default accent color (amber/gold for electricity)
  },
  // Role-based visibility
  // 'All' or specific roles: ['Resident', 'Member', 'Staff', 'PaidStaff']
  target_roles: [{ 
    type: String, 
    enum: ['All', 'Resident', 'Member', 'Staff', 'PaidStaff'],
    default: 'All'
  }],
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

communitySchema.index({ is_active: 1, createdAt: -1 });

module.exports = mongoose.model('Community', communitySchema);
