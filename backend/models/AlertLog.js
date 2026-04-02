const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
    alertId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Alert'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    block: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Block'
    },
    action: {
        type: String,
        required: true
    }, // e.g., 'TRIGGERED', 'EMAIL_SENT', 'ESCALATED', 'RESOLVED'
    message: {
        type: String
    },
    severity: {
        type: String
    },
    resourceType: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('AlertLog', alertLogSchema);
