/**
 * cron/escalation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Escalation Engine — runs every 30 minutes
 *
 * Rules (configured in constants.js ESCALATION_WINDOWS):
 *   Alert age ≥ 2h  AND still Active   → Level 1  (notify Warden)
 *   Alert age ≥ 6h  AND still Active   → Level 2  (notify Dean)
 *   Alert age ≥ 24h AND still Active   → Level 3  (notify Principal)
 *
 * Escalation marks alert.status = 'Escalated',
 * increments alert.escalationLevel, and sets alert.escalatedAt.
 * A comment is appended to the alert timeline for auditability.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const cron = require('node-cron');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { ROLES } = require('../config/roles');
const { ALERT_STATUS, ESCALATION_WINDOWS, ESCALATION_ROLES } = require('../config/constants');
const { sendAlertEmail } = require('../utils/emailService');

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
    try {
        const now = new Date();

        // Find all non-terminal, non-dismissed Active alerts
        const activeAlerts = await Alert.find({
            status: ALERT_STATUS.ACTIVE,
        }).lean();

        let escalated = 0;

        for (const alert of activeAlerts) {
            const ageHours = (now - new Date(alert.createdAt)) / (1000 * 60 * 60);
            const currentLevel = alert.escalationLevel || 0;

            let targetLevel = currentLevel;
            let targetRole = null;

            // Determine which escalation level should apply
            if (ageHours >= ESCALATION_WINDOWS.TO_PRINCIPAL && currentLevel < 3) {
                targetLevel = 3;
                targetRole = ROLES.PRINCIPAL;
            } else if (ageHours >= ESCALATION_WINDOWS.TO_DEAN && currentLevel < 2) {
                targetLevel = 2;
                targetRole = ROLES.DEAN;
            } else if (ageHours >= ESCALATION_WINDOWS.TO_WARDEN && currentLevel < 1) {
                targetLevel = 1;
                targetRole = ROLES.WARDEN;
            }

            if (targetLevel > currentLevel) {
                // Update alert in DB
                const escalationComment = `Auto-escalated to ${ESCALATION_ROLES[targetLevel]} after ${Math.round(ageHours)}h with no action.`;

                await Alert.findByIdAndUpdate(alert._id, {
                    $set: {
                        status: ALERT_STATUS.ESCALATED,
                        escalationLevel: targetLevel,
                        escalatedAt: now,
                    },
                    $push: {
                        comments: {
                            comment: escalationComment,
                            role: 'system',
                            timestamp: now,
                            // addedBy intentionally omitted — system action
                        }
                    }
                });

                // Notify the target role
                const subject = `[Escalated] ${alert.severity} Alert: ${alert.resourceType} — Level ${targetLevel}`;
                const body = `An alert has been auto-escalated to your role (${targetRole}) because it remained unresolved for ${Math.round(ageHours)} hours.\n\n` +
                    `Alert: ${alert.message}\n` +
                    `Severity: ${alert.severity}\n` +
                    `Age: ${Math.round(ageHours)} hours\n\n` +
                    `Please review and take action immediately.`;

                await notifyRole(targetRole, subject, body);
                escalated++;
                if (process.env.NODE_ENV !== 'production') console.log(`[Escalation] Alert ${alert._id} escalated to Level ${targetLevel} (${targetRole}) — age: ${ageHours.toFixed(1)}h`);
            }
        }

        if (escalated > 0 && process.env.NODE_ENV !== 'production') {
            console.log(`[Escalation] Run complete — ${escalated} alert(s) escalated.`);
        }

    } catch (err) {
        console.error('[Escalation] Cron error:', err);
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
