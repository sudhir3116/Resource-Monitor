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

    // — Threshold monitoring features ——————————————————————————————
    severityThreshold: {
        medium: { type: Number, default: 70 },
        high: { type: Number, default: 90 },
        critical: { type: Number, default: 100 }
    },
    spikeThreshold: { type: Number, default: 50 },
    alertsEnabled: { type: Boolean, default: true },

    // — Block-level overrides ——————————————————————————————————————
    blockOverrides: {
        type: Map,
        of: new mongoose.Schema({
            dailyThreshold: { type: Number, min: 0 },
            monthlyThreshold: { type: Number, min: 0 },
            blockName: { type: String }
        }, { _id: false }),
        default: {}
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Ensure virtuals are included in JSON/Object conversions
resourceConfigSchema.set('toJSON', { virtuals: true });
resourceConfigSchema.set('toObject', { virtuals: true });

// Virtuals for field name compatibility (backward compatibility with legacy threshold modules)
resourceConfigSchema.virtual('rate').get(function () { return this.costPerUnit; }).set(function (v) { this.costPerUnit = v; });
resourceConfigSchema.virtual('dailyThreshold').get(function () { return this.dailyLimit; }).set(function (v) { this.dailyLimit = v; });
resourceConfigSchema.virtual('monthlyThreshold').get(function () { return this.monthlyLimit; }).set(function (v) { this.monthlyLimit = v; });
resourceConfigSchema.virtual('resource').get(function () { return this.name; }).set(function (v) { this.name = v; });

const ResourceConfig = mongoose.model('ResourceConfig', resourceConfigSchema);

module.exports = ResourceConfig;
