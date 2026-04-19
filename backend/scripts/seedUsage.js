const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Usage = require('../models/Usage');
const ResourceConfig = require('../models/ResourceConfig');
const Block = require('../models/Block');

dotenv.config();

const RANGES = {
    'Electricity': { min: 100, max: 300 },
    'Water': { min: 500, max: 1500 },
    'Diesel': { min: 20, max: 80 },
    'Petrol': { min: 10, max: 50 },
    'LPG': { min: 5, max: 30 },
    'Waste': { min: 50, max: 200 },
    'Kerosene': { min: 10, max: 40 }
};

const getRange = (name) => {
    // Case-insensitive lookup
    const key = Object.keys(RANGES).find(k => k.toLowerCase() === name.toLowerCase());
    return RANGES[key] || { min: 10, max: 50 }; // Default if not found
};

const seedUsageData = async () => {
    try {
        console.log('🚀 Starting Usage Seeding Protocol...');
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. DELETE ALL EXISTING USAGE DATA
        const deleteCount = await Usage.deleteMany({});
        console.log(`🗑️ Deleted ${deleteCount.deletedCount} existing records`);

        // 2. FETCH RESOURCES AND BLOCKS
        const resources = await ResourceConfig.find({ isDeleted: false });
        const blocks = await Block.find({ status: 'Active' });

        if (resources.length === 0) {
            console.error('❌ No resources found in DB to seed against.');
            process.exit(1);
        }

        console.log(`📦 Found ${resources.length} resources and ${blocks.length} active blocks`);

        const allUsage = [];
        const lastValues = {}; // Track previous day value per block and resource for ±10% logic

        // Start Date: April 1, 2026
        // End Date: April 19, 2026
        const startDate = new Date('2026-04-01T00:00:00Z');
        const endDate = new Date('2026-04-19T23:59:59Z');

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const currentTimestamp = new Date(d);
            
            for (const block of (blocks.length > 0 ? blocks : [null])) {
                for (const res of resources) {
                    const blockId = block ? block._id : null;
                    const resName = res.name;
                    const range = getRange(resName);
                    
                    const key = `${blockId || 'campus'}_${resName}`;
                    let value;

                    if (!lastValues[key]) {
                        // Initial random value in range
                        value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                    } else {
                        // ±10% variation from previous day
                        const prevValue = lastValues[key];
                        const variation = prevValue * 0.1;
                        const change = (Math.random() * 2 - 1) * variation; // Random between -variation and +variation
                        value = Math.max(range.min, Math.min(range.max, prevValue + change));
                    }

                    lastValues[key] = value;

                    allUsage.push({
                        blockId: blockId,
                        resourceId: res._id,
                        resource_type: resName,
                        usage_value: Math.round(value * 100) / 100,
                        usage_date: currentTimestamp,
                        source: 'AI',
                        unit: res.unit,
                        cost: Math.round((value * (res.costPerUnit || 0)) * 100) / 100,
                        currency: '₹'
                    });
                }
            }
        }

        // 3. INSERT MANY
        console.log(`📝 Preparing to insert ${allUsage.length} realistic records...`);
        const batchSize = 500;
        for (let i = 0; i < allUsage.length; i += batchSize) {
            const batch = allUsage.slice(i, i + batchSize);
            await Usage.insertMany(batch);
        }

        console.log('✅ Seeding Complete. Telemetry Grid Synchronized.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seeding Failed:', error);
        process.exit(1);
    }
};

seedUsageData();
