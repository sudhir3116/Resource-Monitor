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
        enum: ['low', 'medium', 'high'],
        default: 'medium'
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
complaintSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
