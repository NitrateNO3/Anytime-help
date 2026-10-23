const mongoose = require('mongoose');

const chatGroupSchema = new mongoose.Schema({
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
  group_type: { 
    type: String, 
    trim: true,
    default: 'General' 
  },
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Active member participants who can send & read messages
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  // Specific members who have VIEW-ONLY access to this group (cannot send messages)
  // Example: Member A is in Group A (chatting), but Admin adds Member A to Group B's view_only_members
  // so Member A can view Group B's chat in read-only mode.
  view_only_members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  // Permission 1: Allow ALL other Committee Members to view this chat (Read-Only)
  can_other_members_view: { 
    type: Boolean, 
    default: false 
  },

  // Permission 2: Allow general Residents to view this group chat (Read-Only)
  can_residents_view: { 
    type: Boolean, 
    default: false 
  },

  // Optional targeted resident audience if can_residents_view is true (All, or specific Phase/Block)
  target_phases: [{ 
    type: String 
  }],

  // Cached last message for fast chat list rendering
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

chatGroupSchema.index({ is_active: 1, members: 1 });
chatGroupSchema.index({ is_active: 1, can_other_members_view: 1 });
chatGroupSchema.index({ is_active: 1, can_residents_view: 1 });

module.exports = mongoose.model('ChatGroup', chatGroupSchema);
