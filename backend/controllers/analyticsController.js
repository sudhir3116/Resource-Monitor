const Usage = require('../models/Usage');
const Block = require('../models/Block');
const SystemConfig = require('../models/SystemConfig');
const { ROLES } = require('../config/roles');
const mongoose = require('mongoose');

/**
 * Calculate percentage change between two values
 */
const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

/**
 * Get date range for period
 */
const getDateRange = (period) => {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    switch (period) {
        case 'daily':
            return {
                current: { start: startOfToday, end: new Date() },
                previous: {
                    start: new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000),
                    end: startOfToday
                }
            };
        case 'weekly':
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            return {
                current: { start: startOfWeek, end: new Date() },
                previous: {
                    start: new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
                    end: startOfWeek
                }
            };
        case 'monthly':
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return {
                current: { start: startOfMonth, end: new Date() },
                previous: {
                    start: startOfPrevMonth,
                    end: startOfMonth
                }
            };
        default:
            return null;
    }
};

/**
 * @desc    Get analytics summary (Daily/Weekly/Monthly)
 * @route   GET /api/analytics/summary?period=daily|weekly|monthly
 * @access  Private
 */
const getAnalyticsSummary = async (req, res) => {
    try {
        const { period = 'daily' } = req.query;
        const ranges = getDateRange(period);

        if (!ranges) {
            return res.status(400).json({
                success: false,
                error: 'Invalid period. Use daily, weekly, or monthly'
            });
        }

        const role = (req.user.role || '').toLowerCase()
        let filter = {}

        if (role === 'warden' || role === 'student') {
            const user = await require('../models/User').findById(req.user.id);
            const blockId = user?.block || user?.blockId;
            if (!blockId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not assigned to any block'
                })
            }
            filter.blockId = new mongoose.Types.ObjectId(blockId)
        }

        // Current period stats
        const currentStats = await Usage.aggregate([
            {
                $match: {
                    ...filter,
                    deleted: { $ne: true },
                    usage_date: {
                        $gte: ranges.current.start,
                        $lte: ranges.current.end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    value: { $sum: '$usage_value' },
                    totalRecords: { $sum: 1 },
                    avgUsage: { $avg: '$usage_value' },
                    resources: { $addToSet: '$resource_type' }
                }
            }
        ]);

        // Previous period stats
        const previousStats = await Usage.aggregate([
            {
                $match: {
                    ...filter,
                    deleted: { $ne: true },
                    usage_date: {
                        $gte: ranges.previous.start,
                        $lte: ranges.previous.end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    value: { $sum: '$usage_value' },
                    totalRecords: { $sum: 1 }
                }
            }
        ]);

        const current = currentStats[0] || { value: 0, totalRecords: 0, avgUsage: 0, resources: [] };
        const previous = previousStats[0] || { value: 0, totalRecords: 0 };

        const percentageChange = calculatePercentageChange(current.value, previous.value);
        const trend = percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable';

        // Current period stats by resource
        const currentByResource = await Usage.aggregate([
            {
                $match: {
                    ...filter,
                    deleted: { $ne: true },
                    usage_date: {
                        $gte: ranges.current.start,
                        $lte: ranges.current.end
                    }
                }
            },
            {
                $group: {
                    _id: '$resource_type',
                    current: { $sum: '$usage_value' }
                }
            }
        ]);

        // Previous period stats by resource
        const previousByResource = await Usage.aggregate([
            {
                $match: {
                    ...filter,
                    deleted: { $ne: true },
                    usage_date: {
                        $gte: ranges.previous.start,
                        $lte: ranges.previous.end
                    }
                }
            },
            {
                $group: {
                    _id: '$resource_type',
                    previous: { $sum: '$usage_value' }
                }
            }
        ]);

        const resourceData = currentByResource.map(curr => {
            const prev = previousByResource.find(p => String(p._id) === String(curr._id)) || { previous: 0 };
            const change = calculatePercentageChange(curr.current, prev.previous);
            return {
                resource: curr._id,
                current: Math.round(curr.current * 100) / 100,
                change: Math.round(change * 100) / 100
            };
        });

        res.json({
            success: true,
            period,
            current: {
                total: Math.round(current.value * 100) / 100,
                value: Math.round(current.value * 100) / 100, // Phase 2 compliance
                records: current.totalRecords,
                average: Math.round(current.avgUsage * 100) / 100,
                resources: current.resources.length
            },
            previous: {
                total: Math.round(previous.value * 100) / 100,
                value: Math.round(previous.value * 100) / 100, // Phase 2 compliance
                records: previous.totalRecords
            },
            percentageChange: Math.round(percentageChange * 100) / 100,
            trend,
            data: resourceData
        });
    } catch (error) {
        console.error('Analytics summary error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Get resource trend data
 * @route   GET /api/analytics/trends?days=7&resource=Electricity
 * @access  Private
 */
/**
 * @desc    Get resource usage trends for time period
 * @route   GET /api/analytics/trends?days=7&resource=Electricity
 * @access  Private
 * @param   days - Number of days to look back (default: 7)
 * @param   resource - Optional specific resource type to filter by
 */
const getResourceTrends = async (req, res) => {
    try {
        const { days = 7, resource } = req.query;
        const daysInt = parseInt(days);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysInt);
        startDate.setHours(0, 0, 0, 0); // Start from beginning of that day

        let filter = { usage_date: { $gte: startDate, $lte: endDate } };

        const role = (req.user.role || '').toLowerCase()
        if (role === 'warden' || role === 'student') {
            const user = await require('../models/User').findById(req.user.id);
            const blockId = user?.block || user?.blockId;
            if (!blockId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not assigned to any block'
                })
            }
            filter.blockId = new mongoose.Types.ObjectId(blockId)
        }


        if (resource) {
            filter.resource_type = resource;
        }

        const trends = await Usage.aggregate([
            { $match: { ...filter, deleted: { $ne: true } } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } },
                        resource: '$resource_type'
                    },
                    total: { $sum: '$usage_value' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } },
            {
                $group: {
                    _id: '$_id.resource',
                    data: {
                        $push: {
                            date: '$_id.date',
                            value: '$total',
                            count: '$count'
                        }
                    }
                }
            }
        ]);

        const trendResult = {};
        trends.forEach(t => {
            trendResult[t._id.toLowerCase()] = t.data;
        });

        res.json({
            success: true,
            trends: trendResult, // Phase 1 grouped structure
            period: { days: daysInt, start: startDate, end: endDate }
        });
    } catch (error) {
        console.error('Resource trends error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Detect usage anomalies (>30% above 7-day average)
 * @route   GET /api/analytics/anomalies
 * @access  Private (Admin, Warden, Dean, Principal)
 */
const detectAnomalies = async (req, res) => {
    try {
        const role = (req.user.role || '').toLowerCase();
        if (role === 'student') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        let matchStage = {
            deleted: { $ne: true }
        };

        if (role === 'warden') {
            const user = await require('../models/User').findById(req.user.id);
            const blockId = user?.block || user?.blockId;
            if (!blockId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not assigned to any block'
                });
            }
            matchStage.blockId = new mongoose.Types.ObjectId(blockId);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Get today's usage by resource and block
        const todayUsage = await Usage.aggregate([
            {
                $match: {
                    ...matchStage,
                    usage_date: { $gte: today }
                }
            },
            {
                $group: {
                    _id: { resource: '$resource_type', block: '$blockId' },
                    todayTotal: { $sum: '$usage_value' }
                }
            }
        ]);

        // Get 7-day average
        const weeklyAvg = await Usage.aggregate([
            {
                $match: {
                    ...matchStage,
                    usage_date: { $gte: sevenDaysAgo, $lt: today }
                }
            },
            {
                $group: {
                    _id: { resource: '$resource_type', block: '$blockId' },
                    weekTotal: { $sum: '$usage_value' }
                }
            }
        ]);

        // Detect anomalies
        const anomalies = [];
        for (const todayData of todayUsage) {
            const weekData = weeklyAvg.find(
                w => w._id.resource === todayData._id.resource &&
                    String(w._id.block) === String(todayData._id.block)
            );

            if (weekData) {
                const dailyAvg = weekData.weekTotal / 7;
                const threshold = dailyAvg * 1.3; // 30% above average

                if (todayData.todayTotal > threshold) {
                    const excessPercentage = ((todayData.todayTotal - dailyAvg) / dailyAvg) * 100;

                    // Get block name
                    const block = await Block.findById(todayData._id.block);

                    anomalies.push({
                        resource: todayData._id.resource,
                        block: block ? block.name : 'Unknown',
                        blockId: todayData._id.block,
                        todayUsage: Math.round(todayData.todayTotal * 100) / 100,
                        averageUsage: Math.round(dailyAvg * 100) / 100,
                        threshold: Math.round(threshold * 100) / 100,
                        excessPercentage: Math.round(excessPercentage * 100) / 100,
                        severity: excessPercentage > 50 ? 'High' : excessPercentage > 30 ? 'Medium' : 'Low',
                        detectedAt: new Date()
                    });
                }
            }
        }

        res.json({
            success: true,
            count: anomalies.length,
            anomalies
        });
    } catch (error) {
        console.error('Anomaly detection error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Calculate sustainability score
 * @route   GET /api/analytics/sustainability-score?blockId=xxx
 * @access  Private
 */
const getSustainabilityScore = async (req, res) => {
    try {
        const { blockId } = req.query;

        // Get current month date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let filter = { usage_date: { $gte: startOfMonth } };

        const role = (req.user.role || '').toLowerCase()
        if (role === 'warden' || role === 'student') {
            const user = await require('../models/User').findById(req.user.id);
            const userBlockId = user?.block || user?.blockId;
            if (!userBlockId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not assigned to any block'
                })
            }
            filter.blockId = new mongoose.Types.ObjectId(userBlockId)
        } else if (blockId) {
            filter.blockId = new mongoose.Types.ObjectId(blockId);
        }


        // Get actual usage by resource
        const actualUsage = await Usage.aggregate([
            { $match: { ...filter, deleted: { $ne: true } } },
            {
                $group: {
                    _id: '$resource_type',
                    total: { $sum: '$usage_value' }
                }
            }
        ]);

        // Get thresholds from system config
        const configs = await SystemConfig.find({});

        let totalScore = 100;
        const resourceScores = [];

        for (const usage of actualUsage) {
            const config = configs.find(c => c.resource === usage._id);
            if (config && config.monthlyLimitPerBlock) {
                const usagePercentage = (usage.total / config.monthlyLimitPerBlock) * 100;
                let penalty = 0;

                if (usagePercentage > 100) {
                    penalty = (usagePercentage - 100) * 0.5; // 0.5 points per % over
                } else if (usagePercentage > 90) {
                    penalty = (usagePercentage - 90) * 0.2; // 0.2 points per % in warning zone
                }

                totalScore -= penalty;

                resourceScores.push({
                    resource: usage._id,
                    actual: Math.round(usage.total * 100) / 100,
                    threshold: config.monthlyLimitPerBlock,
                    percentage: Math.round(usagePercentage * 100) / 100,
                    penalty: Math.round(penalty * 100) / 100,
                    status: usagePercentage > 100 ? 'Critical' : usagePercentage > 90 ? 'Warning' : 'Good'
                });
            }
        }

        totalScore = Math.max(0, Math.min(100, totalScore));
        const grade = totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : totalScore >= 60 ? 'D' : 'F';

        res.json({
            success: true,
            score: Math.round(totalScore * 100) / 100,
            grade,
            resourceBreakdown: resourceScores,
            period: 'Current Month'
        });
    } catch (error) {
        console.error('Sustainability score error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Get resource efficiency rating
 * @route   GET /api/analytics/efficiency-rating
 * @access  Private
 */
const getEfficiencyRating = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let filter = { usage_date: { $gte: startOfMonth } };

        const role = (req.user.role || '').toLowerCase()
        if (role === 'warden' || role === 'student') {
            const user = await require('../models/User').findById(req.user.id);
            const blockId = user?.block || user?.blockId;
            if (!blockId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not assigned to any block'
                })
            }
            filter.blockId = new mongoose.Types.ObjectId(blockId)
        }


        const usage = await Usage.aggregate([
            { $match: { ...filter, deleted: { $ne: true } } },
            {
                $group: {
                    _id: '$resource_type',
                    total: { $sum: '$usage_value' }
                }
            }
        ]);

        const configs = await SystemConfig.find({});
        const ratings = [];

        for (const u of usage) {
            const config = configs.find(c => c.resource === u._id);
            if (config && config.monthlyLimitPerBlock) {
                const percentage = (u.total / config.monthlyLimitPerBlock) * 100;
                let rating, color;

                if (percentage < 70) {
                    rating = 'Green';
                    color = '#10b981';
                } else if (percentage < 90) {
                    rating = 'Moderate';
                    color = '#f59e0b';
                } else {
                    rating = 'Critical';
                    color = '#ef4444';
                }

                ratings.push({
                    resource: u._id,
                    actual: Math.round(u.total * 100) / 100,
                    threshold: config.monthlyLimitPerBlock,
                    percentage: Math.round(percentage * 100) / 100,
                    rating,
                    color
                });
            }
        }

        res.json({
            success: true,
            ratings
        });
    } catch (error) {
        console.error('Efficiency rating error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Get budget monitoring for blocks
 * @route   GET /api/analytics/budget
 * @access  Private
 */
const getBudgetMonitoring = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Fetch all blocks and configs (for rates)
        const blocks = await Block.find({});
        const configs = await SystemConfig.find({});

        // Calculate usage cost per block (exclude soft-deleted records)
        const usageAgg = await Usage.aggregate([
            { $match: { usage_date: { $gte: startOfMonth }, deleted: { $ne: true } } },
            {
                $group: {
                    _id: { blockId: '$blockId', resource: '$resource_type' },
                    totalUsage: { $sum: '$usage_value' }
                }
            }
        ]);

        const blockBudgets = blocks.map(block => {
            let totalCost = 0;
            const resourceCosts = [];

            const blockUsage = usageAgg.filter(u => String(u._id.blockId) === String(block._id));

            for (const usage of blockUsage) {
                const config = configs.find(c => c.resource === usage._id.resource);
                const rate = config ? config.rate : 0;
                const cost = usage.totalUsage * rate;
                totalCost += cost;

                resourceCosts.push({
                    resource: usage._id.resource,
                    usage: usage.totalUsage,
                    rate,
                    cost
                });
            }

            const total_budget = block.monthly_budget || 0;
            const remaining = total_budget - totalCost;
            const percentageUsed = total_budget > 0 ? (totalCost / total_budget) * 100 : 0;

            let status = 'Good';
            if (percentageUsed >= 100) status = 'Critical';
            else if (percentageUsed >= 80) status = 'Warning';

            return {
                blockId: block._id,
                blockName: block.name,
                budget: total_budget,
                spent: totalCost,
                remaining,
                percentageUsed,
                status,
                resourceCosts
            };
        });

        // Filter for user
        let result = blockBudgets;
        const role = (req.user.role || '').toLowerCase();
        if (role === 'warden') {
            const user = await require('../models/User').findById(req.user.id);
            const userBlockId = user?.block || user?.blockId;
            if (userBlockId) {
                result = blockBudgets.filter(b => String(b.blockId) === String(userBlockId));
            } else {
                result = [];
            }
        } else if (role === 'student') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        res.json({ success: true, budgets: result });
    } catch (error) {
        console.error('Budget monitoring error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * @desc    Get hostel leaderboard
 * @route   GET /api/analytics/leaderboard
 * @access  Private
 */
const getHostelLeaderboard = async (req, res) => {
    try {
        const blocks = await Block.find({ type: 'Hostel' });
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const configs = await SystemConfig.find({});

        const rankings = [];
        for (const block of blocks) {
            const actualUsage = await Usage.aggregate([
                { $match: { blockId: block._id, usage_date: { $gte: startOfMonth }, deleted: { $ne: true } } },
                { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
            ]);

            let totalScore = 100;

            for (const usage of actualUsage) {
                const config = configs.find(c => c.resource === usage._id);
                if (config && config.monthlyLimitPerBlock) {
                    const usagePercentage = (usage.total / config.monthlyLimitPerBlock) * 100;
                    if (usagePercentage > 100) {
                        totalScore -= (usagePercentage - 100) * 0.5;
                    } else if (usagePercentage > 90) {
                        totalScore -= (usagePercentage - 90) * 0.2;
                    }
                }
            }

            totalScore = Math.max(0, Math.min(100, Math.round(totalScore * 100) / 100));
            // Update block efficiency score
            if (block.efficiency_score !== totalScore) {
                block.efficiency_score = totalScore;
                await block.save();
            }

            rankings.push({
                blockId: block._id,
                blockName: block.name,
                score: totalScore,
                capacity: block.capacity
            });
        }

        // Sort by score descending
        rankings.sort((a, b) => b.score - a.score);

        res.json({
            success: true,
            leaderboard: rankings,
            top3: rankings.slice(0, 3),
            bottom3: rankings.slice(-3).reverse()
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get block-specific analytics for student dashboard
 * GET /api/analytics/block/:blockId
 */
const getBlockAnalytics = async (req, res) => {
    try {
        const { blockId } = req.params;
        const { days = 30 } = req.query;
        const user = req.user;

        // Validate block ID
        if (!mongoose.Types.ObjectId.isValid(blockId)) {
            return res.status(400).json({ success: false, message: 'Invalid block ID' });
        }

        // Students can only see their own block analytics
        if (user.role === 'student' && String(user.block) !== String(blockId)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const block = await Block.findById(blockId);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Fetch usage data for the block
        const usageData = await Usage.find({
            blockId,
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });

        // Group data by resource type
        const resourceStats = {};
        const resources = ['Electricity', 'Water', 'LPG', 'Diesel', 'Solar', 'Waste'];

        resources.forEach(resource => {
            const resourceUsage = usageData.filter(u => u.resource_type === resource);
            if (resourceUsage.length > 0) {
                const values = resourceUsage.map(u => parseFloat(u.usage_value) || 0);
                resourceStats[resource] = {
                    total: values.reduce((a, b) => a + b, 0),
                    average: values.reduce((a, b) => a + b, 0) / values.length,
                    max: Math.max(...values),
                    min: Math.min(...values),
                    current: values[0],
                    trend: values.slice(0, 7).reverse() // Last 7 days for chart
                };
            } else {
                resourceStats[resource] = {
                    total: 0,
                    average: 0,
                    max: 0,
                    min: 0,
                    current: 0,
                    trend: []
                };
            }
        });

        // Calculate carbon footprint (kg CO2)
        // Formula: electricity_kwh × 0.82
        const electricityKwh = resourceStats.Electricity?.total || 0;
        const carbonFootprint = electricityKwh * 0.82;

        // Calculate sustainability score (0-100)
        const maxThreshold = 10000; // Max acceptable usage
        const usageTotal = Object.values(resourceStats).reduce((sum, r) => sum + r.total, 0);
        const sustainabilityScore = Math.max(0, 100 - (usageTotal / maxThreshold) * 100);

        res.json({
            success: true,
            data: {
                block: {
                    id: block._id,
                    name: block.name,
                    capacity: block.capacity
                },
                period: { days: parseInt(days) },
                resources: resourceStats,
                carbonFootprint: Math.round(carbonFootprint * 100) / 100,
                sustainabilityScore: Math.round(sustainabilityScore),
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        console.error('Block analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get student-specific usage analytics for their assigned block
 * GET /api/students/usage-analytics
 */
const getStudentUsageAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await require('../models/User').findById(userId);

        if (!user || (!user.block && user.role === 'student')) {
            return res.status(400).json({ success: false, message: 'Student block not assigned' });
        }

        // Mock block ID if not found for admins/other testing, but students MUST have a block
        let blockId = user.block;

        if (!blockId && user.role !== 'student') {
            // Admin testing, find any block
            const anyBlock = await Block.findOne();
            if (anyBlock) {
                blockId = anyBlock._id;
            } else {
                return res.status(404).json({ success: false, message: 'No blocks exist purely for admin test view' });
            }
        }

        req.params.blockId = blockId.toString(); // Map for the implementation below
        req.user.block = blockId.toString(); // Ensure req.user has the correct block ID for validation
        return getBlockAnalytics(req, res);
    } catch (error) {
        console.error('Student usage analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getAnalyticsSummary,
    getResourceTrends,
    detectAnomalies,
    getSustainabilityScore,
    getEfficiencyRating,
    getBudgetMonitoring,
    getHostelLeaderboard,
    getBlockAnalytics,
    getStudentUsageAnalytics
};
