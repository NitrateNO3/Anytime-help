const mongoose = require('mongoose');

// WhatsApp-style status/story. Posted by Staff into one of their assigned
// categories, visible to everyone in the area, auto-deleted after 24 hours.
const storySchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  // Set when an Official posts the story (category then holds the official's name).
  // Official stories cross areas: they are shown in every area the official is visible in.
  official: { type: mongoose.Schema.Types.ObjectId, ref: 'Official', default: null, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  author_name: { type: String, default: '' },
  // 'image' = photo (+ optional caption), 'text' = text on coloured background
  media_type: { type: String, enum: ['image', 'text'], default: 'image' },
  media_url: { type: String, default: '' },
  public_id: { type: String, default: '' },
  caption: { type: String, default: '', trim: true, maxlength: 700 },
  bg_color: { type: String, default: '#2563EB' },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
}, { timestamps: true });

// MongoDB removes the document once expiresAt passes
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ category: 1, createdAt: 1 });

storySchema.plugin(require('./plugins/areaScope'));

module.exports = mongoose.model('Story', storySchema);
