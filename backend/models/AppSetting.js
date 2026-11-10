const mongoose = require('mongoose');

// Platform-wide settings (not area scoped). One document per key.
const appSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('AppSetting', appSettingSchema);
