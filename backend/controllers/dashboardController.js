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
const ResourceConfig = require('../models/ResourceConfig');
const SystemConfig = require('../models/SystemConfig');
const Alert = require('../models/Alert');
const Complaint = require('../models/Complaint');
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
 * safeBlockId — Step 2 Fix: sanitize any incoming blockId value.
 * Handles plain string, populated Mongoose object, and rejects [object Object].
 */
function safeBlockId(raw) {
    if (!raw) return null;
    // If it's an object (populated doc), extract _id
    if (typeof raw === 'object' && raw._id) raw = raw._id;
    const str = raw.toString();
    if (str.includes('[object') || str.length !== 24) {
        console.warn('[Dashboard] Invalid blockId rejected:', str);
        return null;
    }
    if (!mongoose.Types.ObjectId.isValid(str)) return null;
    return new mongoose.Types.ObjectId(str);
}

/**
 * Returns current-month total vs previous-month total for a resource,
 * plus a percentageChange and trend direction.
 */
async function getMonthlyTrend(matchBase, resourceType) {
    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const filter = {
        ...matchBase,
        resource_type: { $regex: new RegExp(`^${resourceType}$`, 'i') },
        deleted: { $ne: true }
    };

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

    const filter = {
        ...matchBase,
        resource_type: { $regex: new RegExp(`^${resourceType}$`, 'i') },
        usage_date: { $gte: startDate, $lte: endDate },
        deleted: { $ne: true }
    };

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
        console.log("Dashboard API HIT - Student");
        const userId = req.userId || req.user?.id;
        const user = await User.findById(userId).select('block').lean();
        if (!user) return apiError(res, 'User not found', 404);

        const { start: monthStart } = currentMonthRange();
        const { start: todayStart } = todayRange();

        // ──  Block-level usage this month (per resource) - Requirement: Prioritize block-level scoping
        let personalUsage = [];
        if (user.block) {
            personalUsage = await Usage.aggregate([
                {
                    $match: {
                        blockId: new mongoose.Types.ObjectId(user.block.toString()),
                        usage_date: { $gte: monthStart },
                        deleted: { $ne: true }
                    }
                },
                { $group: { _id: '$resource_type', total: { $sum: '$usage_value' }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]);
        }

        // ──  Today's Block usage - Requirement: Prioritize block-level scoping
        let todayPersonal = [];
        if (user.block) {
            todayPersonal = await Usage.aggregate([
                {
                    $match: {
                        blockId: new mongoose.Types.ObjectId(user.block.toString()),
                        usage_date: { $gte: todayStart },
                        deleted: { $ne: true }
                    }
                },
                { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
            ]);
        }

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
        console.log("Dashboard API HIT - Warden");
        const userId = req.userId || req.user?.id;
        const user = await User.findById(userId).select('block').lean();
        if (!user) return apiError(res, 'User not found', 404);
        if (!user.block) return apiSuccess(res, {
            data: {
                electricity: { current: 0, previous: 0, percentageChange: 0, direction: 'stable' },
                water: { current: 0, previous: 0, percentageChange: 0, direction: 'stable' },
                activeAlerts: 0,
                todayUsage: [],
                recentAlerts: [],
                blockName: 'Unassigned',
                message: 'Please contact the administrator to assign you a block.'
            }
        });

        // Step 2 Fix: Safe blockId extraction (handles populated object or raw ID)
        const blockObjId = safeBlockId(user.block);
        if (!blockObjId) return apiSuccess(res, {
            summary: {}, totals: {}, trend: [], alerts: [],
            blockName: 'Unassigned',
            message: 'Block ID is invalid. Please contact the administrator.'
        });
        const blockId = blockObjId;
        const matchBase = { blockId: blockObjId };

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
            { $match: { ...matchBase, usage_date: { $gte: todayStart }, deleted: { $ne: true } } },
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
        console.log("Dashboard API HIT - Executive");
        console.log(`[Dashboard] Fetching executive stats for role: ${req.user?.role}`);

        // Step 2 Fix: Sanitize optional blockId query param
        let blockIdFilter = null;
        if (req.query.blockId) {
            blockIdFilter = safeBlockId(req.query.blockId);
            if (!blockIdFilter) console.warn('[Dashboard] Ignoring invalid blockId query param');
        }
        console.log('FILTER blockId:', blockIdFilter || 'campus-wide');

        const { start: monthStart } = currentMonthRange();
        const totalBlocks = await Block.countDocuments();
        const totalUsers = await User.countDocuments();

        // 1. Trends Over Time (Global Daily Aggregation for last 7 days)
        const trendsOverTime = await Usage.aggregate([
            { $match: { usage_date: { $gte: daysAgo(7) }, deleted: { $ne: true } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } },
                    total: { $sum: '$usage_value' }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: '$_id', total: { $round: ['$total', 2] } } }
        ]);

        // 2. Resource-wise Summary (Dynamic & Case-Insensitive)
        const aggregated = await Usage.aggregate([
            { $match: { usage_date: { $gte: monthStart }, deleted: { $ne: true } } },
            {
                $group: {
                    _id: { $toLower: '$resource_type' },
                    total: { $sum: '$usage_value' },
                    count: { $sum: 1 },
                    avgValue: { $avg: '$usage_value' },
                    maxValue: { $max: '$usage_value' },
                    lastDate: { $max: '$usage_date' },
                    totalCost: { $sum: { $multiply: ['$usage_value', 0] } } // Cost will be derived via rates later if needed, mostly a placeholder
                }
            }
        ]);

        const configs = await ResourceConfig.find({ isActive: true }).lean();
        const summary = {};

        configs.forEach(cfg => {
            const key = cfg.name.toLowerCase();

            const usage = aggregated.find(
                u => u._id && u._id.toLowerCase() === key
            );

            summary[cfg.name] = {
                total: usage?.total || 0,
                current: usage?.total || 0,
                count: usage?.count || 0,
                avgValue: usage?.avgValue || 0,
                maxValue: usage?.maxValue || 0,
                lastDate: usage?.lastDate || null,
                unit: cfg.unit,
                monthlyLimit: cfg.monthlyLimit,
                icon: cfg.icon,
                color: cfg.color,
                totalCost: usage?.totalCost || 0
            };
        });

        // 3. Grand Total Calculation
        const grandTotal = Object.values(summary).reduce((a, b) => a + (b.total || 0), 0);

        // 4. Campus-wide monthly trends (Specific resources)
        const [electricity, water] = await Promise.all([
            getMonthlyTrend({}, 'Electricity'),
            getMonthlyTrend({}, 'Water'),
        ]);

        // 5. Financials (Cost Estimation)
        const rateConfigs = await ResourceConfig.find({ isActive: true, isDeleted: false }).lean();

        const rateMap = rateConfigs.reduce((acc, c) => {
            acc[c.resource || c.name] = c.costPerUnit ?? c.rate ?? 0;
            return acc;
        }, {});

        const estimatedCost = parseFloat(
            ((electricity.current * (rateMap['Electricity'] || 0)) +
                (water.current * (rateMap['Water'] || 0))).toFixed(2)
        );

        // 6. Block Rankings (Top 5 Consumers)
        const blockUsageAgg = await Usage.aggregate([
            { $match: { resource_type: { $regex: /^electricity$/i }, usage_date: { $gte: monthStart }, deleted: { $ne: true } } },
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

        // 7. Active Alerts & Critical Issues
        const activeCampusAlerts = await Alert.countDocuments({
            status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] }
        });
        const criticalAlerts = await Alert.find({
            severity: { $in: ['Critical', 'Severe'] },
            status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] }
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('block', 'name')
            .lean();

        const recentComplaints = await Complaint.find({ status: { $ne: 'resolved' } })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name')
            .lean();

        const unresolvedComplaintsCount = await Complaint.countDocuments({ status: { $ne: 'resolved' } });

        // 8. Construct Final Structure with Safety Fallback
        const dashboardData = {
            summary: summary || {},
            usageSummary: summary || {}, // Mapping for Admin Dashboard
            grandTotal: parseFloat((grandTotal || 0).toFixed(2)),
            trendsOverTime: trendsOverTime || [],
            blockRanking: blockRanking || [],
            totalBlocks,
            totalUsers,                  // Added field
            totalResources: configs?.length || 0,
            activeCampusAlerts: activeCampusAlerts || 0,
            alertsCount: activeCampusAlerts || 0, // Mapping for Admin Dashboard
            criticalAlerts: criticalAlerts || [],
            recentComplaints: recentComplaints || [],
            unresolvedComplaintsCount: unresolvedComplaintsCount || 0,
            financial: {
                estimatedCost: estimatedCost || 0,
                currency: 'INR',
                trend: electricity?.direction || 'stable'
            },
            trends: { electricity, water }
        };

        return res.json({
            success: true,
            data: {
                summary: dashboardData.summary || {},
                usageSummary: dashboardData.usageSummary || {},
                grandTotal: dashboardData.grandTotal || 0,
                trendsOverTime: dashboardData.trendsOverTime || [],
                blockRanking: dashboardData.blockRanking || [],
                totalBlocks: dashboardData.totalBlocks || 0,
                totalUsers: dashboardData.totalUsers || 0,
                totalResources: dashboardData.totalResources || 0,
                activeCampusAlerts: dashboardData.activeCampusAlerts || 0,
                alertsCount: dashboardData.alertsCount || 0,
                criticalAlerts: dashboardData.criticalAlerts || [],
                recentComplaints: dashboardData.recentComplaints || [],
                unresolvedComplaintsCount: dashboardData.unresolvedComplaintsCount,
                financial: dashboardData.financial || {}
            }
        });

    } catch (err) {
        console.error('[Dashboard] getExecutiveStats error:', err);
        return apiError(res, err.message);
    }
};
