/**
 * cron/escalation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Escalation Engine — runs every 30 minutes
 *
 * Auto-escalation rules (Area 2 enhancement):
 *   • OPEN/Active alerts with no action for > 24 hours → Escalated
 *   • Investigating alerts with no resolution for > 48 hours → Escalated
 *   • escalationReason field set explaining auto-escalation
 *   • Every auto-escalation logged to AuditLog with userId = "SYSTEM"
 *
 * Original manual escalation by GM is UNCHANGED.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const CronLog = require('../models/CronLog');
const { ROLES } = require('../config/roles');
const { ALERT_STATUS, ESCALATION_WINDOWS, ESCALATION_ROLES } = require('../config/constants');
const { sendAlertEmail } = require('../utils/emailService');

const JOB_NAME = 'escalation';

// System-level ObjectId placeholder for audit logs (non-user actor)
// We use a fixed known ObjectId to avoid FK errors while flagging system actions
const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000000');

// Helper: send escalation email to all users of a given role
async function notifyRole(roleName, subject, message) {
    try {
        const recipients = await User.find({ role: roleName, status: 'active' })
            .select('_id email name')
            .lean();

        for (const recipient of recipients) {
            await sendAlertEmail(recipient._id.toString(), subject, message);
        }
    } catch (err) {
        console.error(`[Escalation] Failed to notify ${roleName}:`, err.message);
    }
}

// Core escalation logic
async function runEscalation() {
    const runAt = new Date();
    const startTime = Date.now();
    let escalated = 0;

    try {
        const now = new Date();
        const OPEN_THRESHOLD_HOURS = 24;    // Active alerts → 24h with no action
        const INVEST_THRESHOLD_HOURS = 48;  // Investigating alerts → 48h with no resolution

        // ── 1. Auto-escalate OPEN (Active) alerts inactive for > 24h ──────────
        const openCutoff = new Date(now.getTime() - OPEN_THRESHOLD_HOURS * 60 * 60 * 1000);
        const activeAlerts = await Alert.find({
            status: ALERT_STATUS.ACTIVE,
            lastActionAt: { $lt: openCutoff },
        }).lean();

        // Also handle alerts where lastActionAt is not set yet — fall back to createdAt
        const activeAlertsNoField = await Alert.find({
            status: ALERT_STATUS.ACTIVE,
            lastActionAt: { $exists: false },
            createdAt: { $lt: openCutoff },
        }).lean();

        const allActiveToEscalate = [...activeAlerts, ...activeAlertsNoField];

        for (const alert of allActiveToEscalate) {
            const ageHours = Math.round((now - new Date(alert.createdAt)) / (1000 * 60 * 60));
            const reason = `Auto-escalated: Alert was OPEN for ${ageHours} hours with no action taken.`;

            await Alert.findByIdAndUpdate(alert._id, {
                $set: {
                    status: ALERT_STATUS.ESCALATED,
                    escalatedAt: now,
                    escalationReason: reason,
                    lastActionAt: now,
                    escalationLevel: Math.max((alert.escalationLevel || 0), 1),
                },
                $push: {
                    comments: {
                        comment: reason,
                        role: 'system',
                        timestamp: now,
                    }
                }
            });

            // Audit log with SYSTEM actor
            try {
                await AuditLog.create({
                    action: 'ESCALATE_ALERT',
                    resourceType: 'Alert',
                    resourceId: alert._id,
                    userId: SYSTEM_USER_ID,
                    description: reason,
                    changes: { before: { status: 'Active' }, after: { status: 'Escalated', escalationReason: reason } },
                });
            } catch (auditErr) {
                console.error('[Escalation] AuditLog write failed (non-fatal):', auditErr.message);
            }

            escalated++;
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Escalation] Alert ${alert._id} auto-escalated (Active → Escalated, age: ${ageHours}h)`);
            }
        }

        // ── 2. Auto-escalate INVESTIGATING alerts inactive for > 48h ──────────
        const investCutoff = new Date(now.getTime() - INVEST_THRESHOLD_HOURS * 60 * 60 * 1000);
        const investigatingAlerts = await Alert.find({
            status: ALERT_STATUS.INVESTIGATING,
            lastActionAt: { $lt: investCutoff },
        }).lean();

        const investigatingAlertsNoField = await Alert.find({
            status: ALERT_STATUS.INVESTIGATING,
            lastActionAt: { $exists: false },
            createdAt: { $lt: investCutoff },
        }).lean();

        const allInvestToEscalate = [...investigatingAlerts, ...investigatingAlertsNoField];

        for (const alert of allInvestToEscalate) {
            const ageHours = Math.round((now - new Date(alert.createdAt)) / (1000 * 60 * 60));
            const reason = `Auto-escalated: Alert was INVESTIGATING for ${ageHours} hours without resolution.`;

            await Alert.findByIdAndUpdate(alert._id, {
                $set: {
                    status: ALERT_STATUS.ESCALATED,
                    escalatedAt: now,
                    escalationReason: reason,
                    lastActionAt: now,
                    escalationLevel: Math.max((alert.escalationLevel || 0), 2),
                },
                $push: {
                    comments: {
                        comment: reason,
                        role: 'system',
                        timestamp: now,
                    }
                }
            });

            try {
                await AuditLog.create({
                    action: 'ESCALATE_ALERT',
                    resourceType: 'Alert',
                    resourceId: alert._id,
                    userId: SYSTEM_USER_ID,
                    description: reason,
                    changes: { before: { status: 'Investigating' }, after: { status: 'Escalated', escalationReason: reason } },
                });
            } catch (auditErr) {
                console.error('[Escalation] AuditLog write failed (non-fatal):', auditErr.message);
            }

            escalated++;
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Escalation] Alert ${alert._id} auto-escalated (Investigating → Escalated, age: ${ageHours}h)`);
            }

            // Notify Principal/Dean of long-overdue cases
            const subject = `[Escalated] ${alert.severity} Alert Unresolved: ${alert.resourceType} — ${ageHours}h`;
            const body =
                `An alert under investigation has been auto-escalated after ${ageHours} hours with no resolution.\n\n` +
                `Alert: ${alert.message}\nSeverity: ${alert.severity}\nAge: ${ageHours} hours\n\n` +
                `Please review and take action immediately.`;
            await notifyRole(ROLES.DEAN, subject, body);
        }

        if (escalated > 0 && process.env.NODE_ENV !== 'production') {
            console.log(`[Escalation] Run complete — ${escalated} alert(s) auto-escalated.`);
        }

        // Log success
        await CronLog.create({
            jobName: JOB_NAME,
            status: 'success',
            runAt,
            duration: Date.now() - startTime,
        });

    } catch (err) {
        console.error('[Escalation] Cron error:', err.message);
        // Log failure — do NOT crash the server
        try {
            await CronLog.create({
                jobName: JOB_NAME,
                status: 'failed',
                runAt,
                duration: Date.now() - startTime,
                error: err.message,
            });
        } catch (logErr) {
            console.error('[Escalation] Failed to write CronLog:', logErr.message);
        }
    }
}

// Schedule: every 30 minutes
const startEscalationJob = () => {
    // Run immediately on startup to catch any missed windows after restart
    runEscalation();

    cron.schedule('*/30 * * * *', () => {
        if (process.env.NODE_ENV !== 'production') console.log('[Escalation] Running escalation check...');
        runEscalation();
    });

    if (process.env.NODE_ENV !== 'production') console.log('Escalation Cron Job scheduled — runs every 30 minutes.');
};

module.exports = startEscalationJob;
