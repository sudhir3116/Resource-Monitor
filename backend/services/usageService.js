const mongoose = require('mongoose');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Resource = require('../models/Resource');

// ── Helper: Safe ObjectId Conversion ──────────────────────────────────────────
const toObjectId = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string' && raw.includes('[object')) return null;
    const s = raw?._id?.toString() || raw?.toString() || null;
    if (!s || s.length !== 24) return null;
    try {
        return new mongoose.Types.ObjectId(s);
    } catch (e) {
        return null;
    }
};

/**
 * getUsageSummary
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified service for all role-based dashboards.
 * Admin/GM see everything. Warden/Student filtered by block.
 */
exports.getUsageSummary = async (options = {}) => {
    const { role, blockId, userId, startDate, endDate } = options;
    const normalizedRole = (role || '').toLowerCase();

    // ── 1. Build match stage (Standardized Role Handling) ─────────────────────
    const matchStage = { deleted: { $ne: true } };
    const bId = toObjectId(blockId);
    const uId = toObjectId(userId);

    console.log("Dashboard fetch request - Role:", normalizedRole, "BlockId:", blockId);

    if (normalizedRole === 'warden') {
        if (bId) {
            matchStage.blockId = bId;
        } else {
            // Warden MUST have a block, but we return empty instead of crashing
            return { summary: {}, summaryArray: [], grandTotal: 0, alertsCount: 0, resourceCount: 0, role: normalizedRole };
        }
    } else if (normalizedRole === 'student') {
        if (bId) {
            matchStage.blockId = bId;
        } else if (uId) {
            matchStage.userId = uId;
        } else {
            return { summary: {}, summaryArray: [], grandTotal: 0, alertsCount: 0, resourceCount: 0, role: normalizedRole };
        }
    } else if (['admin', 'gm', 'dean', 'principal'].includes(normalizedRole)) {
        // GLOBAL ACCESS: No filters added to matchStage
        // This ensures Dean/Principal/GM dashboards reflect overall campus status
    }

    console.log("Match filter applied:", matchStage);

    if (startDate || endDate) {
        matchStage.usage_date = {};
        if (startDate) matchStage.usage_date.$gte = new Date(startDate);
        if (endDate) matchStage.usage_date.$lte = new Date(endDate);
    }

    // ── 2. Aggregate Usage Data (Requirement: Standard Query) ───────────────────
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: '$resource_type',
                total: { $sum: '$usage_value' },
                count: { $sum: 1 },
                avgValue: { $avg: '$usage_value' },
                maxValue: { $max: '$usage_value' },
                lastDate: { $max: '$usage_date' },
                totalCost: { $sum: { $ifNull: ['$cost', 0] } }
            }
        }
    ];

    const results = await Usage.aggregate(pipeline);
    console.log("Aggregated usage (Raw):", results); // Mandatory Debug Logging

    const configs = await Resource.find({
        $or: [
            { isActive: { $ne: false } },
            { status: 'active' }
        ]
    }).lean();

    // ── 3. Map Configs to Summary (Requirement: item.total / item._id) ─────────
    const summary = {};
    const summaryArray = []; // For frontend components that iterate directly

    configs.forEach(cfg => {
        const result = results.find(r =>
            (r._id || '').toString().toLowerCase() === (cfg.name || '').toString().toLowerCase()
        ) || { total: 0, count: 0 };

        const total = Math.round((result.total || 0) * 100) / 100;
        const rate = cfg.rate || cfg.costPerUnit || 0;

        const metrics = {
            _id: cfg.name,
            resource_type: cfg.name,
            total,
            current: total,
            count: result.count || 0,
            avgValue: Math.round((result.avgValue || 0) * 100) / 100,
            maxValue: result.maxValue || 0,
            lastDate: result.lastDate || null,
            unit: cfg.unit || 'units',
            monthlyLimit: cfg.monthlyLimit || 1000,
            icon: cfg.icon || '📊',
            color: cfg.color || '#64748b',
            totalCost: Math.round((result.totalCost || (total * rate)) * 100) / 100
        };

        summary[cfg.name] = metrics;
        summaryArray.push(metrics);
    });

    console.log("Aggregated usage (Mapped Summary):", summary); // Mandatory Debug Logging

    const grandTotal = Object.values(summary).reduce((sum, r) => sum + r.total, 0);

    // ── 4. Alert Count ────────────────────────────────────────────────────────
    const alertFilter = { status: { $nin: ['Resolved', 'Dismissed'] } };
    if (normalizedRole === 'warden' && bId) {
        alertFilter.block = bId;
    } else if (normalizedRole === 'student' && (bId || uId)) {
        if (bId) alertFilter.block = bId;
        else alertFilter.user = uId;
    }
    const alertsCount = await Alert.countDocuments(alertFilter);

    return {
        summary,
        summaryArray,
        grandTotal: Math.round(grandTotal * 100) / 100,
        alertsCount,
        resourceCount: configs.length,
        role: normalizedRole
    };
};

/**
 * getUsageTrends
 * ─────────────────────────────────────────────────────────────────────────────
 * Groups by date and resource_type for line charts.
 */
exports.getUsageTrends = async (options = {}) => {
    const { role, blockId, userId, range = '7d' } = options;
    const normalizedRole = (role || '').toLowerCase();

    const endDate = new Date();
    let startDate = new Date();
    if (range === '7d') startDate.setDate(endDate.getDate() - 7);
    else if (range === '30d') startDate.setDate(endDate.getDate() - 30);
    else startDate.setDate(endDate.getDate() - 7);

    const matchStage = {
        deleted: { $ne: true },
        usage_date: { $gte: startDate, $lte: endDate }
    };

    const bId = toObjectId(blockId);
    if (['warden', 'student'].includes(normalizedRole) && bId) {
        matchStage.blockId = bId;
    }

    const trends = await Usage.aggregate([
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

    const trendMap = {};
    trends.forEach(t => {
        const d = t._id.date;
        const r = t._id.resource;
        if (!trendMap[d]) trendMap[d] = { date: d };
        trendMap[d][r] = Math.round(t.total * 100) / 100;
    });

    return Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
};

