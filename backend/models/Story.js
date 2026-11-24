const mongoose = require('mongoose');

// WhatsApp-style status/story. Posted by Staff into one of their assigned
// categories, visible to everyone in the area, auto-deleted after 24 hours.
const storySchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  // Set when an Official posts the story (category then holds the official's name).
  // Official stories cross areas: they are shown in every area the official is visible in.
  official: { type: mongoose.Schema.Types.ObjectId, ref: 'Official', default: null, index: true },
  // Set when the story is posted on a community channel (category then holds the channel name).
  // Posted by the area admin or the channel's assigned posters; shown to its followers.
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunitySection', default: null, index: true },
  // Story of the area's own official page (one per area, blue tick, always first
  // in the Status bar, shown to everyone in that area). Posted by the area admin.
  area_page: { type: Boolean, default: false, index: true },
  // Pinned stories stay past 24 hours: expiresAt is moved to the pin end.
  // pinned_until null while pinned = pinned until the admin unpins it.
  pinned: { type: Boolean, default: false },
  pinned_until: { type: Date, default: null },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  author_name: { type: String, default: '' },
  // 'image' = photo (+ optional caption), 'text' = text on coloured background
  media_type: { type: String, enum: ['image', 'text'], default: 'image' },
  media_url: { type: String, default: '' },
  public_id: { type: String, default: '' },
  caption: { type: String, default: '', trim: true, maxlength: 700 },
  bg_color: { type: String, default: '#2563EB' },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Who viewed and when (WhatsApp-style "Viewed by" list). `viewers` stays the
  // fast lookup for seen/unseen; older views have no entry here.
  views: [{
    _id: false,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  }],
  // Users who liked (hearted) the story. The author sees who liked in "Viewed by".
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
