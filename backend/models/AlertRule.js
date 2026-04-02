const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    resourceType: {
        type: String,
        required: true
    },
    threshold: {
        type: Number,
        required: true
    },
    severity: {
        type: String,
        enum: ['Warning', 'High', 'Critical', 'Severe'],
        default: 'Warning'
    },
    active: {
        type: Boolean,
        default: true
    },
    alertType: {
        type: String,
        enum: ['daily', 'monthly', 'spike', 'budget'],
        default: 'daily'
    }
}, { timestamps: true });

module.exports = mongoose.model('AlertRule', alertRuleSchema);
