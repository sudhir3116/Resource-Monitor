const mongoose = require('mongoose');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Resource = require('../models/Resource');

/**
 * getUsageSummary
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified service for all role-based dashboards.
 * Dynamically fetches resource list from ResourceConfig collection.
 * Uses correct field names: usage_value, blockId, resource_type
 */
exports.getUsageSummary = async (options = {}) => {
    const { role, blockId, startDate, endDate } = options;
    const normalizedRole = (role || '').toLowerCase();

    // ── Build match stage ──────────────────────────────────────────────────────
    const matchStage = { deleted: { $ne: true } };

    const extractObjId = (raw) => {
        if (!raw) return null;
        const s = raw?._id?.toString() || raw?.toString() || null;
        if (!s || s.length !== 24) return null;
        try { return new mongoose.Types.ObjectId(s); } catch (e) { return null; }
    };

    if (['warden', 'student'].includes(normalizedRole)) {
        if (!blockId) {
            const noConfigs = await Resource.find({ isActive: { $ne: false } }).lean();
            const emptySummary = {};
            noConfigs.forEach(cfg => {
                const resName = cfg.resource || cfg.name;
                emptySummary[resName] = {
                    total: 0, current: 0, cost: 0, count: 0, avgValue: 0, maxValue: 0,
                    unit: cfg.unit || 'units', dailyLimit: cfg.dailyThreshold || cfg.dailyLimit || 0,
                    monthlyLimit: cfg.monthlyThreshold || cfg.monthlyLimit || 0, icon: cfg.icon || '📊',
                    color: cfg.color || '#64748b', lastDate: null
                };
            });
            return {
                summary: emptySummary, totals: {},
                grandTotal: 0, alertsCount: 0,
                resourceCount: noConfigs.length, role: normalizedRole,
                filteredByBlock: true
            };
        }
        const bObjId = extractObjId(blockId);
        if (bObjId) matchStage.blockId = bObjId;
    } else if (blockId) {
        const bObjId = extractObjId(blockId);
        if (bObjId) matchStage.blockId = bObjId;
    }

    if (startDate || endDate) {
        matchStage.usage_date = {};
        if (startDate) matchStage.usage_date.$gte = new Date(startDate);
        if (endDate) matchStage.usage_date.$lte = new Date(endDate);
    }

    // ── Aggregation: Match exact resource_type (must match Resource.resource) ──
    // After normalization, resource_type in Usage = Resource.resource (exact match)
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: '$resource_type',  // exact name, already normalized
                total: { $sum: '$usage_value' },
                count: { $sum: 1 },
                avgValue: { $avg: '$usage_value' },
                maxValue: { $max: '$usage_value' },
                lastDate: { $max: '$usage_date' },
                cost: { $sum: { $ifNull: ['$cost', 0] } }
            }
        },
        { $sort: { _id: 1 } }
    ];

    const [results, configs] = await Promise.all([
        Usage.aggregate(pipeline),
        Resource.find({ isActive: true }).lean()
    ]);

    // Build config map
    const configMap = {};
    configs.forEach(c => { configMap[c.resource || c.name] = c; });

    // Initialize all active resources in summary with 0
    const summary = {};
    configs.forEach(cfg => {
        const resName = cfg.resource || cfg.name;
        summary[resName] = {
            total: 0,
            current: 0,
            cost: 0,
            count: 0,
            avgValue: 0,
            maxValue: 0,
            unit: cfg.unit || 'units',
            dailyLimit: cfg.dailyThreshold || cfg.dailyLimit || 0,
            monthlyLimit: cfg.monthlyThreshold || cfg.monthlyLimit || 0,
            icon: cfg.icon || '📊',
            color: cfg.color || '#64748b',
            lastDate: null
        };
    });

    // Fill with aggregation results
    results.forEach(r => {
        const resourceName = r._id;
        if (!resourceName || !summary[resourceName]) return;

        const cfg = configMap[resourceName] || {};
        summary[resourceName] = {
            ...summary[resourceName],
            total: Math.round(r.total * 100) / 100,
            current: Math.round(r.total * 100) / 100,
            cost: Math.round((r.cost || 0) * 100) / 100,
            count: r.count,
            avgValue: Math.round((r.avgValue || 0) * 100) / 100,
            maxValue: Math.round((r.maxValue || 0) * 100) / 100,
            lastDate: r.lastDate,
            estimatedCost: Math.round(r.total * (cfg.costPerUnit || cfg.rate || 0) * 100) / 100
        };
    });

    // Build simple lowercase totals for backwards compatibility
    const totals = {};
    Object.entries(summary).forEach(([name, data]) => {
        totals[name.toLowerCase()] = data.total || 0;
    });

    const grandTotal = Object.values(summary)
        .reduce((sum, r) => sum + (r.total || 0), 0);

    // Alert count
    const alertFilter = { status: { $in: ['Active', 'Investigating', 'OPEN'] } };
    if (['warden', 'student'].includes(normalizedRole) && blockId) {
        alertFilter.block = new mongoose.Types.ObjectId(blockId.toString());
    } else if (blockId) {
        alertFilter.block = new mongoose.Types.ObjectId(blockId.toString());
    }
    const alertsCount = await Alert.countDocuments(alertFilter);

    return {
        summary,
        totals,
        grandTotal: Math.round(grandTotal * 100) / 100,
        alertsCount,
        resourceCount: Object.keys(summary).length,
        role: normalizedRole,
        filteredByBlock: ['warden', 'student'].includes(normalizedRole)
    };
};

/**
 * getUsageTrends
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified trend data. Groups by date × resource_type.
 */
exports.getUsageTrends = async (options = {}) => {
    const { role, blockId, range = '7d' } = options;
    const normalizedRole = (role || '').toLowerCase();

    const now = new Date();
    let startDate = new Date();

    switch (range) {
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'all':
            startDate = new Date('2020-01-01'); break;
        default:
            startDate.setDate(now.getDate() - 7);
    }

    const matchStage = {
        deleted: { $ne: true },
        usage_date: { $gte: startDate, $lte: now }
    };

    if (['warden', 'student'].includes(normalizedRole) && blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    } else if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }

    // ── Filter by active resources ──────────────────────────────
    const activeConfigs = await Resource.find({ isActive: true }).select('resource').lean();
    const activeNames = new Set(activeConfigs.map(c => c.resource?.toLowerCase()));

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

    // Format for recharts: [{date, Electricity: X, Water: Y, ...}]
    const trendMap = {};
    trends.forEach(t => {
        const date = t._id.date;
        const resource = t._id.resource;

        // Skip if resource is no longer active
        if (!activeNames.has(resource?.toLowerCase())) return;

        if (!trendMap[date]) trendMap[date] = { date };
        trendMap[date][resource] = Math.round(t.total * 100) / 100;
    });

    return Object.values(trendMap).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
    );
};
