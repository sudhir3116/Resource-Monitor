const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    resource: {
        type: String,
        required: true,
        unique: true,
        enum: ['Electricity', 'Water', 'LPG', 'Diesel', 'Food', 'Waste']
    },
    // Daily limits
    dailyLimitPerPerson: { type: Number, required: true }, // e.g., 5 kWh per student
    dailyLimitPerBlock: { type: Number }, // e.g., 500 kWh per block (optional)

    // Monthly limits
    monthlyLimitPerPerson: { type: Number }, // e.g., 150 kWh per student per month
    monthlyLimitPerBlock: { type: Number }, // e.g., 15000 kWh per block per month

    unit: { type: String, required: true }, // e.g., 'kWh', 'Liters', 'kg'
    rate: { type: Number, required: true }, // Cost per unit in INR

    // Severity thresholds (percentage of limit to trigger alerts)
    severityThreshold: {
        medium: { type: Number, default: 70 }, // 70% usage triggers warning
        high: { type: Number, default: 90 },   // 90% usage triggers high alert
        critical: { type: Number, default: 100 } // 100%+ triggers critical alert
    },

    // Alert level configuration
    alertLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },

    // Spike detection threshold (percentage increase over average)
    spikeThreshold: { type: Number, default: 50 }, // 50% spike triggers alert

    // Enable/disable alerts for this resource
    alertsEnabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
