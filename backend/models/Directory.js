const mongoose = require('mongoose');

const DirectorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String, required: true },
  icon: { type: String, default: 'call' },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Directory', DirectorySchema);