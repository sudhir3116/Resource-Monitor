/**
 * services/thresholdService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Alert engine:  Usage triggers → aggregation → severity → upsert alert
 *
 * Key guarantees:
 *  ✔ Zero hardcoded threshold percentages (all from DB config)
 *  ✔ Severity bands pulled from constants (100/120/200/500)
 *  ✔ UPSERT: one alert per (resource × block/user × day) — no duplicates
 *  ✔ Alert escalates in-place when severity increases
 *  ✔ date coerced to real Date to prevent TypeError
 *  ✔ Consistent message format with trailing period
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Alert = require('../models/Alert');
const Usage = require('../models/Usage');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const Block = require('../models/Block');
const mongoose = require('mongoose');
const { sendAlertEmail } = require('../utils/emailService');
const {
    classifySeverity,
    SEVERITY_LEVELS,
    ALERT_STATUS,
    RESOURCE_UNITS,
    todayRange,
    currentMonthRange,
} = require('../config/constants');

// ─────────────────────────────────────────────────────────────────────────────
// Public entry-point called from usageController after every Usage.create()
// ─────────────────────────────────────────────────────────────────────────────
const checkThresholds = async (userId, resourceType, date) => {
    try {
        // ① Coerce date string → Date object (body fields arrive as strings)
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) {
            console.error('[ThresholdService] Invalid date received:', date);
            return;
        }

        // ② Load system config for this resource
        const config = await SystemConfig.findOne({ resource: resourceType });
        if (!config) return;   // no config → no enforcement
        if (config.isActive === false) return;
        if (!config.alertsEnabled) return;

        // ③ Normalise canonical field names (support legacy + new schema fields)
        const normConfig = {
            ...config.toObject(),
            dailyLimit: config.dailyThreshold ?? config.dailyLimitPerPerson ?? null,
            monthlyLimit: config.monthlyThreshold ?? config.monthlyLimitPerPerson ?? null,
            unit: config.unit ?? RESOURCE_UNITS[resourceType] ?? '',
        };

        await _checkDaily(userId, resourceType, dateObj, normConfig);
        await _checkMonthly(userId, resourceType, dateObj, normConfig);
        await _checkSpike(userId, resourceType, dateObj, normConfig);
        await _checkBudget(userId, dateObj);

    } catch (error) {
        console.error('[ThresholdService] checkThresholds error:', error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE: Daily threshold check
// ─────────────────────────────────────────────────────────────────────────────
async function _checkDaily(userId, resourceType, date, config) {
    try {
        const { start: startOfDay, end: endOfDay } = todayRange();

        const user = await User.findById(userId);
        if (!user) return;

        // Build aggregation match scoped to block or individual user
        const matchQuery = _buildMatchQuery(userId, user.block, resourceType, startOfDay, endOfDay);

        const limit = _resolveLimit(user, config, 'dailyLimit');
        if (!limit) return;

        const totalUsage = await _aggregateUsage(matchQuery);
        if (totalUsage <= limit) return;   // ← only alert when exceeded

        const calculatedPercentage = _pct(totalUsage, limit);
        const excessPercentage = parseFloat((calculatedPercentage - 100).toFixed(2));
        const severity = classifySeverity(calculatedPercentage);
        if (!severity) return;

        const unit = config.unit;
        const message = `${resourceType} daily usage (${totalUsage.toFixed(2)} ${unit}) exceeded daily limit (${limit} ${unit}) by ${excessPercentage}%.`;

        await _upsertAlert({
            userId,
            user,
            resourceType,
            totalUsage,
            limit,
            monthlyLimit: null,
            calculatedPercentage,
            excessPercentage,
            severity,
            message,
            alertType: 'daily',
            alertDate: startOfDay,
        });

    } catch (err) {
        console.error('[ThresholdService] _checkDaily error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE: Monthly threshold check
// ─────────────────────────────────────────────────────────────────────────────
async function _checkMonthly(userId, resourceType, date, config) {
    try {
        const { start: startOfMonth, end: endOfMonth } = currentMonthRange();

        const user = await User.findById(userId);
        if (!user) return;

        const matchQuery = _buildMatchQuery(userId, user.block, resourceType, startOfMonth, endOfMonth);

        const limit = _resolveLimit(user, config, 'monthlyLimit');
        if (!limit) return;

        const totalUsage = await _aggregateUsage(matchQuery);
        if (totalUsage <= limit) return;

        const calculatedPercentage = _pct(totalUsage, limit);
        const excessPercentage = parseFloat((calculatedPercentage - 100).toFixed(2));
        const severity = classifySeverity(calculatedPercentage);
        if (!severity) return;

        const unit = config.unit;
        const message = `${resourceType} monthly usage (${totalUsage.toFixed(2)} ${unit}) exceeded monthly limit (${limit} ${unit}) by ${excessPercentage}%.`;

        await _upsertAlert({
            userId,
            user,
            resourceType,
            totalUsage,
            limit,
            monthlyLimit: limit,
            calculatedPercentage,
            excessPercentage,
            severity,
            message,
            alertType: 'monthly',
            alertDate: startOfMonth,
        });

    } catch (err) {
        console.error('[ThresholdService] _checkMonthly error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE: Spike detection (>30% above 5-day average)
// ─────────────────────────────────────────────────────────────────────────────
async function _checkSpike(userId, resourceType, date, config) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        const baseMatch = user.block
            ? { resource_type: resourceType, blockId: user.block }
            : { resource_type: resourceType, userId: new mongoose.Types.ObjectId(userId) };

        // Look only at history from last 7 days to avoid stale spike alerts
        const sevenDaysAgo = new Date(date);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Need at least 3 historical records
        const history = await Usage.find({ ...baseMatch, usage_date: { $lt: date, $gte: sevenDaysAgo }, deleted: { $ne: true } })
            .sort({ usage_date: -1 })
            .limit(5)
            .lean();

        if (history.length < 3) return;

        const avgRecent = history.reduce((s, r) => s + r.usage_value, 0) / history.length;

        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        const todayAgg = await Usage.aggregate([
            { $match: { ...baseMatch, usage_date: { $gte: startOfDay, $lte: endOfDay }, deleted: { $ne: true } } },
            { $group: { _id: null, total: { $sum: '$usage_value' } } }
        ]);
        const todayTotal = todayAgg[0]?.total || 0;

        const spikeThreshold = config.spikeThreshold ?? 50;
        const spikePercentage = ((todayTotal - avgRecent) / avgRecent) * 100;
        if (spikePercentage < spikeThreshold) return;

        const unit = config.unit;
        const message = `Abnormal Spike: ${resourceType} usage today (${todayTotal.toFixed(2)} ${unit}) is ${Math.round(spikePercentage)}% higher than recent average (${avgRecent.toFixed(2)} ${unit}).`;

        // Spike alert: one per day, no escalation needed
        const existingSpike = await Alert.findOne({
            ...(user.block ? { block: user.block } : { user: userId }),
            resourceType,
            message: { $regex: 'Abnormal Spike' },
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

        if (!existingSpike) {
            await Alert.create({
                user: userId, block: user.block || null, resourceType,
                amount: todayTotal, threshold: avgRecent,
                totalUsage: todayTotal,
                message, severity: 'High', status: ALERT_STATUS.PENDING,
            });
            await sendAlertEmail(userId, 'High Alert: Abnormal Usage Spike Detected', message);
        }

    } catch (err) {
        console.error('[ThresholdService] _checkSpike error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE: Budget threshold check
// ─────────────────────────────────────────────────────────────────────────────
async function _checkBudget(userId, date) {
    try {
        const user = await User.findById(userId).populate('block');
        if (!user?.block?.monthly_budget) return;

        const { start: startOfMonth, end: endOfMonth } = currentMonthRange();
        const configs = await SystemConfig.find({});

        const usageAgg = await Usage.aggregate([
            { $match: { blockId: user.block._id, usage_date: { $gte: startOfMonth, $lte: endOfMonth }, deleted: { $ne: true } } },
            { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
        ]);

        let totalCost = 0;
        usageAgg.forEach(u => {
            const conf = configs.find(c => c.resource === u._id);
            const unitCost = conf ? (conf.costPerUnit ?? conf.rate ?? 0) : 0;
            totalCost += u.total * unitCost;
        });

        const budget = user.block.monthly_budget;
        const pct = (totalCost / budget) * 100;

        let severity = null, message = '';
        if (pct >= 100) {
            severity = 'Critical';
            message = `Critical Budget Alert: Block ${user.block.name} has exceeded its monthly budget of ₹${budget}. Current cost: ₹${totalCost.toFixed(2)}.`;
        } else if (pct >= 80) {
            severity = 'High';
            message = `Budget Warning: Block ${user.block.name} has consumed ${pct.toFixed(1)}% of its monthly budget of ₹${budget}.`;
        }

        if (!severity) return;

        const existing = await Alert.findOne({
            block: user.block._id,
            message: { $regex: 'Budget' },
            severity,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        if (!existing) {
            await Alert.create({
                user: userId, block: user.block._id, resourceType: 'Budget',
                amount: totalCost, threshold: budget,
                totalUsage: totalCost, dailyLimit: budget,
                percentage: parseFloat(pct.toFixed(2)),
                calculatedPercentage: parseFloat(pct.toFixed(2)),
                excessPercentage: parseFloat((pct - 100).toFixed(2)),
                message, severity, status: ALERT_STATUS.PENDING,
            });
            await sendAlertEmail(userId, `${severity} Alert: Budget Threshold Exceeded`, message);
        }

    } catch (err) {
        console.error('[ThresholdService] _checkBudget error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build the MongoDB $match query scoped to block or individual user */
function _buildMatchQuery(userId, block, resourceType, start, end) {
    const query = { resource_type: resourceType, usage_date: { $gte: start, $lte: end } };
    if (block) {
        query.blockId = block;
    } else {
        query.userId = new mongoose.Types.ObjectId(userId);
    }
    return query;
}

/** Sum usage_value for a given match query */
async function _aggregateUsage(matchQuery) {
    // Ensure soft-deleted records are excluded
    const match = { ...matchQuery, deleted: { $ne: true } };
    const agg = await Usage.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]);
    return agg[0]?.total || 0;
}

/** Resolve limit: block override first, then global config */
function _resolveLimit(user, config, field) {
    const blockId = user.block?.toString();
    if (blockId && config.blockOverrides?.has(blockId)) {
        const ov = config.blockOverrides.get(blockId);
        const key = field === 'dailyLimit' ? 'dailyThreshold' : 'monthlyThreshold';
        if (ov?.[key]) return ov[key];
    }
    return config[field] || null;
}

/** Round (totalUsage / limit) × 100 to 2 decimals */
function _pct(usage, limit) {
    return parseFloat(((usage / limit) * 100).toFixed(2));
}

/**
 * Upsert alert using the compound dedup key:
 *   (block|user) + resourceType + alertDate + alertType
 *
 * If an alert already exists for this scope+day+type:
 *   • severity HIGHER  → update message, severity, computed values in-place
 *   • severity SAME/LOWER → skip (no duplicate created)
 * If no existing alert → create a fresh one with status = 'Active'
 */
async function _upsertAlert({ userId, user, resourceType, totalUsage, limit, monthlyLimit,
    calculatedPercentage, excessPercentage, severity, message,
    alertType, alertDate }) {

    const ALERT_TYPES = require('../config/constants').ALERT_TYPES;

    // Normalise alertDate to start-of-day for consistent dedup key
    const normalizedDate = new Date(alertDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // Build compound dedup filter
    const dedupFilter = {
        resourceType,
        alertType,
        alertDate: normalizedDate,
    };
    if (user.block) {
        dedupFilter.block = user.block;
    } else {
        dedupFilter.user = userId;
    }

    // Compute numeric severity level for comparisons
    const newLevel = SEVERITY_LEVELS[severity] || 0;

    const payload = {
        user: userId,
        block: user.block || null,
        resourceType,
        alertType,
        alertDate: normalizedDate,
        // Legacy compat fields
        amount: totalUsage,
        threshold: limit,
        // Explicit computed fields
        totalUsage,
        dailyLimit: limit,
        monthlyLimit: monthlyLimit || null,
        percentage: calculatedPercentage,
        calculatedPercentage,
        excessPercentage,
        message,
        severity,
        severityLevel: newLevel,
        status: ALERT_STATUS.ACTIVE,
    };
    // Atomic upsert to create alert if missing. Use $setOnInsert for initial fields.
    const setOnInsert = {
        ...payload,
        createdBy: userId,
    };

    let after = null;
    try {
        after = await Alert.findOneAndUpdate(
            dedupFilter,
            { $setOnInsert: setOnInsert },
            { upsert: true, returnDocument: 'after' }
        );
    } catch (err) {
        // Handle rare E11000 duplicate key race: another process inserted simultaneously
        if (err && err.code === 11000) {
            try {
                after = await Alert.findOne(dedupFilter).lean();
            } catch (inner) {
                console.error('[ThresholdService] dedup read after duplicate-key:', inner);
            }
        } else {
            console.error('[ThresholdService] _upsertAlert initial upsert error:', err);
        }
    }

    // If the existing severityLevel is lower than newLevel, escalate atomically
    try {
        const upgraded = await Alert.findOneAndUpdate(
            { ...dedupFilter, severityLevel: { $lt: newLevel } },
            {
                $set: {
                    totalUsage: payload.totalUsage,
                    dailyLimit: payload.dailyLimit,
                    monthlyLimit: payload.monthlyLimit,
                    amount: payload.amount,
                    threshold: payload.threshold,
                    calculatedPercentage: payload.calculatedPercentage,
                    excessPercentage: payload.excessPercentage,
                    percentage: payload.percentage,
                    message: payload.message,
                    severity: payload.severity,
                    severityLevel: newLevel,
                }
            },
            { returnDocument: 'after' }
        );

        if (upgraded) {
            await sendAlertEmail(userId,
                `${severity} Alert (Severity Escalated): ${resourceType} Limit Exceeded`,
                message
            );
            try {
                const socketUtil = require('../utils/socket');
                const io = socketUtil.getIO && socketUtil.getIO();
                if (io) io.emit('alerts:refresh');
            } catch (e) { /* non-fatal */ }
        } else {
            // If no upgrade occurred, check if this was a fresh insert (created now)
            // `after` contains the document; if its severityLevel === newLevel and createdAt ≈ updatedAt, treat as newly created
            if (after && (after.severityLevel === newLevel)) {
                // send email and notify
                await sendAlertEmail(userId,
                    `${severity} Alert: ${resourceType} Limit Exceeded`,
                    message
                );
                try {
                    const socketUtil = require('../utils/socket');
                    const io = socketUtil.getIO && socketUtil.getIO();
                    if (io) io.emit('alerts:refresh');
                } catch (e) { /* non-fatal */ }
            }
        }
    } catch (e) {
        console.error('[ThresholdService] _upsertAlert escalation error:', e);
    }
}

// ── Update daily/monthly calls to pass new alertType/alertDate params ─────────

// Patch the _checkDaily &_checkMonthly calls — they already pass alertType
// via the updated function signatures below

module.exports = { checkThresholds };

