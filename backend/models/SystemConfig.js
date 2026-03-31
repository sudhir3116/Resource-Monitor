const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    resource: {
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
    costPerUnit: { type: Number, required: true, min: 0 }, // alias: rate
    dailyThreshold: { type: Number, required: true, min: 0 },   // alias: dailyLimitPerPerson
    monthlyThreshold: { type: Number, required: true, min: 0 }, // alias: monthlyLimitPerPerson
    isActive: { type: Boolean, default: true },
    icon: { type: String, default: '📊' },
    color: { type: String, default: '#64748b' },

    // — Legacy / thresholdService fields (kept for backward compat) ——
    dailyLimitPerPerson: { type: Number },
    dailyLimitPerBlock: { type: Number },
    monthlyLimitPerPerson: { type: Number },
    monthlyLimitPerBlock: { type: Number },
    rate: { type: Number },                          // kept for budget checks

    // Severity thresholds (% of limit)
    severityThreshold: {
        medium: { type: Number, default: 70 },
        high: { type: Number, default: 90 },
        critical: { type: Number, default: 100 }
    },
    alertLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    spikeThreshold: { type: Number, default: 50 },
    alertsEnabled: { type: Boolean, default: true },

    // — Block-level overrides: { blockId: { dailyThreshold, monthlyThreshold } } —
    blockOverrides: {
        type: Map,
        of: new mongoose.Schema({
            dailyThreshold: { type: Number, min: 0 },
            monthlyThreshold: { type: Number, min: 0 },
            blockName: { type: String }
        }, { _id: false }),
        default: {}
    },

    // Audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Virtual: keep rate in sync with costPerUnit for budget checks
systemConfigSchema.pre('save', function (next) {
    if (this.costPerUnit !== undefined) this.rate = this.costPerUnit;
    if (this.dailyThreshold !== undefined) this.dailyLimitPerPerson = this.dailyThreshold;
    if (this.monthlyThreshold !== undefined) this.monthlyLimitPerPerson = this.monthlyThreshold;
    if (typeof next === 'function') next();
});

systemConfigSchema.pre('findOneAndUpdate', function (next) {
    try {
        const update = this.getUpdate();
        const src = update.$set || update;
        const dst = update.$set || update;

        if (src.costPerUnit !== undefined) dst.rate = src.costPerUnit;
        if (src.dailyThreshold !== undefined) dst.dailyLimitPerPerson = src.dailyThreshold;
        if (src.monthlyThreshold !== undefined) dst.monthlyLimitPerPerson = src.monthlyThreshold;
        if (typeof next === 'function') next();
    } catch (e) {
        if (typeof next === 'function') next();
    }
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
