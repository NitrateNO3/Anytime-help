const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  group_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ChatGroup', 
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
  }, // 'Member', 'Admin', 'SubAdmin'
  sender_designation: { 
    type: String, 
    default: '' 
  }, // e.g. President, Secretary
  
  // Message Content
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

  // WhatsApp-like reply / quote reference
  reply_to: {
    message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
    sender_name: { type: String },
    text: { type: String }
  },

  // WhatsApp-like edit message tracking
  is_edited: { 
    type: Boolean, 
    default: false 
  },
  edited_at: { 
    type: Date 
  },
  edit_history: [{
    text: { type: String },
    edited_at: { type: Date, default: Date.now }
  }],

  // Soft delete ("This message was deleted")
  is_deleted: { 
    type: Boolean, 
    default: false 
  },
  deleted_at: { 
    type: Date 
  },

  // Read receipts / tracking
  read_by: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { timestamps: true });

chatMessageSchema.index({ group_id: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
