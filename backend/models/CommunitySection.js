const mongoose = require('mongoose');

const communitySectionSchema = new mongoose.Schema({
  community_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Community', 
    required: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  icon: { 
    type: String, 
    default: 'megaphone' 
  },
  // Section type: 'announcement' = Admin broadcasts updates, 'discussion' = Admin + Assigned members can post
  section_type: { 
    type: String, 
    enum: ['announcement', 'discussion'], 
    default: 'announcement' 
  },
  // Assigned members who have specific posting/moderator rights in THIS section ONLY.
  // Adding a user here does NOT give them access to other sections in the community.
  assigned_members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  // Followers: users who followed this section for visible read access only.
  followers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  // Cached last message for fast list rendering
  last_message: {
    text: { type: String, default: '' },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sender_name: { type: String, default: '' },
    sender_role: { type: String, default: '' },
    timestamp: { type: Date }
  },
  is_active: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

communitySectionSchema.index({ community_id: 1, is_active: 1 });
communitySectionSchema.index({ followers: 1 });
communitySectionSchema.index({ assigned_members: 1 });

module.exports = mongoose.model('CommunitySection', communitySectionSchema);
