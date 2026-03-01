/**
 * controllers/dashboardController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Stable, data-driven dashboard stats for every role.
 * All values derived from MongoDB aggregation — zero hardcoded metrics.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Usage = require('../models/Usage');
const Block = require('../models/Block');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const Alert = require('../models/Alert');
const mongoose = require('mongoose');
const {
    currentMonthRange,
    todayRange,
    daysAgo,
    apiSuccess,
    apiError,
    ALERT_STATUS,
} = require('../config/constants');

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns current-month total vs previous-month total for a resource,
 * plus a percentageChange and trend direction.
 */
async function getMonthlyTrend(matchBase, resourceType) {
    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const filter = { ...matchBase, resource_type: resourceType };

    const [curAgg, prevAgg] = await Promise.all([
        Usage.aggregate([
            { $match: { ...filter, usage_date: { $gte: curStart } } },
            { $group: { _id: null, total: { $sum: '$usage_value' } } }
        ]),
        Usage.aggregate([
            { $match: { ...filter, usage_date: { $gte: prevStart, $lte: prevEnd } } },
            { $group: { _id: null, total: { $sum: '$usage_value' } } }
        ]),
    ]);

    const current = curAgg[0]?.total || 0;
    const previous = prevAgg[0]?.total || 0;

    let percentageChange = 0;
    if (previous > 0) {
        percentageChange = ((current - previous) / previous) * 100;
    } else if (current > 0) {
        percentageChange = 100;
    }

    return {
        current: parseFloat(current.toFixed(2)),
        previous: parseFloat(previous.toFixed(2)),
        percentageChange: parseFloat(percentageChange.toFixed(1)),
        direction: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable',
    };
}

/**
 * Returns daily aggregated usage for the last N days for a resource.
 * Result: [{ date: 'YYYY-MM-DD', total: <number> }]
 */
async function getDailyTrend(matchBase, resourceType, days = 7) {
    const startDate = daysAgo(days - 1);
    const endDate = new Date(); endDate.setHours(23, 59, 59, 999);

    const filter = { ...matchBase, resource_type: resourceType, usage_date: { $gte: startDate, $lte: endDate } };

    const agg = await Usage.aggregate([
        { $match: filter },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } },
                total: { $sum: '$usage_value' }
            }
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', total: { $round: ['$total', 2] } } }
    ]);

    return agg;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STUDENT DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
exports.getStudentStats = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id;
        const user = await User.findById(userId).lean();
        if (!user) return apiError(res, 'User not found', 404);

        const { start: monthStart } = currentMonthRange();
        const { start: todayStart } = todayRange();

        // ──  Personal usage this month (per resource)
        const personalUsage = await Usage.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), usage_date: { $gte: monthStart } } },
            { $group: { _id: '$resource_type', total: { $sum: '$usage_value' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // ──  Today's personal usage
        const todayPersonal = await Usage.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), usage_date: { $gte: todayStart } } },
            { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
        ]);

        // ──  Block average per-capita (only if student is in a block)
        let blockAvg = [];
        if (user.block) {
            const block = await Block.findById(user.block).lean();
            const capacity = block?.capacity || 1;
            const blockTotal = await Usage.aggregate([
                { $match: { blockId: new mongoose.Types.ObjectId(user.block), usage_date: { $gte: monthStart } } },
                { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
            ]);
            blockAvg = blockTotal.map(b => ({
                resource: b._id,
                blockTotal: parseFloat(b.total.toFixed(2)),
                perCapita: parseFloat((b.total / capacity).toFixed(2)),
            }));
        }

        // ──  My unread alerts (read-only, block-scoped)
        const alertFilter = user.block
            ? { block: user.block, status: { $ne: ALERT_STATUS.RESOLVED } }
            : { user: userId, status: { $ne: ALERT_STATUS.RESOLVED } };
        const myAlerts = await Alert.find(alertFilter)
            .sort({ createdAt: -1 })
            .limit(5)
            .select('message severity status createdAt resourceType')
            .lean();

        return apiSuccess(res, {
            data: {
                personalUsage,
                todayPersonal,
                blockAvg,
                myAlerts,
                block: user.block ? await Block.findById(user.block).select('name capacity').lean() : null,
            }
        });

    } catch (err) {
        console.error('[Dashboard] getStudentStats error:', err);
        return apiError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. WARDEN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
exports.getWardenStats = async (req, res) => {
    try {
        const userId = req.userId || req.user?.id;
        const user = await User.findById(userId).lean();
        if (!user) return apiError(res, 'User not found', 404);
        if (!user.block) return apiError(res, 'Warden is not assigned to a block', 400);

        const blockId = user.block;
        const matchBase = { blockId: new mongoose.Types.ObjectId(blockId) };

        // ──  Monthly trends (current vs previous month)
        const [electricity, water] = await Promise.all([
            getMonthlyTrend(matchBase, 'Electricity'),
            getMonthlyTrend(matchBase, 'Water'),
        ]);

        // ──  Active (unresolved) alerts for this block
        const activeAlerts = await Alert.countDocuments({
            block: blockId,
            status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] }
        });

        // ──  Today's usage by resource
        const { start: todayStart } = todayRange();
        const todayUsage = await Usage.aggregate([
            { $match: { ...matchBase, usage_date: { $gte: todayStart } } },
            { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
        ]);

        // ──  Recent unresolved alerts
        const recentAlerts = await Alert.find({ block: blockId, status: { $ne: ALERT_STATUS.RESOLVED } })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('message severity status createdAt resourceType calculatedPercentage')
            .lean();

        return apiSuccess(res, {
            data: { electricity, water, activeAlerts, todayUsage, recentAlerts }
        });

    } catch (err) {
        console.error('[Dashboard] getWardenStats error:', err);
        return apiError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXECUTIVE DASHBOARD (Admin / Dean / Principal)
// ─────────────────────────────────────────────────────────────────────────────
exports.getExecutiveStats = async (req, res) => {
    try {
        // ──  Campus-wide monthly trends (no block filter)
        const [electricity, water] = await Promise.all([
            getMonthlyTrend({}, 'Electricity'),
            getMonthlyTrend({}, 'Water'),
        ]);

        // ──  Cost estimation from system config rates
        const configs = await SystemConfig.find({}).lean();
        const rateMap = configs.reduce((acc, c) => {
            acc[c.resource] = c.costPerUnit ?? c.rate ?? 0;
            return acc;
        }, {});

        const estimatedCost = parseFloat(
            ((electricity.current * (rateMap['Electricity'] || 0)) +
                (water.current * (rateMap['Water'] || 0))).toFixed(2)
        );

        // ──  Block-level electricity usage this month (single aggregation, not N+1)
        const { start: monthStart } = currentMonthRange();
        const blockUsageAgg = await Usage.aggregate([
            { $match: { resource_type: 'Electricity', usage_date: { $gte: monthStart } } },
            { $group: { _id: '$blockId', total: { $sum: '$usage_value' } } }
        ]);

        const blocksArr = await Block.find({}).select('name capacity').lean();
        const blockMap = blocksArr.reduce((m, b) => { m[b._id.toString()] = b; return m; }, {});

        const blockRanking = blockUsageAgg
            .map(entry => {
                const block = blockMap[entry._id?.toString()] || {};
                const capacity = block.capacity || 1;
                return {
                    name: block.name || 'Unknown',
                    total: parseFloat(entry.total.toFixed(2)),
                    perCapita: parseFloat((entry.total / capacity).toFixed(2)),
                };
            })
            .sort((a, b) => b.perCapita - a.perCapita)
            .slice(0, 5);

        // ──  Campus-wide active alerts
        const activeCampusAlerts = await Alert.countDocuments({
            status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] }
        });

        // ──  Severe + Critical alerts
        const criticalAlerts = await Alert.find({
            severity: { $in: ['Critical', 'Severe'] },
            status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] }
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('message severity status createdAt resourceType block')
            .populate('block', 'name')
            .lean();

        return apiSuccess(res, {
            data: {
                trends: { electricity, water },
                financial: { estimatedCost, currency: 'INR' },
                blockRanking,
                activeCampusAlerts,
                criticalAlerts,
            }
        });

    } catch (err) {
        console.error('[Dashboard] getExecutiveStats error:', err);
        return apiError(res, err.message);
    }
};
