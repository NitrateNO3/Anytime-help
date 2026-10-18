const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: false, default: '' },
  image: { type: String, default: null },
  role: { type: String, required: true }, // 'Resident' or 'Staff'
  created_at: { type: Date, default: Date.now }
});

const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: false,
  },
  category: {
    type: String,
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  before_image: {
    type: String, // Base64 string for now since we skipped Cloudinary
    required: false,
  },
  after_image: {
    type: String,
    default: null,
  },
  phase: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'DONE'],
    default: 'PENDING',
  },
  status_priority: {
    type: Number,
    default: 1,
    index: true,
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
  },
  assigned_staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolved_by_name: {
    type: String,
    default: null
  },
  resolved_at: {
    type: Date,
    default: null
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [replySchema],
  complaint_id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  is_escalated: {
    type: Boolean,
    default: false,
    index: true
  },
  escalated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  escalated_by_name: {
    type: String,
    default: null
  },
  escalated_by_phone: {
    type: String,
    default: null
  },
  escalated_at: {
    type: Date,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

complaintSchema.pre('save', async function () {
  // Always calculate status_priority based on status and is_escalated:
  // If DONE or RESOLVED: always priority 3 (bottom of stack, even if escalated)
  // If active (PENDING / IN_PROGRESS) and escalated: priority 0 (top of stack)
  // If normal PENDING: priority 1
  // If normal IN_PROGRESS: priority 2
  if (this.status === 'DONE' || this.status === 'RESOLVED') {
    this.status_priority = 3;
  } else if (this.is_escalated) {
    this.status_priority = 0;
  } else if (this.status === 'PENDING') {
    this.status_priority = 1;
  } else if (this.status === 'IN_PROGRESS') {
    this.status_priority = 2;
  } else {
    this.status_priority = 4;
  }

  if (this.isNew && !this.complaint_id) {
    try {
      const Counter = require('./Counter');
      const counter = await Counter.findByIdAndUpdate(
        'complaint_id',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.complaint_id = `AH-${counter.seq}`;
    } catch (err) {
      console.error('Counter error in complaint pre-save:', err);
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      this.complaint_id = `AH-${Date.now().toString().slice(-4)}${randomPart}`;
    }
  }
});

complaintSchema.index({ user: 1 });
complaintSchema.index({ status: 1, created_at: -1 });
complaintSchema.index({ status_priority: 1, created_at: -1 });
complaintSchema.index({ is_escalated: -1, status_priority: 1, created_at: -1 });
complaintSchema.index({ department: 1, status: 1 });
complaintSchema.index({ assigned_staff: 1, status: 1 });
complaintSchema.index({ category: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
