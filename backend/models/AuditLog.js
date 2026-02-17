const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // Action details
    action: {
        type: String,
        required: true,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'RESOLVE_ALERT', 'REVIEW_ALERT', 'UPDATE_THRESHOLD']
    },

    // Resource being modified
    resourceType: {
        type: String,
        required: true,
        enum: ['Usage', 'User', 'Block', 'Alert', 'SystemConfig', 'Auth']
    },
    resourceId: { type: mongoose.Schema.Types.ObjectId },

    // Who performed the action
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // What changed
    changes: {
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed }
    },

    // Additional context
    description: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },

    // Metadata
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: false // Only need createdAt, not updatedAt
});

// Indexes for efficient queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
