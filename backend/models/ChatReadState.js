const mongoose = require('mongoose');

// When a user last read a chat group. Unread count = messages from others
// created after this time (WhatsApp-style "last read" marker, so no per-message
// read arrays need updating).
const chatReadStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatGroup', required: true },
  last_read_at: { type: Date, required: true },
}, { timestamps: true });

chatReadStateSchema.index({ user: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('ChatReadState', chatReadStateSchema);
