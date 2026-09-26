const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  creatorName: {
    type: String,
    required: false
  },
  creatorId: {
    type: String,
    required: false
  },
  phases: {
    type: [String],
    default: []
  },
  targetAudience: {
    type: String,
    enum: ['All', 'Members'],
    default: 'All'
  },
  image: {
    type: String, // Base64 or URL
    required: false
  }
});

module.exports = mongoose.model('Announcement', AnnouncementSchema);
