const mongoose = require('mongoose');

// Public officials (e.g. Parshad / ward councillor) that residents can follow
// from the Community screen. Managed only by the platform Super Admin.
// Universal: NOT area-scoped, so every area sees the same officials.
const officialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  designation: { type: String, default: '', trim: true }, // e.g. 'Parshad', 'MLA'
  ward: { type: String, default: '', trim: true },        // e.g. '21'
  phone: { type: String, default: '', trim: true },
  photo: { type: String, default: '' },
  verified: { type: Boolean, default: true },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  order: { type: Number, default: 100 },
  is_active: { type: Boolean, default: true },
}, { timestamps: true });

officialSchema.index({ order: 1, createdAt: 1 });
officialSchema.index({ followers: 1 });

module.exports = mongoose.model('Official', officialSchema);
