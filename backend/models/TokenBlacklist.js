/**
 * models/TokenBlacklist.js
 * Stores invalidated JWT tokens (e.g., from logout).
 * A TTL index on `expiresAt` ensures MongoDB auto-deletes expired entries,
 * keeping the collection lean without any manual cron cleanup.
 */
const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, {
    timestamps: false,
    collection: 'tokenblacklists',
});

// TTL index: MongoDB auto-removes documents once expiresAt passes
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
