const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    blockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Block',
        required: false // Null means Global/Campus-wide
    },
    resourceType: {
        type: String,
        required: true,
        enum: ['Electricity', 'Water', 'LPG', 'Diesel', 'Food', 'Waste']
    },
    period: {
        month: { type: Number, required: true }, // 1-12
        year: { type: Number, required: true }  // e.g. 2024
    },
    metrics: {
        totalConsumption: { type: Number, default: 0 },
        averageDaily: { type: Number, default: 0 },
        peakUsage: { type: Number, default: 0 },
        totalCost: { type: Number, default: 0 },
        efficiencyScore: { type: Number, default: 0 }, // 0-100
        grade: { type: String, enum: ['A+', 'A', 'B', 'C', 'D', 'F'], default: 'C' }
    },
    trend: {
        percentageChange: { type: Number, default: 0 }, // vs previous month
        direction: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' }
    },
    meta: {
        studentCount: { type: Number, default: 0 }, // For per-capita normalization
        perCapitaUsage: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Ensure unique record per block-resource-period
analyticsSchema.index({ blockId: 1, resourceType: 1, "period.year": 1, "period.month": 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);
