const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['Hostel', 'Academic', 'Administrative', 'Service'],
        default: 'Hostel'
    },
    capacity: {
        type: Number,
        required: true,
        default: 0
    },
    warden: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    departments: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['Active', 'Maintenance', 'Closed'],
        default: 'Active'
    },
    // Resource specific meters or IDs can be added here
    meters: {
        electricity_meter_id: String,
        water_meter_id: String
    },
    // Budget Monitoring settings
    monthly_budget: {
        type: Number,
        default: 0
    },
    efficiency_score: {
        type: Number,
        default: 100 // Out of 100
    }
}, { timestamps: true });

// Performance indexes (name index is auto-created by unique:true in schema, no need to duplicate)
blockSchema.index({ warden: 1 });
blockSchema.index({ status: 1 });
blockSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Block', blockSchema);
