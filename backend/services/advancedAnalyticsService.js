/**
 * services/advancedAnalyticsService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Advanced analytics: predictions, anomalies, comparisons, forecasting
 */

const Usage = require('../models/Usage');
const ResourceConfig = require('../models/ResourceConfig');
const Block = require('../models/Block');
const mongoose = require('mongoose');

/**
 * Simple moving average prediction for next N days
 */
exports.predictUsage = async (options = {}) => {
    const { resource_type, blockId, days = 7, forecastDays = 7 } = options;

    const matchStage = {
        deleted: { $ne: true },
        resource_type
    };

    if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    matchStage.usage_date = { $gte: startDate, $lte: now };

    // Fetch historical data
    const history = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } },
                total: { $sum: '$usage_value' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    if (history.length < 3) {
        return {
            status: 'insufficient_data',
            message: 'Not enough historical data for prediction',
            minimumDataPoints: 3,
            availableDataPoints: history.length
        };
    }

    // Calculate moving average
    const values = history.map(h => h.total);
    const ma = values.reduce((a, b) => a + b) / values.length;
    const std = Math.sqrt(
        values.reduce((e, d) => e + Math.pow(d - ma, 2)) / values.length
    );

    // Trend calculation
    const trend = (values[values.length - 1] - values[0]) / values.length;

    // Generate forecast
    const forecast = [];
    for (let i = 1; i <= forecastDays; i++) {
        const predictedValue = ma + (trend * i);
        const upperBound = predictedValue + (1.96 * std); // 95% confidence interval
        const lowerBound = Math.max(0, predictedValue - (1.96 * std));

        forecast.push({
            day: i,
            date: new Date(now.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            predicted: Math.round(predictedValue * 100) / 100,
            upperBound: Math.round(upperBound * 100) / 100,
            lowerBound: Math.round(lowerBound * 100) / 100
        });
    }

    return {
        status: 'success',
        resource: resource_type,
        historicalAverage: Math.round(ma * 100) / 100,
        trend: trend > 0 ? 'increasing' : 'decreasing',
        trendValue: Math.round(trend * 100) / 100,
        volatility: Math.round(std * 100) / 100,
        forecast,
        confidence: '95%'
    };
};

/**
 * Detect anomalies in usage patterns
 */
exports.detectAnomalies = async (options = {}) => {
    const { blockId, resource_type, threshold = 2 } = options; // threshold in std deviations

    const matchStage = {
        deleted: { $ne: true }
    };

    if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }
    if (resource_type) {
        matchStage.resource_type = resource_type;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    matchStage.usage_date = { $gte: thirtyDaysAgo };

    // Get daily aggregates
    const dailyData = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } },
                    resource: '$resource_type'
                },
                total: { $sum: '$usage_value' }
            }
        },
        { $sort: { '_id.date': 1 } }
    ]);

    // Group by resource
    const byResource = {};
    dailyData.forEach(d => {
        const res = d._id.resource;
        if (!byResource[res]) byResource[res] = [];
        byResource[res].push({ date: d._id.date, value: d.total });
    });

    const anomalies = [];

    // Detect anomalies per resource
    Object.entries(byResource).forEach(([res, data]) => {
        if (data.length < 5) return; // Need at least 5 days

        const values = data.map(d => d.value);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const std = Math.sqrt(values.reduce((e, d) => Math.pow(d - mean, 2)) / values.length);

        data.forEach((d, idx) => {
            const zScore = Math.abs((d.value - mean) / std);
            if (zScore > threshold) {
                anomalies.push({
                    date: d.date,
                    resource: res,
                    value: d.value,
                    expectedValue: Math.round(mean * 100) / 100,
                    zScore: Math.round(zScore * 100) / 100,
                    severity: zScore > 3 ? 'high' : zScore > 2 ? 'medium' : 'low',
                    type: d.value > mean ? 'spike' : 'dip'
                });
            }
        });
    });

    return {
        anomaliesFound: anomalies.length,
        timeWindow: '30 days',
        threshold: `${threshold} standard deviations`,
        anomalies: anomalies.slice(0, 20) // Return top 20
    };
};

/**
 * Compare usage between blocks
 */
exports.compareBlocks = async (options = {}) => {
    const { resource_type, days = 30 } = options;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const blockStats = await Usage.aggregate([
        {
            $match: {
                deleted: { $ne: true },
                usage_date: { $gte: startDate },
                resource_type: resource_type || { $exists: true }
            }
        },
        {
            $group: {
                _id: '$blockId',
                totalUsage: { $sum: '$usage_value' },
                avgDaily: { $avg: '$usage_value' },
                count: { $sum: 1 },
                maxValue: { $max: '$usage_value' },
                minValue: { $min: '$usage_value' }
            }
        },
        { $sort: { totalUsage: -1 } }
    ]);

    // Fetch block names
    const blockIds = blockStats.map(s => s._id);
    const blocks = await Block.find({ _id: { $in: blockIds } }).lean();
    const blockMap = {};
    blocks.forEach(b => blockMap[b._id.toString()] = b.name);

    // Calculate rankings
    const totalUsageAvg = blockStats.reduce((a, b) => a + b.totalUsage, 0) / blockStats.length;

    const comparison = blockStats.map((stat, idx) => ({
        rank: idx + 1,
        blockId: stat._id,
        blockName: blockMap[stat._id.toString()] || 'Unknown',
        totalUsage: Math.round(stat.totalUsage * 100) / 100,
        avgDaily: Math.round(stat.avgDaily * 100) / 100,
        readings: stat.count,
        maxValue: stat.maxValue,
        minValue: stat.minValue,
        efficiency: stat.totalUsage > totalUsageAvg ? 'High' : stat.totalUsage > totalUsageAvg * 0.8 ? 'Medium' : 'Low',
        variance: Math.round((((stat.totalUsage - totalUsageAvg) / totalUsageAvg) * 100) * 100) / 100
    }));

    return {
        resource: resource_type || 'All Resources',
        period: `${days} days`,
        blocksCompared: comparison.length,
        averageUsage: Math.round(totalUsageAvg * 100) / 100,
        highestUsage: {
            block: comparison[0]?.blockName,
            usage: comparison[0]?.totalUsage
        },
        lowestUsage: {
            block: comparison[comparison.length - 1]?.blockName,
            usage: comparison[comparison.length - 1]?.totalUsage
        },
        comparison
    };
};

/**
 * Month-over-month comparison
 */
exports.monthOverMonthComparison = async (options = {}) => {
    const { blockId, resource_type, months = 3 } = options;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const periods = [];
    for (let i = 0; i < months; i++) {
        let m = currentMonth - i;
        let y = currentYear;
        while (m < 0) {
            m += 12;
            y -= 1;
        }
        periods.push({ month: m, year: y });
    }

    const comparison = [];

    for (const period of periods) {
        const startDate = new Date(period.year, period.month, 1);
        const endDate = new Date(period.year, period.month + 1, 1);

        const matchStage = {
            deleted: { $ne: true },
            usage_date: { $gte: startDate, $lt: endDate }
        };

        if (blockId) {
            matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
        }
        if (resource_type) {
            matchStage.resource_type = resource_type;
        }

        const monthData = await Usage.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$usage_value' },
                    avgDaily: { $avg: '$usage_value' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const data = monthData[0] || { total: 0, avgDaily: 0, count: 0 };

        comparison.push({
            month: startDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
            total: Math.round(data.total * 100) / 100,
            avgDaily: Math.round(data.avgDaily * 100) / 100,
            readings: data.count
        });
    }

    // Calculate trend
    const trend = comparison.length > 1 
        ? ((comparison[0].total - comparison[1].total) / comparison[1].total * 100)
        : 0;

    return {
        resource: resource_type || 'All',
        periods: comparison,
        trend: Math.round(trend * 100) / 100,
        trendDirection: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
    };
};

/**
 * Peak hours analysis
 */
exports.peakHoursAnalysis = async (options = {}) => {
    const { blockId, days = 7 } = options;

    const matchStage = {
        deleted: { $ne: true }
    };

    if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    matchStage.usage_date = { $gte: startDate };

    const hourlyData = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: { $hour: '$usage_date' },
                total: { $sum: '$usage_value' },
                count: { $sum: 1 },
                avgValue: { $avg: '$usage_value' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const hourlyStats = [];
    for (let hour = 0; hour < 24; hour++) {
        const data = hourlyData.find(d => d._id === hour) || { total: 0, count: 0, avgValue: 0 };
        hourlyStats.push({
            hour: `${hour}:00`,
            total: Math.round(data.total * 100) / 100,
            readings: data.count,
            avgValue: Math.round(data.avgValue * 100) / 100
        });
    }

    const peakHour = hourlyStats.reduce((max, curr) => curr.total > max.total ? curr : max);
    const lowHour = hourlyStats.reduce((min, curr) => curr.total < min.total && curr.total > 0 ? curr : min);

    return {
        period: `${days} days`,
        hourlyBreakdown: hourlyStats,
        peakPeriod: {
            hour: peakHour.hour,
            usage: peakHour.total
        },
        lowPeriod: {
            hour: lowHour.hour,
            usage: lowHour.total
        }
    };
};

/**
 * Resource efficiency comparison
 */
exports.resourceEfficiency = async (options = {}) => {
    const { blockId, days = 30 } = options;

    const matchStage = {
        deleted: { $ne: true }
    };

    if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    matchStage.usage_date = { $gte: startDate };

    const resourceStats = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$resource_type',
                total: { $sum: '$usage_value' },
                avgDaily: { $avg: '$usage_value' },
                count: { $sum: 1 }
            }
        },
        { $sort: { total: -1 } }
    ]);

    const configs = await ResourceConfig.find({ isActive: { $ne: false } }).lean();
    const configMap = {};
    configs.forEach(c => configMap[c.name] = c);

    const efficiency = resourceStats.map(stat => {
        const config = configMap[stat._id] || {};
        const monthlyLimit = config.monthlyLimit || 0;
        const utilizationPercent = monthlyLimit ? (stat.total / monthlyLimit) * 100 : 0;

        return {
            resource: stat._id,
            total: Math.round(stat.total * 100) / 100,
            avgDaily: Math.round(stat.avgDaily * 100) / 100,
            monthlyLimit: monthlyLimit || 'N/A',
            utilizationPercent: Math.round(utilizationPercent * 100) / 100,
            status: utilizationPercent > 100 ? 'Over Limit' : utilizationPercent > 80 ? 'High' : 'Normal'
        };
    });

    return {
        period: `${days} days`,
        efficiency,
        totalResources: efficiency.length,
        resourcesOverLimit: efficiency.filter(e => e.status === 'Over Limit').length
    };
};

module.exports = exports;
