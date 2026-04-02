const mongoose = require('mongoose');

const resourceConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    unit: {
        type: String,
        required: true
    },
    dailyLimit: {
        type: Number,
        required: true,
        min: 0
    },
    monthlyLimit: {
        type: Number,
        required: true,
        min: 0
    },
    costPerUnit: {
        type: Number,
        required: true,
        min: 0
    },
    icon: {
        type: String,
        default: '📊'
    },
    color: {
        type: String,
        default: '#64748b'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

const ResourceConfig = mongoose.model('ResourceConfig', resourceConfigSchema);

module.exports = ResourceConfig;
