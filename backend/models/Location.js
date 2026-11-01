const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  area: {
    type: String,
    required: [true, 'Area is required'],
    trim: true
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, { timestamps: true });

locationSchema.index({ state: 1, city: 1, area: 1, pincode: 1 });
locationSchema.index({ is_active: 1 });

module.exports = mongoose.model('Location', locationSchema);
