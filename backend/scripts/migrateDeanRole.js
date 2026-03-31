/**
 * backend/scripts/migrateDeanRole.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Migration script to split 'dean_principal' into 'dean' and 'principal'.
 * For now, all 'dean_principal' users are mapped to 'dean'.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecomonitor';

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // Update all users who have the legacy role or label
        const result = await User.updateMany(
            {
                $or: [
                    { role: 'dean_principal' },
                    { role: 'Dean / Principal' }
                ]
            },
            { $set: { role: 'dean' } }
        );

        console.log(`Migration complete.`);
        console.log(`Matched: ${result.matchedCount}`);
        console.log(`Modified: ${result.modifiedCount}`);

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
