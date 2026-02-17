const Usage = require('../models/Usage');
const Block = require('../models/Block');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const Alert = require('../models/Alert');
const Analytics = require('../models/Analytics'); // For historical trends
const mongoose = require('mongoose');

// Helper: Get usage trend (This month vs Last month)
async function getTrend(blockId, resourceType) {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const pipeline = [
        {
            $match: {
                resource_type: resourceType,
                usage_date: { $gte: lastMonthStart }
            }
        }
    ];

    if (blockId) {
        pipeline[0].$match.blockId = new mongoose.Types.ObjectId(blockId);
    }

    pipeline.push({
        $group: {
            _id: {
                month: { $month: "$usage_date" },
                year: { $year: "$usage_date" }
            },
            total: { $sum: "$usage_value" }
        }
    });

    const results = await Usage.aggregate(pipeline);

    // Process results
    const current = results.find(r => r._id.month === (today.getMonth() + 1))?.total || 0;
    const previous = results.find(r => r._id.month === (lastMonthStart.getMonth() + 1))?.total || 0;

    let percentageChange = 0;
    if (previous > 0) {
        percentageChange = ((current - previous) / previous) * 100;
    } else if (current > 0) {
        percentageChange = 100; // New usage
    }

    return {
        current,
        previous,
        percentageChange: parseFloat(percentageChange.toFixed(1)),
        direction: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable'
    };
}

// 1. Student Dashboard Stats
// 1. Student Dashboard Stats
exports.getStudentStats = async (req, res) => {
    try {
        const userId = req.userId || req.user.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        const blockId = user.block;

        // Personal Usage This Month
        const personalUsage = await Usage.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), usage_date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
            { $group: { _id: "$resource_type", total: { $sum: "$usage_value" } } }
        ]);

        // Block Average (Per Student)
        let blockAvg = [];
        if (blockId) {
            const block = await Block.findById(blockId);
            if (block && block.capacity > 0) {
                const blockTotal = await Usage.aggregate([
                    { $match: { blockId: new mongoose.Types.ObjectId(blockId), usage_date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
                    { $group: { _id: "$resource_type", total: { $sum: "$usage_value" } } }
                ]);

                // Map the result
                if (blockTotal.length > 0) {
                    blockAvg = blockTotal.map(b => ({
                        resource: b._id,
                        avg: (b.total / block.capacity).toFixed(2)
                    }));
                }
            }
        }

        res.json({
            success: true,
            data: { personalUsage, blockAvg }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Warden Dashboard Stats
exports.getWardenStats = async (req, res) => {
    try {
        const userId = req.userId || req.user.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        const blockId = user.block;

        if (!blockId) return res.status(400).json({ success: false, message: "Warden not assigned to a block" });

        // Real-time Consumptions
        const electricity = await getTrend(blockId, 'Electricity');
        const water = await getTrend(blockId, 'Water');

        // Active Alerts
        const activeAlerts = await Alert.countDocuments({
            block: blockId,
            status: { $ne: 'Resolved' }
        });

        // Today's Usage
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayUsage = await Usage.aggregate([
            { $match: { blockId: new mongoose.Types.ObjectId(blockId), usage_date: { $gte: todayStart } } },
            { $group: { _id: "$resource_type", total: { $sum: "$usage_value" } } }
        ]);

        res.json({
            success: true,
            data: {
                electricity,
                water,
                activeAlerts,
                todayUsage
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Admin/Principal Executive Dashboard
exports.getExecutiveStats = async (req, res) => {
    try {
        // Campus Wide Totals
        const electricity = await getTrend(null, 'Electricity');
        const water = await getTrend(null, 'Water');

        // Cost Estimation
        const config = await SystemConfig.find({});
        const rates = config.reduce((acc, curr) => ({ ...acc, [curr.resource]: curr.rate }), {});

        const totalCost = (electricity.current * (rates['Electricity'] || 0)) +
            (water.current * (rates['Water'] || 0));

        // Block Comparison (Who is wasting most?)
        // Top 5 Blocks by Electricity Per Capita
        const blocks = await Block.find({});
        const blockStats = [];

        for (let block of blocks) {
            if (block.capacity > 0) {
                const usage = await Usage.aggregate([
                    {
                        $match: {
                            blockId: new mongoose.Types.ObjectId(block._id),
                            resource_type: 'Electricity',
                            usage_date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$usage_value" } } }
                ]);
                const total = usage[0]?.total || 0;
                blockStats.push({
                    name: block.name,
                    perCapita: (total / block.capacity).toFixed(2),
                    total: total
                });
            }
        }

        // Sort by Per Capita Descending
        blockStats.sort((a, b) => b.perCapita - a.perCapita);

        res.json({
            success: true,
            data: {
                trends: { electricity, water },
                financial: { estimatedCost: totalCost.toFixed(2), currency: 'INR' },
                blockRanking: blockStats.slice(0, 5) // Top 5
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
