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

module.exports = mongoose.model('Block', blockSchema);
