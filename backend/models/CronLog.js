/**
 * models/CronLog.js
 * Tracks every cron job run for observability and admin inspection.
 * A compound index on { jobName, runAt } makes fetching the last N runs
 * per job fast, and allows the admin route to sort efficiently.
 */
const mongoose = require('mongoose');

const cronLogSchema = new mongoose.Schema({
    jobName: {
        type: String,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        required: true,
    },
    runAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    duration: {
        type: Number, // milliseconds
        default: 0,
    },
    error: {
        type: String,
        default: null,
    },
}, {
    timestamps: false,
    collection: 'cronlogs',
});

// Compound index — enables efficient "last 30 runs per job" queries
cronLogSchema.index({ jobName: 1, runAt: -1 });

module.exports = mongoose.model('CronLog', cronLogSchema);
