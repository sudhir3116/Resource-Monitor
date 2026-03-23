const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Usage = require('../models/Usage');
const Block = require('../models/Block');
const User = require('../models/User');
const ResourceConfig = require('../models/ResourceConfig');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/eco_monitor';

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Clear existing data to ensure consistency
        await Usage.deleteMany({});
        console.log('Cleared existing usage records');

        // 2. Resolve blocks (Warden A -> Block A, Warden B -> Block B)
        const blockA = await Block.findOne({ name: /Block A/i });
        const blockB = await Block.findOne({ name: /Block B/i });

        if (!blockA || !blockB) {
            console.error('CRITICAL: Block A or Block B not found. Run seedBlocks first.');
            process.exit(1);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const testData = [
            // Block A (Warden A)
            { blockId: blockA._id, resource_type: 'Electricity', usage_value: 2500, usage_date: today },
            { blockId: blockA._id, resource_type: 'Water', usage_value: 12000, usage_date: today },
            { blockId: blockA._id, resource_type: 'Solar', usage_value: 80, usage_date: today },
            { blockId: blockA._id, resource_type: 'LPG', usage_value: 30, usage_date: today },
            { blockId: blockA._id, resource_type: 'Diesel', usage_value: 50, usage_date: today },
            { blockId: blockA._id, resource_type: 'Waste', usage_value: 15, usage_date: today },

            // Block B (Warden B)
            { blockId: blockB._id, resource_type: 'Electricity', usage_value: 1800, usage_date: today },
            { blockId: blockB._id, resource_type: 'Water', usage_value: 9000, usage_date: today },
            { blockId: blockB._id, resource_type: 'Solar', usage_value: 0, usage_date: today }, // No solar in B
            { blockId: blockB._id, resource_type: 'LPG', usage_value: 25, usage_date: today },
            { blockId: blockB._id, resource_type: 'Diesel', usage_value: 40, usage_date: today },
            { blockId: blockB._id, resource_type: 'Waste', usage_value: 12, usage_date: today },
        ];

        await Usage.insertMany(testData);
        console.log('Inserted consistent test data across Block A and Block B');

        console.log('\nEXPECTED VALUES FOR VALIDATION:');
        console.log('-----------------------------------');
        console.log('Admin/GM/Dean/Principal (Campus Total):');
        console.log('  - Electricity: 4300');
        console.log('  - Water: 21000');
        console.log('  - Solar: 80');
        console.log('  - LPG: 55');
        console.log('  - Diesel: 90');
        console.log('  - Waste: 27');
        console.log('\nWarden A / Student A (Block A):');
        console.log('  - Electricity: 2500');
        console.log('  - Water: 12000');
        console.log('\nWarden B / Student B (Block B):');
        console.log('  - Electricity: 1800');
        console.log('  - Solar: No data available (or 0)');
        console.log('-----------------------------------');

        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
