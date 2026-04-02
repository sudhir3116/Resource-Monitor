const mongoose = require('mongoose');

const cronLogSchema = new mongoose.Schema({
    jobName: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success',
        index: true
    },
    runAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    duration: {
        type: Number, // duration in milliseconds
        default: 0
    },
    error: {
        type: String
    }
}, { timestamps: true });

// Optional: keep only last 3 months of logs to prevent DB bloat
// cronLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const CronLog = mongoose.model('CronLog', cronLogSchema);

module.exports = CronLog;
