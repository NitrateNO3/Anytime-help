const mongoose = require('mongoose');

const communityMessageSchema = new mongoose.Schema({
  community_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Community', 
    required: true, 
    index: true 
  },
  section_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CommunitySection', 
    required: true, 
    index: true 
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  sender_name: { 
    type: String, 
    required: true 
  },
  sender_role: { 
    type: String, 
    required: true 
  }, // 'Admin', 'SubAdmin', 'Member', 'Resident'
  sender_designation: { 
    type: String, 
    default: '' 
  },
  text: { 
    type: String, 
    required: true, 
    trim: true 
  },
  attachments: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video', 'audio', 'file'], default: 'image' },
    name: { type: String }
  }],
  reply_to: {
    message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMessage' },
    sender_name: { type: String },
    text: { type: String }
  },
  is_edited: { 
    type: Boolean, 
    default: false 
  },
  edited_at: { 
    type: Date 
  },
  is_deleted: { 
    type: Boolean, 
    default: false 
  },
  deleted_at: { 
    type: Date 
  },
  read_by: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { timestamps: true });

communityMessageSchema.index({ section_id: 1, createdAt: 1 });

module.exports = mongoose.model('CommunityMessage', communityMessageSchema);
