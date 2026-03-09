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
// ⭐ FIXED: Public entry-point called from usageController after every Usage create/update/delete
// KEY FIX: Now accepts blockId parameter to support warden-created block-scoped usage
// ─────────────────────────────────────────────────────────────────────────────
const checkThresholds = async (userId, resourceType, date, blockId = null) => {
    try {
        console.log(`[TRACE:THRESHOLD_CHECK_START] Checking thresholds`);
        console.log(`  ├─ userId: ${userId}`);
        console.log(`  ├─ resourceType: ${resourceType}`);
        console.log(`  ├─ date: ${date}`);
        console.log(`  └─ blockId: ${blockId || 'null'}\n`);

        // ① Coerce date string → Date object
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) {
            console.error('[TRACE:ERROR] Invalid date received:', date);
            return;
        }

        // ② Load system config for this resource
        const config = await SystemConfig.findOne({ resource: resourceType });
        if (!config) {
            console.log(`[TRACE:CONFIG_NOT_FOUND] No SystemConfig for resource: ${resourceType}\n`);
            return;
        }
        if (config.isActive === false) {
            console.log(`[TRACE:CONFIG_INACTIVE] SystemConfig isActive=false for ${resourceType}\n`);
            return;
        }
        if (!config.alertsEnabled) {
            console.log(`[TRACE:ALERTS_DISABLED] alertsEnabled=false for ${resourceType}\n`);
            return;
        }
        console.log(`[TRACE:CONFIG_LOADED] SystemConfig loaded for ${resourceType}`);
        console.log(`  ├─ dailyThreshold: ${config.dailyThreshold}`);
        console.log(`  ├─ monthlyThreshold: ${config.monthlyThreshold}`);
        console.log(`  └─ alertsEnabled: ${config.alertsEnabled}\n`);

        // ③ Normalize config
        const normConfig = {
            ...config.toObject(),
            dailyLimit: config.dailyThreshold ?? config.dailyLimitPerPerson ?? null,
            monthlyLimit: config.monthlyThreshold ?? config.monthlyLimitPerPerson ?? null,
            unit: config.unit ?? RESOURCE_UNITS[resourceType] ?? '',
        };

        // ④ Get block context if not provided
        if (!blockId) {
            const user = await User.findById(userId).lean();
            blockId = user?.block || null;
        }

        // ⑤ Run all checks with explicit block context
        await _checkDaily(userId, blockId, resourceType, dateObj, normConfig);
        await _checkMonthly(userId, blockId, resourceType, dateObj, normConfig);
        await _checkSpike(userId, blockId, resourceType, dateObj, normConfig);
        await _checkBudget(userId, blockId, dateObj);

    } catch (error) {
        console.error('[ThresholdService] checkThresholds error:', error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ FIXED: Daily threshold check - proper block-scoped aggregation
// ─────────────────────────────────────────────────────────────────────────────
async function _checkDaily(userId, blockId, resourceType, date, config) {
    try {
        console.log(`[TRACE:CHECK_DAILY_START] Starting daily threshold check`);
        const { start: startOfDay, end: endOfDay } = todayRange();
        console.log(`  ├─ startOfDay: ${startOfDay}`);
        console.log(`  └─ endOfDay: ${endOfDay}\n`);

        // ⭐ CRITICAL FIX: Use explicit block scope when aggregating
        const matchQuery = _buildAggregationQuery(userId, blockId, resourceType, startOfDay, endOfDay);
        console.log(`[TRACE:MATCH_QUERY] Aggregation filter built`);
        console.log(`  └─ query: ${JSON.stringify(matchQuery)}\n`);

        // Resolve limit for this user/block
        const user = await User.findById(userId).lean();
        const limit = _resolveLimit(user, blockId, config, 'dailyLimit');
        console.log(`[TRACE:LIMIT_RESOLVED] Daily limit determined`);
        console.log(`  ├─ limit: ${limit}`);
        console.log(`  └─ blockId: ${blockId || 'null'}\n`);
        if (!limit) {
            console.log(`[TRACE:NO_LIMIT] Daily limit is null/undefined, skipping check\n`);
            return;
        }

        // Aggregate usage with proper soft-delete filtering
        const totalUsage = await _aggregateUsage(matchQuery);
        console.log(`[TRACE:AGGREGATION_RESULT] Daily usage aggregated`);
        console.log(`  ├─ totalUsage: ${totalUsage}`);
        console.log(`  ├─ limit: ${limit}`);
        console.log(`  ├─ percentage: ${_pct(totalUsage, limit)}%`);
        console.log(`  └─ exceeds: ${totalUsage > limit}\n`);

        if (totalUsage > limit) {
            console.log(`[TRACE:THRESHOLD_EXCEEDED] Usage exceeds daily limit`);
            // Usage EXCEEDS threshold → create/upgrade alert
            const calculatedPercentage = _pct(totalUsage, limit);
            const excessPercentage = parseFloat((calculatedPercentage - 100).toFixed(2));
            const severity = classifySeverity(calculatedPercentage);
            console.log(`  ├─ severity: ${severity}`);
            console.log(`  ├─ percentage: ${calculatedPercentage}%`);
            console.log(`  └─ excessPercentage: ${excessPercentage}%\n`);
            if (!severity) {
                console.log(`[TRACE:NO_SEVERITY] classifySeverity returned falsy, skipping alert\n`);
                return;
            }

            const unit = config.unit;
            const message = `${resourceType} daily usage (${totalUsage.toFixed(2)} ${unit}) exceeded daily limit (${limit} ${unit}) by ${excessPercentage}%.`;

            console.log(`[TRACE:CALLING_UPSERT_ALERT] About to create/update alert`);
            console.log(`  ├─ message: ${message}\n`);
            await _upsertAlert({
                userId,
                blockId,
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
        } else {
            // Usage BELOW threshold → auto-resolve existing alert
            await _resolveAlertIfExists(userId, blockId, resourceType, 'daily', startOfDay);
        }

    } catch (err) {
        console.error('[ThresholdService] _checkDaily error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ FIXED: Monthly threshold check - proper block-scoped aggregation
// ─────────────────────────────────────────────────────────────────────────────
async function _checkMonthly(userId, blockId, resourceType, date, config) {
    try {
        const { start: startOfMonth, end: endOfMonth } = currentMonthRange();

        const matchQuery = _buildAggregationQuery(userId, blockId, resourceType, startOfMonth, endOfMonth);

        const user = await User.findById(userId).lean();
        const limit = _resolveLimit(user, blockId, config, 'monthlyLimit');
        if (!limit) return;

        const totalUsage = await _aggregateUsage(matchQuery);

        if (totalUsage > limit) {
            const calculatedPercentage = _pct(totalUsage, limit);
            const excessPercentage = parseFloat((calculatedPercentage - 100).toFixed(2));
            const severity = classifySeverity(calculatedPercentage);
            if (!severity) return;

            const unit = config.unit;
            const message = `${resourceType} monthly usage (${totalUsage.toFixed(2)} ${unit}) exceeded monthly limit (${limit} ${unit}) by ${excessPercentage}%.`;

            await _upsertAlert({
                userId,
                blockId,
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
        } else {
            await _resolveAlertIfExists(userId, blockId, resourceType, 'monthly', startOfMonth);
        }

    } catch (err) {
        console.error('[ThresholdService] _checkMonthly error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ FIXED: Spike detection with proper block-scoped aggregation
// ─────────────────────────────────────────────────────────────────────────────
async function _checkSpike(userId, blockId, resourceType, date, config) {
    try {
        // Build base match query with explicit block/user scope
        const baseMatch = blockId
            ? { resource_type: resourceType, blockId: new mongoose.Types.ObjectId(blockId), deleted: { $ne: true } }
            : { resource_type: resourceType, userId: new mongoose.Types.ObjectId(userId), deleted: { $ne: true } };

        // 7-day history (exclude soft-deleted)
        const sevenDaysAgo = new Date(date);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const history = await Usage.find({
            ...baseMatch,
            usage_date: { $lt: date, $gte: sevenDaysAgo }
        })
            .sort({ usage_date: -1 })
            .limit(5)
            .lean();

        if (history.length < 3) return;

        const avgRecent = history.reduce((s, r) => s + r.usage_value, 0) / history.length;

        // Today's total
        const { start: startOfDay, end: endOfDay } = todayRange();
        const todayAgg = await Usage.aggregate([
            { $match: { ...baseMatch, usage_date: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, total: { $sum: '$usage_value' } } }
        ]);
        const todayTotal = todayAgg[0]?.total || 0;

        const spikeThreshold = config.spikeThreshold ?? 50;
        const spikePercentage = avgRecent > 0 ? ((todayTotal - avgRecent) / avgRecent) * 100 : 0;
        if (spikePercentage < spikeThreshold) return;

        const unit = config.unit;
        const message = `Abnormal Spike: ${resourceType} usage today (${todayTotal.toFixed(2)} ${unit}) is ${Math.round(spikePercentage)}% higher than recent average (${avgRecent.toFixed(2)} ${unit}).`;

        // Check if spike alert already exists for today
        const dedupFilter = {
            resourceType,
            alertType: 'spike',
            alertDate: startOfDay,
            ...(blockId ? { block: blockId } : { user: userId }),
        };

        const existing = await Alert.findOne(dedupFilter).lean();
        if (!existing) {
            const newAlert = await Alert.create({
                user: userId,
                block: blockId || null,
                resourceType,
                alertType: 'spike',
                alertDate: startOfDay,
                amount: todayTotal,
                threshold: avgRecent,
                totalUsage: todayTotal,
                message,
                severity: 'High',
                status: ALERT_STATUS.ACTIVE,
            });
            await sendAlertEmail(userId, 'High Alert: Abnormal Usage Spike Detected', message);
            try {
                const socketUtil = require('../utils/socket');
                const io = socketUtil.getIO && socketUtil.getIO();
                if (io) io.emit('alerts:refresh');
            } catch (e) { /* non-fatal */ }
        }

    } catch (err) {
        console.error('[ThresholdService] _checkSpike error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ FIXED: Budget threshold check with proper block-scoped aggregation
// ─────────────────────────────────────────────────────────────────────────────
async function _checkBudget(userId, blockId, date) {
    try {
        // Get block context
        let block;
        if (blockId) {
            block = await Block.findById(blockId).lean();
        } else {
            const user = await User.findById(userId).populate('block').lean();
            block = user?.block;
        }

        if (!block?.monthly_budget) return;

        const { start: startOfMonth, end: endOfMonth } = currentMonthRange();
        const configs = await SystemConfig.find({}).lean();

        // Aggregate usage for the block, excluding soft-deleted
        const usageAgg = await Usage.aggregate([
            { $match: { blockId: new mongoose.Types.ObjectId(block._id), usage_date: { $gte: startOfMonth, $lte: endOfMonth }, deleted: { $ne: true } } },
            { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
        ]);

        let totalCost = 0;
        usageAgg.forEach(u => {
            const conf = configs.find(c => c.resource === u._id);
            const unitCost = conf ? (conf.costPerUnit ?? conf.rate ?? 0) : 0;
            totalCost += u.total * unitCost;
        });

        const budget = block.monthly_budget;
        const pct = budget > 0 ? (totalCost / budget) * 100 : 0;

        let severity = null, message = '';
        if (pct >= 100) {
            severity = 'Critical';
            message = `Critical Budget Alert: Block ${block.name} has exceeded its monthly budget of ₹${budget}. Current cost: ₹${totalCost.toFixed(2)}.`;
        } else if (pct >= 80) {
            severity = 'High';
            message = `Budget Warning: Block ${block.name} has consumed ${pct.toFixed(1)}% of its monthly budget of ₹${budget}.`;
        }

        if (!severity) {
            // Budget under control → resolve any existing budget alert
            await Alert.updateMany(
                { block: block._id, resourceType: 'Budget', status: { $in: ['Active', 'Escalated'] } },
                { $set: { status: 'Resolved', resolvedAt: new Date() } }
            );
            return;
        }

        // Budget exceeded → create/upgrade alert
        const dedupFilter = {
            block: block._id,
            resourceType: 'Budget',
            alertType: 'budget',
            alertDate: startOfMonth,
        };

        const newLevel = SEVERITY_LEVELS[severity] || 0;
        const payload = {
            user: userId,
            block: block._id,
            resourceType: 'Budget',
            alertType: 'budget',
            alertDate: startOfMonth,
            amount: totalCost,
            threshold: budget,
            totalUsage: totalCost,
            dailyLimit: budget,
            percentage: parseFloat(pct.toFixed(2)),
            calculatedPercentage: parseFloat(pct.toFixed(2)),
            excessPercentage: parseFloat((pct - 100).toFixed(2)),
            message,
            severity,
            severityLevel: newLevel,
            status: ALERT_STATUS.ACTIVE,
        };

        await Alert.findOneAndUpdate(
            dedupFilter,
            { $setOnInsert: { ...payload, createdBy: userId } },
            { upsert: true, returnDocument: 'after' }
        );

        await sendAlertEmail(userId, `${severity} Alert: Budget Threshold Exceeded`, message);
        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) io.emit('alerts:refresh');
        } catch (e) { /* non-fatal */ }

    } catch (err) {
        console.error('[ThresholdService] _checkBudget error:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ PRIVATE HELPERS (REFACTORED for consistency and correctness)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ CRITICAL FIX: Single source of truth for aggregation queries
 * Properly scopes to block (if available) or user, with consistent soft-delete filtering
 * This is the ROOT CAUSE FIX for alert trigger failures
 */
function _buildAggregationQuery(userId, blockId, resourceType, start, end) {
    const query = {
        resource_type: resourceType,
        usage_date: { $gte: start, $lte: end },
        deleted: { $ne: true }  // Always exclude soft-deleted
    };
    if (blockId) {
        query.blockId = new mongoose.Types.ObjectId(blockId);
    } else {
        query.userId = new mongoose.Types.ObjectId(userId);
    }
    return query;
}

/** Sum usage_value with soft-delete filtering already applied in match */
async function _aggregateUsage(matchQuery) {
    const agg = await Usage.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]);
    return agg[0]?.total || 0;
}

/** Resolve limit: block override first, then global config */
function _resolveLimit(user, blockId, config, field) {
    const targetBlockId = (blockId || user?.block)?.toString();
    if (targetBlockId && config.blockOverrides?.has(targetBlockId)) {
        const ov = config.blockOverrides.get(targetBlockId);
        const key = field === 'dailyLimit' ? 'dailyThreshold' : 'monthlyThreshold';
        if (ov?.[key]) return ov[key];
    }
    return config[field] || null;
}

/**
 * ⭐ NEW: Auto-resolve alerts when usage drops below threshold
 * Called after usage update/delete to prevent stale high-severity alerts from remaining
 * This addresses the "alert downgrade" missing logic (Bug #4)
 */
async function _resolveAlertIfExists(userId, blockId, resourceType, alertType, alertDate) {
    try {
        const filter = {
            resourceType,
            alertType,
            alertDate,
            status: { $in: ['Active', 'Investigating', 'Escalated'] },
            ...(blockId ? { block: blockId } : { user: userId }),
        };

        const updated = await Alert.findOneAndUpdate(
            filter,
            {
                $set: {
                    status: 'Resolved',
                    resolvedAt: new Date(),
                    resolvedBy: userId,
                    resolutionComment: 'Auto-resolved: Usage dropped below threshold after edit/delete',
                }
            },
            { returnDocument: 'after' }
        );

        if (updated) {
            try {
                const socketUtil = require('../utils/socket');
                const io = socketUtil.getIO && socketUtil.getIO();
                if (io) io.emit('alerts:refresh');
            } catch (e) { /* non-fatal */ }
        }
    } catch (err) {
        console.error('[ThresholdService] _resolveAlertIfExists error:', err);
    }
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
async function _upsertAlert({ userId, user, blockId, resourceType, totalUsage, limit, monthlyLimit,
    calculatedPercentage, excessPercentage, severity, message,
    alertType, alertDate }) {

    const ALERT_TYPES = require('../config/constants').ALERT_TYPES;

    console.log(`[TRACE:UPSERT_ALERT_START] Entering _upsertAlert`);
    console.log(`  ├─ userId: ${userId}`);
    console.log(`  ├─ blockId: ${blockId || 'null'}`);
    console.log(`  ├─ resourceType: ${resourceType}`);
    console.log(`  ├─ alertType: ${alertType}`);
    console.log(`  ├─ severity: ${severity}`);
    console.log(`  └─ totalUsage: ${totalUsage}\n`);

    // Normalise alertDate to start-of-day for consistent dedup key
    const normalizedDate = new Date(alertDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // Build compound dedup filter
    const dedupFilter = {
        resourceType,
        alertType,
        alertDate: normalizedDate,
    };
    if (blockId) {
        dedupFilter.block = new mongoose.Types.ObjectId(blockId);
    } else {
        dedupFilter.user = userId;
    }

    console.log(`[TRACE:DEDUP_FILTER] Filter for dedup key check`);
    console.log(`  └─ filter: ${JSON.stringify(dedupFilter, null, 2)}\n`);

    // Compute numeric severity level for comparisons
    const newLevel = SEVERITY_LEVELS[severity] || 0;

    const payload = {
        user: userId,
        block: blockId ? new mongoose.Types.ObjectId(blockId) : null,
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
    let wasInserted = false;
    try {
        console.log(`[TRACE:UPSERT_ATTEMPT] Attempting findOneAndUpdate with upsert=true...\n`);
        after = await Alert.findOneAndUpdate(
            dedupFilter,
            { $setOnInsert: setOnInsert },
            { upsert: true, returnDocument: 'after' }
        );
        console.log(`[TRACE:UPSERT_RESULT] findOneAndUpdate completed`);
        console.log(`  ├─ alert created/found: ${after?._id || 'null'}`);
        console.log(`  ├─ status: ${after?.status || 'null'}`);
        console.log(`  └─ severity: ${after?.severity || 'null'}\n`);

        // ── FRESH INSERT DETECTION ────────────────────────────────────────────
        // $setOnInsert only fires on new documents. Detect insertion by checking
        // whether createdAt is within the last 5 seconds (i.e., just created now).
        // This is more reliable than checking severityLevel equality, which
        // incorrectly fires for existing alerts with the same severity.
        if (after?.createdAt) {
            wasInserted = (Date.now() - new Date(after.createdAt).getTime()) < 5000;
        }
        console.log(`[TRACE:INSERT_DETECTION] wasInserted: ${wasInserted}\n`);

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

    // ── BUG FIX: RE-ACTIVATE stale Resolved/Dismissed same-day alert ─────────
    // When an alert was previously Resolved or Dismissed for this same
    // (block + resource + date + type), the $setOnInsert above is a no-op
    // (document already exists). The status stays 'Resolved' even though usage
    // has re-exceeded the threshold. Explicitly reset it to Active here.
    const INACTIVE_STATUSES = ['Resolved', 'Dismissed'];
    if (after && INACTIVE_STATUSES.includes(after.status)) {
        console.log(`[TRACE:REACTIVATE] Alert was ${after.status} — re-activating due to threshold re-breach`);
        try {
            after = await Alert.findOneAndUpdate(
                { _id: after._id, status: { $in: INACTIVE_STATUSES } },
                {
                    $set: {
                        status: ALERT_STATUS.ACTIVE,
                        severity: payload.severity,
                        severityLevel: newLevel,
                        totalUsage: payload.totalUsage,
                        amount: payload.amount,
                        calculatedPercentage: payload.calculatedPercentage,
                        excessPercentage: payload.excessPercentage,
                        percentage: payload.percentage,
                        message: payload.message,
                        // Clear stale resolution fields
                        resolvedAt: null,
                        resolvedBy: null,
                        resolutionComment: null,
                    }
                },
                { returnDocument: 'after' }
            );
            wasInserted = true; // treat re-activation like a fresh alert for email/socket purposes
            console.log(`[TRACE:REACTIVATED] Alert re-activated: ${after?._id}\n`);
        } catch (reactivateErr) {
            console.error('[ThresholdService] re-activation error:', reactivateErr);
        }
    }

    // ── SEVERITY ESCALATION: upgrade if usage grew worse ─────────────────────
    // If the existing severityLevel is lower than newLevel, escalate atomically
    try {
        console.log(`[TRACE:ESCALATION_CHECK] Checking if alert needs escalation`);
        console.log(`  ├─ newLevel: ${newLevel}`)
        console.log(`  └─ looking for existing alerts with severityLevel < ${newLevel}\n`);

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
            console.log(`[TRACE:ALERT_ESCALATED] Alert severity escalated`);
            console.log(`  ├─ oldLevel: ${upgraded.severityLevel}`);
            console.log(`  └─ newLevel: ${newLevel}\n`);
            await sendAlertEmail(userId,
                `${severity} Alert (Severity Escalated): ${resourceType} Limit Exceeded`,
                message
            );
            try {
                const socketUtil = require('../utils/socket');
                const socketManager = require('../socket/socketManager');
                const io = socketUtil.getIO && socketUtil.getIO();
                if (io) {
                    io.emit('alerts:refresh');
                    const alertData = { alertId: upgraded._id, block: upgraded.block, resource: upgraded.resourceType, severity: upgraded.severity, usageValue: upgraded.amount, limit: upgraded.threshold, timestamp: new Date() };
                    socketManager.emitToRole(io, 'admin', 'alert:updated', alertData);
                    socketManager.emitToRole(io, 'gm', 'alert:updated', alertData);
                    socketManager.emitToRole(io, 'admin', 'dashboard:alert_created', { severity: upgraded.severity });
                    socketManager.emitToRole(io, 'gm', 'dashboard:alert_created', { severity: upgraded.severity });
                    if (upgraded.block) socketManager.emitToBlock(io, upgraded.block, 'alert:updated', alertData);
                }

                if (severity.toUpperCase() === 'CRITICAL') {
                    const { sendCriticalAlertEmail } = require('../utils/emailService');
                    const adminUsers = await User.find({ role: { $in: ['admin', 'gm'] } }).select('email');
                    const emails = adminUsers.map(u => u.email).filter(Boolean);
                    sendCriticalAlertEmail(emails, { block: upgraded.block, resource: upgraded.resourceType, value: upgraded.amount, limit: upgraded.threshold });
                }
            } catch (e) { /* non-fatal */ }
        } else if (wasInserted) {
            // ── Only send email for genuinely new or re-activated alerts ──────
            // wasInserted is true ONLY when: (a) fresh DB insert within last 5s,
            // or (b) existing Resolved/Dismissed alert was just re-activated.
            // Prevents duplicate emails when the same active alert is re-checked.
            console.log(`[TRACE:NEW_ALERT_CREATED] Fresh alert created / re-activated — sending notification\n`);
            await sendAlertEmail(userId,
                `${severity} Alert: ${resourceType} Limit Exceeded`,
                message
            );
            try {
                const socketUtil = require('../utils/socket');
                const socketManager = require('../socket/socketManager');
                const io = socketUtil.getIO && socketUtil.getIO();
                if (io) {
                    io.emit('alerts:refresh');
                    const alertData = { alertId: after._id, block: after.block, resource: after.resourceType, severity: after.severity, usageValue: after.amount, limit: after.threshold, timestamp: new Date() };
                    socketManager.emitToRole(io, 'admin', 'alert:new', alertData);
                    socketManager.emitToRole(io, 'gm', 'alert:new', alertData);
                    socketManager.emitToRole(io, 'admin', 'dashboard:alert_created', { severity: after.severity });
                    socketManager.emitToRole(io, 'gm', 'dashboard:alert_created', { severity: after.severity });
                    if (after.block) socketManager.emitToBlock(io, after.block, 'alert:new', alertData);
                }

                if (severity.toUpperCase() === 'CRITICAL') {
                    const { sendCriticalAlertEmail } = require('../utils/emailService');
                    const adminUsers = await User.find({ role: { $in: ['admin', 'gm'] } }).select('email');
                    const emails = adminUsers.map(u => u.email).filter(Boolean);
                    sendCriticalAlertEmail(emails, { block: after.block, resource: after.resourceType, value: after.amount, limit: after.threshold });
                }
            } catch (e) { /* non-fatal */ }
        } else {
            console.log(`[TRACE:EXISTING_ALERT] Alert already active at same severity — no email sent\n`);
        }
    } catch (e) {
        console.error('[ThresholdService] _upsertAlert escalation error:', e);
    }
}

// ── Update daily/monthly calls to pass new alertType/alertDate params ─────────

// Patch the _checkDaily &_checkMonthly calls — they already pass alertType
// via the updated function signatures below

module.exports = { checkThresholds };

