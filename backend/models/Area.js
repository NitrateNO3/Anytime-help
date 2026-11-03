const mongoose = require('mongoose');

// An Area is one client / society. All other data is scoped to an area.
const areaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, trim: true, default: '' },
  // 'sector': phases with blocks (block + house no. at registration)
  // 'village': each phase is a village (optional house no. + landmark)
  type: { type: String, enum: ['sector', 'village'], default: 'sector' },
  // Localities residents pick from during registration, e.g.
  // [{ name: 'Sushant Lok 2', blocks: ['C', 'D', 'E'] }]
  phases: [{
    _id: false,
    name: { type: String, required: true, trim: true },
    blocks: { type: [String], default: [] },
  }],
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

areaSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Area', areaSchema);
