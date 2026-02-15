const mongoose = require('mongoose')

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
  resourceType: { type: String, required: true },
  amount: { type: Number },
  threshold: { type: Number },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['active', 'resolved', 'ignored'], default: 'active' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

alertSchema.index({ user: 1, status: 1 });
alertSchema.index({ block: 1, status: 1 });

module.exports = mongoose.model('Alert', alertSchema)
