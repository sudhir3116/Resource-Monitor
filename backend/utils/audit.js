const AuditLog = require('../models/AuditLog');

/**
 * Safe audit helper — never throws to avoid breaking main flow.
 * action: string, resourceType: string, resourceId: ObjectId|null, userId: ObjectId|null
 */
async function logAction(action, resourceType, resourceId, userId, description = '', changes = {}, meta = {}) {
  try {
    await AuditLog.create({
      action,
      resourceType,
      resourceId: resourceId || null,
      userId: userId || null,
      description,
      changes,
      ipAddress: meta.ip || null,
      userAgent: meta.userAgent || null,
      createdAt: new Date()
    });
  } catch (e) {
    // swallow errors — auditing is important but non-blocking
    try { console.error('[Audit] failed to write audit log', e.message); } catch (e2) {}
  }
}

module.exports = { logAction };
