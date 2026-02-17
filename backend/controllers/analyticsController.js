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

        // Filter by user role
        let filter = {};
        if (req.user.role === ROLES.STUDENT) {
            filter.userId = new mongoose.Types.ObjectId(req.user.id);
        } else if (req.user.role === ROLES.WARDEN) {
            // Get user's assigned block(s)
            const user = await require('../models/User').findById(req.user.id);
            if (user.block) {
                filter.blockId = user.block;
            }
        }
        // Admin, Dean, Principal see all data

        // Current period stats
        const currentStats = await Usage.aggregate([
            {
                $match: {
                    ...filter,
                    usage_date: {
                        $gte: ranges.current.start,
                        $lte: ranges.current.end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalUsage: { $sum: '$usage_value' },
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
                    usage_date: {
                        $gte: ranges.previous.start,
                        $lte: ranges.previous.end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalUsage: { $sum: '$usage_value' },
                    totalRecords: { $sum: 1 }
                }
            }
        ]);

        const current = currentStats[0] || { totalUsage: 0, totalRecords: 0, avgUsage: 0, resources: [] };
        const previous = previousStats[0] || { totalUsage: 0, totalRecords: 0 };

        const percentageChange = calculatePercentageChange(current.totalUsage, previous.totalUsage);
        const trend = percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable';

        res.json({
            success: true,
            period,
            current: {
                total: Math.round(current.totalUsage * 100) / 100,
                records: current.totalRecords,
                average: Math.round(current.avgUsage * 100) / 100,
                resources: current.resources.length
            },
            previous: {
                total: Math.round(previous.totalUsage * 100) / 100,
                records: previous.totalRecords
            },
            percentageChange: Math.round(percentageChange * 100) / 100,
            trend
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
const getResourceTrends = async (req, res) => {
    try {
        const { days = 7, resource } = req.query;
        const daysInt = parseInt(days);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysInt);

        let filter = { usage_date: { $gte: startDate, $lte: endDate } };

        // Role-based filtering
        if (req.user.role === ROLES.STUDENT) {
            filter.userId = new mongoose.Types.ObjectId(req.user.id);
        } else if (req.user.role === ROLES.WARDEN) {
            const user = await require('../models/User').findById(req.user.id);
            if (user.block) filter.blockId = user.block;
        }

        if (resource) {
            filter.resource_type = resource;
        }

        const trends = await Usage.aggregate([
            { $match: filter },
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

        res.json({
            success: true,
            trends: trends.map(t => ({
                resource: t._id,
                data: t.data
            })),
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
        if (req.user.role === ROLES.STUDENT) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Get today's usage by resource and block
        const todayUsage = await Usage.aggregate([
            {
                $match: {
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

        // Role-based filtering
        if (req.user.role === ROLES.STUDENT) {
            filter.userId = new mongoose.Types.ObjectId(req.user.id);
        } else if (blockId) {
            filter.blockId = blockId;
        } else if (req.user.role === ROLES.WARDEN) {
            const user = await require('../models/User').findById(req.user.id);
            if (user.block) filter.blockId = user.block;
        }

        // Get actual usage by resource
        const actualUsage = await Usage.aggregate([
            { $match: filter },
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

        // Role-based filtering
        if (req.user.role === ROLES.STUDENT) {
            filter.userId = new mongoose.Types.ObjectId(req.user.id);
        } else if (req.user.role === ROLES.WARDEN) {
            const user = await require('../models/User').findById(req.user.id);
            if (user.block) filter.blockId = user.block;
        }

        const usage = await Usage.aggregate([
            { $match: filter },
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

module.exports = {
    getAnalyticsSummary,
    getResourceTrends,
    detectAnomalies,
    getSustainabilityScore,
    getEfficiencyRating
};
