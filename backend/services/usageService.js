const mongoose = require('mongoose');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const ResourceConfig = require('../models/ResourceConfig');

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

    console.log("[UsageService] Dashboard request - Role:", normalizedRole, "BlockId:", blockId);

    if (normalizedRole === 'warden') {
        if (bId) {
            matchStage.blockId = bId;
        } else {
            console.warn("[UsageService] Warden missing block context, returning empty stats.");
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
        // GLOBAL ACCESS
        if (bId) matchStage.blockId = bId; // Optional drill-down
    }

    if (startDate || endDate) {
        matchStage.usage_date = {};
        if (startDate) matchStage.usage_date.$gte = new Date(startDate);
        if (endDate) matchStage.usage_date.$lte = new Date(endDate);
    }

    // ── 2. Aggregate Usage Data ────────────────────────────────────────────────
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: { $toLower: { $trim: { input: '$resource_type' } } },
                total: { $sum: '$usage_value' },
                count: { $sum: 1 },
                avgValue: { $avg: '$usage_value' },
                maxValue: { $max: '$usage_value' },
                lastDate: { $max: '$usage_date' },
                totalCost: { $sum: { $ifNull: ['$cost', 0] } }
            }
        }
    ];

    console.log("[UsageService] Aggregation Pipeline Match:", JSON.stringify(matchStage));
    const results = await Usage.aggregate(pipeline);
    console.log("[UsageService] Raw Aggregation Result Count:", results.length);

    // ── 3. Map Configs to Summary (Dynamic & Case-Insensitive) ─────────
    const configs = await ResourceConfig.find({ isActive: { $ne: false }, isDeleted: { $ne: true } }).lean();
    const summary = {};
    const summaryArray = [];

    configs.forEach(cfg => {
        const key = (cfg.name || '').trim().toLowerCase();
        const usage = results.find(item => (item._id || '').toString().toLowerCase() === key);

        const metrics = {
            _id: cfg.name,
            resource_type: cfg.name,
            total: usage ? Math.round(usage.total * 100) / 100 : 0,
            current: usage ? Math.round(usage.total * 100) / 100 : 0,
            count: usage ? usage.count : 0,
            avgValue: usage ? Math.round(usage.avgValue * 100) / 100 : 0,
            maxValue: usage ? usage.maxValue : 0,
            lastDate: usage ? usage.lastDate : null,
            unit: cfg.unit || 'units',
            monthlyLimit: cfg.monthlyLimit || 1000,
            icon: cfg.icon || '📊',
            color: cfg.color || '#64748b',
            totalCost: usage ? Math.round((usage.total * (cfg.costPerUnit || 0)) * 100) / 100 : 0
        };

        summary[cfg.name] = metrics;
        summaryArray.push(metrics);
    });

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

    const sustainabilityScore = await calculateSustainabilityScore(uId, normalizedRole, bId);

    return {
        summary,
        summaryArray,
        grandTotal: Math.round(grandTotal * 100) / 100,
        alertsCount,
        resourceCount: configs.length,
        sustainabilityScore,
        role: normalizedRole
    };
};

/**
 * calculateSustainabilityScore
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculates the score based on thresholds and trends.
 */
async function calculateSustainabilityScore(userId, userRole, blockId) {
    try {
        let score = 100;
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let matchStage = { usage_date: { $gte: currentMonthStart }, deleted: { $ne: true } };

        if (userRole === 'student') {
            if (blockId) matchStage.blockId = blockId;
            else if (userId) matchStage.userId = userId;
            else return 0;
        } else if (userRole === 'warden' && blockId) {
            matchStage.blockId = blockId;
        }

        const usageStats = await Usage.aggregate([
            { $match: matchStage },
            { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
        ]);

        let totalPenalty = 0;
        // If it's block-wide data (common for students viewing block stats), we use higher thresholds.
        // Otherwise, it's individual usage and we use personal thresholds.
        const multiplier = (blockId) ? 50 : 1;

        usageStats.forEach(stat => {
            const type = (stat._id || '').toString().toLowerCase();
            const total = stat.total || 0;
            if (type === 'solar' && total > (100 * multiplier)) totalPenalty -= 10;
            if (type === 'waste' && total > (100 * multiplier)) totalPenalty += 20;
            if (type === 'diesel' && total > (50 * multiplier)) totalPenalty += 20;
            if (type === 'electricity' && total > (1000 * multiplier)) totalPenalty += 15;
            if (type === 'water' && total > (5000 * multiplier)) totalPenalty += 10;
        });

        score -= totalPenalty;
        return Math.max(0, Math.min(100, Math.round(score)));
    } catch (err) {
        return 70;
    }
}

/**
 * getBlockComparison
 * ─────────────────────────────────────────────────────────────────────────────
 * Compares all blocks based on their current month usage efficiency.
 * Returns: [{ block: 'Block A', score: 85 }]
 */
exports.getBlockComparison = async () => {
    try {
        const Block = require('../models/Block');
        const ResourceConfig = require('../models/ResourceConfig');
        const Usage = require('../models/Usage');
        
        // 1. Get configs for thresholds
        const configs = await ResourceConfig.find({ isActive: true, isDeleted: false }).lean();
        if (!configs || configs.length === 0) return [];

        // 2. Get active blocks
        const blocks = await Block.find({ isDeleted: { $ne: true } }).lean();
        if (!blocks || blocks.length === 0) return [];

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 3. Score calculation
        const comparisons = await Promise.all(blocks.map(async (block) => {
            const usageData = await Usage.aggregate([
                { $match: { blockId: block._id, usage_date: { $gte: startOfMonth }, deleted: { $ne: true } } },
                { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
            ]);

            let totalRatio = 0;
            let totalCost = 0;
            let resourceCountSeen = 0;

            usageData.forEach(stat => {
                const config = configs.find(c => (c.name || '').toLowerCase() === (stat._id || '').toString().toLowerCase());
                if (config) {
                    resourceCountSeen++;
                    const usageVal = stat.total || 0;
                    const limit = config.monthlyLimit || 1; // avoid div by zero
                    const rate = config.costPerUnit || 0;

                    totalRatio += (usageVal / limit);
                    totalCost += (usageVal * rate);
                }
            });

            // Normalization: Use at least 1 config to avoid NaN
            const divisor = Math.max(configs.length, 1);
            const averageRatio = totalRatio / divisor;

            // Score: 100 is best (0 usage), drops as usage increases.
            // If they use exactly the limit on average, score is 50.
            // If they are way over the limit, it goes to 0.
            // Formula: 100 - (ratio * 50) => if ratio is 1, score is 50.
            const finalScore = Math.max(0, 100 - (averageRatio * 50));

            return {
                block: block.name,
                score: Math.round(finalScore),
                totalCost: Math.round(totalCost),
                usageCount: usageData.length
            };
        }));

        // Sort descending (best performance first)
        return comparisons.sort((a, b) => b.score - a.score);
    } catch (err) {
        console.error('[UsageService] getBlockComparison error:', err);
        return [];
    }
};

/**
 * getUsageTrends
 * ─────────────────────────────────────────────────────────────────────────────
 * Groups by date and resource_type for line charts.
 */
exports.getUsageTrends = async (options = {}) => {
    const { role, blockId, userId, range = '7d' } = options;
    const normalizedRole = (role || '').toLowerCase();

    // Parse range string → days
    const rangeToDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = typeof range === 'number' ? range : (rangeToDays[range] || 30);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const matchStage = {
        deleted: { $ne: true },
        usage_date: { $gte: startDate, $lte: endDate }
    };

    const bId = toObjectId(blockId);
    if (normalizedRole === 'warden' || normalizedRole === 'student') {
        if (bId) {
            matchStage.blockId = bId;
        } else {
            console.warn('[UsageService] Warden/Student missing block context for trends.');
            return [];
        }
    } else if (bId) {
        matchStage.blockId = bId;
    }

    const trends = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } },
                    resource: { $toLower: { $trim: { input: '$resource_type' } } }
                },
                total: { $sum: '$usage_value' }
            }
        },
        { $sort: { '_id.date': 1 } }
    ]);

    // Build config map for proper casing (Electricity, Water, etc.)
    const configs = await ResourceConfig.find({ isActive: true, isDeleted: { $ne: true } }).lean();
    const configMap = {};
    const resourceNames = [];
    configs.forEach(c => {
        const name = (c.name || 'Resource').trim();
        configMap[name.toLowerCase()] = name;
        resourceNames.push(name);
    });

    const result = {};

    trends.forEach(item => {
        const date = item._id.date;
        const typeRaw = item._id.resource || '';
        // Map back to proper-cased config name
        const type = configMap[typeRaw] || (typeRaw.charAt(0).toUpperCase() + typeRaw.slice(1));

        if (!result[date]) {
            // Initialise row with zeroes for all configured resources
            result[date] = { date };
            resourceNames.forEach(name => { result[date][name] = 0; });
        }

        if (result[date][type] !== undefined) {
            result[date][type] = Math.round((result[date][type] + item.total) * 100) / 100;
        } else {
            result[date][type] = Math.round(item.total * 100) / 100;
        }
    });

    return Object.values(result).sort((a, b) => a.date.localeCompare(b.date));
};
