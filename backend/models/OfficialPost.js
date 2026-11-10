const mongoose = require('mongoose');

// An update posted on an official's page (e.g. "Road resurfacing on SL-2 main road").
// Universal like Official itself: NOT area-scoped. Posted only by the Super Admin.
const officialPostSchema = new mongoose.Schema({
  official: { type: mongoose.Schema.Types.ObjectId, ref: 'Official', required: true, index: true },
  text: { type: String, default: '', trim: true, maxlength: 3000 },
  image_url: { type: String, default: '' },
  public_id: { type: String, default: '' },
  reactions: {
    like: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    love: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    celebrate: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

officialPostSchema.index({ official: 1, createdAt: -1 });

module.exports = mongoose.model('OfficialPost', officialPostSchema);
