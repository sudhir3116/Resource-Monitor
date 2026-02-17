const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Block = require('../models/Block');
const SystemConfig = require('../models/SystemConfig');

dotenv.config({ path: '.env' }); // Adjust relative path

const BLOCKS = [
    { name: 'Hostel A', type: 'Hostel', capacity: 1000, departments: [] },
    { name: 'Hostel B', type: 'Hostel', capacity: 1000, departments: [] },
    { name: 'Academic Block', type: 'Academic', capacity: 5000, departments: ['CS', 'EE', 'ME'] },
    { name: 'Admin Block', type: 'Administrative', capacity: 200, departments: ['Admin'] }
];

const CONFIGS = [
    { resource: 'Electricity', unit: 'kWh', rate: 8, dailyLimitPerPerson: 5 },
    { resource: 'Water', unit: 'Liters', rate: 0.15, dailyLimitPerPerson: 150 },
    { resource: 'Food', unit: 'kg', rate: 120, dailyLimitPerPerson: 0.5 },
    { resource: 'Waste', unit: 'kg', rate: 0, dailyLimitPerPerson: 0.2 } // No cost, but impact
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Blocks
        for (const b of BLOCKS) {
            const exists = await Block.findOne({ name: b.name });
            if (!exists) {
                await Block.create(b);
                console.log(`Created Block: ${b.name}`);
            } else {
                console.log(`Block exists: ${b.name}`);
            }
        }

        // System Config
        for (const c of CONFIGS) {
            const exists = await SystemConfig.findOne({ resource: c.resource });
            if (!exists) {
                await SystemConfig.create(c);
                console.log(`Configured: ${c.resource}`);
            } else {
                // Update rates if exists
                exists.rate = c.rate;
                exists.unit = c.unit;
                await exists.save();
                console.log(`Updated Config: ${c.resource}`);
            }
        }

        console.log('Enterprise structure setup complete');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
