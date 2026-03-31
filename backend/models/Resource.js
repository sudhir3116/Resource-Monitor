const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },

    // — Primary fields used by UI ——————————————————————————————————
    unit: { type: String, required: true },          // e.g. 'kWh', 'Liters', 'kg'
    rate: { type: Number, required: true, min: 0 },  // primary storage
    dailyLimit: { type: Number, required: true, min: 0 },
    monthlyLimit: { type: Number, required: true, min: 0 },

    isActive: { type: Boolean, default: true },
    icon: { type: String, default: '📊' },
    color: { type: String, default: '#64748b' },

    // — Severity thresholds ——————————————————————————————————
    severityThreshold: {
        medium: { type: Number, default: 70 },
        high: { type: Number, default: 90 },
        critical: { type: Number, default: 100 }
    },

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure virtuals are included in JSON/Object conversions
resourceSchema.set('toJSON', { virtuals: true });
resourceSchema.set('toObject', { virtuals: true });

// Virtuals for field name compatibility
resourceSchema.virtual('dailyThreshold').get(function () { return this.dailyLimit; });
resourceSchema.virtual('monthlyThreshold').get(function () { return this.monthlyLimit; });
resourceSchema.virtual('costPerUnit').get(function () { return this.rate; });

module.exports = mongoose.model('Resource', resourceSchema);
