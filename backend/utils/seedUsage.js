const Usage = require('../models/Usage');
const ResourceConfig = require('../models/ResourceConfig');
const Block = require('../models/Block');

/**
 * seedUsageData
 * Deletes all existing usage data and generates realistic trends from
 * April 1, 2026 to April 19, 2026.
 */
const seedUsageData = async () => {
    try {
        console.log('🌱 Starting AI-Driven Telemetry Seeding...');
        
        // Ranges as per senior requirements
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
            const key = Object.keys(RANGES).find(k => k.toLowerCase() === name.toLowerCase());
            return RANGES[key] || { min: 10, max: 50 };
        };

        // 1. DELETE ALL EXISTING USAGE DATA (STRICT RULE)
        await Usage.deleteMany({});
        console.log('🗑️ Legacy usage data purged');

        // 2. FETCH ALL RESOURCES
        const resources = await ResourceConfig.find({ isDeleted: false });
        const blocks = await Block.find({ status: 'Active' });

        if (resources.length === 0) {
            console.log('⚠️ No resources found in grid config.');
            return;
        }

        const allUsage = [];
        const lastValues = {};

        // Loop from April 1 → April 19
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
                        value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                    } else {
                        const prevValue = lastValues[key];
                        const variation = prevValue * 0.1;
                        const change = (Math.random() * 2 - 1) * variation;
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

        // 3. LOOP THROUGH DATES AND INSERT DATA
        await Usage.insertMany(allUsage);
        console.log(`✅ Successfully synthesized ${allUsage.length} telemetry records across ${blocks.length || 1} sectors`);

    } catch (error) {
        console.error('❌ Usage Seeding Error:', error);
        throw error;
    }
};

module.exports = seedUsageData;
