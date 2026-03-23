/**
 * backend/scripts/seedUsage.js
 * ----------------------------
 * Clears all existing usage records and seeds fresh realistic data.
 * Run with: node scripts/seedUsage.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Usage = require('../models/Usage');
const Block = require('../models/Block');
const User = require('../models/User');

const RESOURCES = [
    { name: 'Electricity', unit: 'kWh', min: 300, max: 800 },
    { name: 'Water', unit: 'Liters', min: 1000, max: 3000 },
    { name: 'LPG', unit: 'kg', min: 20, max: 80 },
    { name: 'Diesel', unit: 'Liters', min: 50, max: 150 },
    { name: 'Solar', unit: 'kWh', min: 100, max: 300 },
    { name: 'Waste', unit: 'kg', min: 30, max: 100 },
];

const rand = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

async function daysAgoDate(d) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dt.setHours(Math.floor(Math.random() * 12) + 6, 0, 0, 0);
    return dt;
}

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('❌  No MONGODB_URI found in .env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅  Connected to MongoDB');

    // 1. Delete old usage
    const { deletedCount } = await Usage.deleteMany({});
    console.log(`🗑   Deleted ${deletedCount} old usage records`);

    // 2. Fetch blocks (any type)
    const blocks = await Block.find({}).lean();
    if (blocks.length === 0) {
        console.error('❌  No blocks found. Please create blocks first via the admin panel.');
        await mongoose.disconnect();
        process.exit(1);
    }
    console.log(`🏢  Found ${blocks.length} block(s):`, blocks.map(b => b.name).join(', '));

    // 3. Find an admin user to attach records to
    const adminUser = await User.findOne({ role: 'admin' }).lean();
    const userId = adminUser?._id || null;

    // 4. Seed records
    const seedBlocks = blocks.slice(0, Math.min(blocks.length, 4));  // up to 4 blocks
    const DAYS = 7;
    const records = [];

    for (const block of seedBlocks) {
        for (const res of RESOURCES) {
            for (let d = 0; d < DAYS; d++) {
                records.push({
                    blockId: block._id,
                    userId: userId,
                    resource_type: res.name,
                    usage_value: rand(res.min, res.max),
                    unit: res.unit,
                    usage_date: await daysAgoDate(d),
                    notes: `Seeded record — ${res.name} for ${block.name}`,
                    deleted: false,
                });
            }
        }
    }

    await Usage.insertMany(records);
    console.log(`✅  Inserted ${records.length} usage records`);
    console.log(`   Breakdown: ${seedBlocks.length} blocks × ${RESOURCES.length} resources × ${DAYS} days = ${records.length}`);

    await mongoose.disconnect();
    console.log('✅  Done! Disconnected from MongoDB.');
}

main().catch(err => {
    console.error('❌  Seed script error:', err.message);
    mongoose.disconnect();
    process.exit(1);
});
