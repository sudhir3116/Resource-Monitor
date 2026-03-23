const mongoose = require('mongoose');

const resourceConfigSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    unit: { type: String, required: true },
    dailyLimit: { type: Number, default: 100 },
    monthlyLimit: { type: Number, default: 3000 },
    icon: { type: String },
    color: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ResourceConfig', resourceConfigSchema);
