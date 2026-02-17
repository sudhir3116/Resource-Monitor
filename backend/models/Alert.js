const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' }, // Optional
  resourceType: { type: String, required: true },
  amount: { type: Number },
  threshold: { type: Number },
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical', 'low', 'medium', 'high', 'critical'], // Allow lowercase
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'Reviewed', 'Resolved', 'Dismissed', 'Active'], // Added Active
    default: 'Pending'
  },
  isRead: { type: Boolean, default: false },

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Resolution tracking
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolutionComment: { type: String },

  // Reviewed tracking
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for efficient queries
alertSchema.index({ user: 1, status: 1 });
alertSchema.index({ block: 1, status: 1 });
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ severity: 1, status: 1 });

module.exports = mongoose.model('Alert', alertSchema);
