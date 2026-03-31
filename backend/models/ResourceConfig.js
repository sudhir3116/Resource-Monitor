const mongoose = require('mongoose');

const resourceConfigSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },
    unit: { type: String, required: true },
    dailyLimit: { type: Number, default: 100 },
    monthlyLimit: { type: Number, default: 3000 },
    icon: { type: String },
    color: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    costPerUnit: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ResourceConfig', resourceConfigSchema);
