const mongoose = require('mongoose');

// Public officials (e.g. Parshad / ward councillor) that residents can follow
// from the Community screen. Managed only by the platform Super Admin.
// Not area-scoped by the plugin: the Super Admin picks which areas see each
// official (all_areas, or a list in `areas`).
const officialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  designation: { type: String, default: '', trim: true }, // e.g. 'Parshad', 'MLA'
  ward: { type: String, default: '', trim: true },        // e.g. '21'
  bio: { type: String, default: '', trim: true, maxlength: 300 }, // shown on top of the official's page
  phone: { type: String, default: '', trim: true },
  photo: { type: String, default: '' },
  verified: { type: Boolean, default: true },
  // Visibility: every area, or only the listed areas
  all_areas: { type: Boolean, default: true },
  areas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Area' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  order: { type: Number, default: 100 },
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

officialSchema.index({ order: 1, createdAt: 1 });
officialSchema.index({ followers: 1 });
officialSchema.index({ areas: 1 });

module.exports = mongoose.model('Official', officialSchema);
