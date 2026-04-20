const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    maxlength: [100, 'Title cannot exceed 100 characters'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    maxlength: [2000, 'Content cannot exceed 2000 characters'],
    trim: true
  },
  type: {
    type: String,
    enum: ['GENERAL', 'MAINTENANCE', 'EMERGENCY', 'RESOURCE', 'EVENT'],
    default: 'GENERAL',
    required: true
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM',
    required: true
  },
  targetRole: {
    type: [String],
    default: ['all'],
    enum: ['admin', 'gm', 'warden', 'dean', 'student', 'all'],
    validate: {
      validator: function (v) {
        return v && v.length > 0;
      },
      message: 'At least one target role must be selected'
    }
  },
  targetBlock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
    default: null // null means all blocks
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    required: true,
    default: 'admin' // fallback
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  },
  pinned: {
    type: Boolean,
    default: false
  },
  attachmentUrl: {
    type: String,
    default: null
  },
  // Track views (optional - for future analytics)
  viewCount: {
    type: Number,
    default: 0
  },
  viewers: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  }
}, { timestamps: true });

// Index for efficient queries
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ targetRole: 1 });
announcementSchema.index({ targetBlock: 1 });
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
announcementSchema.index({ pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
