const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        minlength: [3, 'Title must be at least 3 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    blockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Block',
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'under_review', 'in_progress', 'escalated', 'resolved'],
        default: 'open'
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'internet', 'cleanliness', 'security', 'other'],
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    // SLA (Service Level Agreement) fields
    expectedResolutionDate: {
        type: Date,
        default: function() {
            const now = new Date();
            const dayMap = { 'urgent': 1, 'high': 3, 'medium': 7, 'low': 14 };
            const days = dayMap[this.priority] || 7;
            return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        }
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Resolution
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolutionNote: {
        type: String,
        default: null
    },
    // Escalation
    escalatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    escalatedAt: {
        type: Date,
        default: null
    },
    escalationReason: {
        type: String,
        default: null
    },
    // Action history
    history: [{
        action: {
            type: String,
            enum: ['created', 'assigned', 'status_changed', 'escalated', 'resolved', 'note_added'],
            required: true
        },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        fromStatus: String,
        toStatus: String,
        note: String,
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

complaintSchema.index({ user: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ priority: 1 });
complaintSchema.index({ escalatedBy: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ expectedResolutionDate: 1 });
complaintSchema.index({ status: 1, expectedResolutionDate: 1 }); // For SLA breach checks

// Area 5 requested index:
complaintSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
