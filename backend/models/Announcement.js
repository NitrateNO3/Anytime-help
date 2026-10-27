const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false,
    default: 'Notice'
  },
  message: {
    type: String,
    required: false,
    default: ''
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
  targetLocations: [{
    phase: {
      type: String,
      required: false
    },
    blocks: {
      type: [String],
      default: []
    }
  }],
  targetAudience: {
    type: String,
    enum: ['All', 'Members', 'Resident'],
    default: 'All'
  },
  image: {
    type: String, // Base64 or URL
    required: false
  }
});

AnnouncementSchema.index({ active: 1, date: -1 });
AnnouncementSchema.index({ phases: 1 });
AnnouncementSchema.index({ 'targetLocations.phase': 1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
