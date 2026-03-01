/**
 * controllers/alertsController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Institutional Alert Management — production-grade incident lifecycle controller
 *
 * Lifecycle:  Active → Investigating → Reviewed → Resolved
 *                   ↘ Escalated (auto) ↗
 *                   ↘ Dismissed (Admin/Warden)
 *
 * Role permissions enforced at route level (alertsRoutes.js) AND here for safety.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Alert = require('../models/Alert');
const Block = require('../models/Block');
const AlertRule = require('../models/AlertRule');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const mongoose = require('mongoose');

const { ROLES } = require('../config/roles');
const {
  ALERT_STATUS, ALERT_TYPES, SEVERITY_LEVELS,
  currentMonthRange, daysAgo, apiSuccess, apiError,
} = require('../config/constants');

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Write a silent AuditLog entry — never throws */
async function _audit(action, alertId, userId, description, changes = {}) {
  try {
    await AuditLog.create({
      action, resourceType: 'Alert', resourceId: alertId,
      userId, description, changes,
    });
  } catch { /* non-critical — never crash the main flow */ }
}

/** Build role-scoped Mongoose filter for the requesting user */
async function _buildScopeFilter(reqUser) {
  const filter = {};
  const role = reqUser.role;

  if (role === ROLES.STUDENT) {
    const user = await User.findById(reqUser.id).lean();
    if (user?.block) filter.block = user.block;
    else filter.user = reqUser.id;

  } else if (role === ROLES.WARDEN) {
    const user = await User.findById(reqUser.id).lean();
    if (user?.block) filter.block = user.block;

  } else if (role === ROLES.PRINCIPAL) {
    // Principal sees only Escalated / Severe / Critical
    filter.$or = [
      { status: ALERT_STATUS.ESCALATED },
      { severity: { $in: ['Critical', 'Severe'] } },
    ];
  }
  // Admin / Dean → no scope restriction (see all)
  return filter;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/alerts  — list with filters, role-scoped
// ─────────────────────────────────────────────────────────────────────────────
exports.getAlerts = async (req, res) => {
  try {
    const { status, severity, blockId, alertType, startDate, endDate,
      page = 1, limit = 50 } = req.query;

    let filter = await _buildScopeFilter(req.user);

    // Additional query filters (students cannot override their scope)
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (alertType) filter.alertType = alertType;
    if (blockId && req.user.role !== ROLES.STUDENT) filter.block = blockId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(parseInt(limit), 200);
    const pageSize = Math.min(parseInt(limit) || 50, 200);

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('block', 'name')
        .populate('user', 'name email role')
        .populate('resolvedBy', 'name email role')
        .populate('reviewedBy', 'name email role')
        .populate('investigatedBy', 'name email role')
        .populate('comments.addedBy', 'name email role')
        .lean(),
      Alert.countDocuments(filter),
    ]);

    // Dynamic counts from DB (not from the current page slice)
    const [countDocs] = await Alert.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          escalated: { $sum: { $cond: [{ $eq: ['$status', 'Escalated'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          dismissed: { $sum: { $cond: [{ $eq: ['$status', 'Dismissed'] }, 1, 0] } },
          critical: {
            $sum: {
              $cond: [{ $in: ['$severity', ['High', 'Critical', 'Severe']] }, 1, 0]
            }
          },
        }
      }
    ]);

    const counts = countDocs || {
      total: 0, active: 0, escalated: 0,
      resolved: 0, dismissed: 0, critical: 0,
    };
    delete counts._id;

    return apiSuccess(res, {
      alerts,
      pagination: { page: parseInt(page), limit: pageSize, total },
      counts,
    });

  } catch (err) {
    console.error('[Alerts] getAlerts error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/alerts/:id  — single alert with full comment timeline
// ─────────────────────────────────────────────────────────────────────────────
exports.getAlert = async (req, res) => {
  try {
    // Validate ObjectId to avoid CastError when path segments like "count" are passed
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }

    const alert = await Alert.findById(req.params.id)
      .populate('block', 'name')
      .populate('user', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('resolvedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .populate('investigatedBy', 'name email role')
      .populate('acknowledgedBy', 'name email role')
      .populate('comments.addedBy', 'name email role')
      .lean();

    if (!alert) return apiError(res, 'Alert not found', 404);

    // Scope check: student can only see their block's alerts
    if (req.user.role === ROLES.STUDENT) {
      const user = await User.findById(req.user.id).lean();
      const allowedBlock = user?.block?.toString();
      if (allowedBlock && alert.block?._id?.toString() !== allowedBlock) {
        return apiError(res, 'Access denied', 403);
      }
    }

    return apiSuccess(res, { alert });
  } catch (err) {
    console.error('[Alerts] getAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/alerts  — create manual alert (Admin / Warden)
// ─────────────────────────────────────────────────────────────────────────────
exports.createAlert = async (req, res) => {
  try {
    const { blockId, resourceType, message, severity, amount, threshold, comment } = req.body;

    if (!resourceType || !message) {
      return apiError(res, 'resourceType and message are required', 400);
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const alertData = {
      block: blockId || null,
      user: req.user.id,
      resourceType,
      alertType: ALERT_TYPES.MANUAL,
      alertDate: today,
      message,
      severity: severity || 'Warning',
      amount: amount || null,
      threshold: threshold || null,
      status: ALERT_STATUS.ACTIVE,
      createdBy: req.user.id,
    };

    // Optionally seed the first comment
    if (comment?.trim()) {
      alertData.comments = [{
        comment: comment.trim(),
        addedBy: req.user.id,
        role: req.user.role,
      }];
    }

    const alert = await Alert.create(alertData);
    const populated = await Alert.findById(alert._id)
      .populate('block', 'name')
      .populate('user', 'name email');

    await _audit('CREATE', alert._id, req.user.id,
      `Manual alert created by ${req.user.role}: ${message}`);

    // Notify connected clients about new manual alert
    try {
      const socketUtil = require('../utils/socket');
      const io = socketUtil.getIO && socketUtil.getIO();
      if (io) io.emit('alerts:refresh');
    } catch (e) { /* non-fatal */ }

    return apiSuccess(res, { message: 'Alert created', alert: populated }, 201);

  } catch (err) {
    console.error('[Alerts] createAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUT /api/alerts/:id/investigate  — Warden / Admin
// ─────────────────────────────────────────────────────────────────────────────
exports.investigateAlert = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }
    const alert = await Alert.findById(req.params.id);
    if (!alert) return apiError(res, 'Alert not found', 404);
    if (alert.status === ALERT_STATUS.RESOLVED) return apiError(res, 'Alert already resolved', 400);
    if (alert.status === ALERT_STATUS.DISMISSED) return apiError(res, 'Alert was dismissed', 400);

    alert.status = ALERT_STATUS.INVESTIGATING;
    alert.investigatedBy = req.user.id;
    alert.investigatedAt = new Date();
    alert.isRead = true;

    // Optionally add a comment
    const comment = req.body?.comment?.trim();
    if (comment) {
      alert.comments.push({ comment, addedBy: req.user.id, role: req.user.role });
    }
    await alert.save();

    await _audit('REVIEW_ALERT', alert._id, req.user.id,
      `Alert marked Investigating by ${req.user.role}`,
      { after: { status: 'Investigating' } });

    const updated = await Alert.findById(alert._id)
      .populate('block', 'name')
      .populate('investigatedBy', 'name email');
    return apiSuccess(res, { message: 'Alert marked as Investigating', alert: updated });

  } catch (err) {
    console.error('[Alerts] investigateAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUT /api/alerts/:id/review  — non-students
//    Students cannot review; Dean allowed to override an Escalated alert
// ─────────────────────────────────────────────────────────────────────────────
exports.reviewAlert = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }
    const alert = await Alert.findById(req.params.id);
    if (!alert) return apiError(res, 'Alert not found', 404);
    if (alert.status === ALERT_STATUS.RESOLVED) return apiError(res, 'Alert already resolved', 400);

    alert.status = ALERT_STATUS.REVIEWED;
    alert.reviewedBy = req.user.id;
    alert.reviewedAt = new Date();
    alert.isRead = true;

    const comment = req.body?.comment?.trim();
    if (comment) {
      alert.comments.push({ comment, addedBy: req.user.id, role: req.user.role });
    }
    await alert.save();

    await _audit('REVIEW_ALERT', alert._id, req.user.id,
      `Alert reviewed by ${req.user.role}`,
      { after: { status: 'Reviewed' } });

    const updated = await Alert.findById(alert._id)
      .populate('block', 'name')
      .populate('reviewedBy', 'name email');
    return apiSuccess(res, { message: 'Alert marked as Reviewed', alert: updated });

  } catch (err) {
    console.error('[Alerts] reviewAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUT /api/alerts/:id/resolve  — non-students
// ─────────────────────────────────────────────────────────────────────────────
exports.resolveAlert = async (req, res) => {
  try {
    // Only Warden, Dean, Admin, Principal can resolve alerts
    if (![ROLES.WARDEN, ROLES.DEAN, ROLES.ADMIN, ROLES.PRINCIPAL].includes(req.user.role)) {
      return apiError(res, 'Access denied', 403);
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }
    const alert = await Alert.findById(req.params.id);
    if (!alert) return apiError(res, 'Alert not found', 404);
    if (alert.status === ALERT_STATUS.RESOLVED)
      return apiError(res, 'Alert is already resolved', 400);

    const comment = req.body?.comment?.trim() || 'Resolved';

    alert.status = ALERT_STATUS.RESOLVED;
    alert.resolvedBy = req.user.id;
    alert.resolvedAt = new Date();
    alert.resolutionComment = comment;
    alert.isRead = true;

    alert.comments.push({
      comment: `Resolved: ${comment}`,
      addedBy: req.user.id,
      role: req.user.role,
    });
    await alert.save();

    await _audit('RESOLVE_ALERT', alert._id, req.user.id,
      `Alert resolved by ${req.user.role}: ${comment}`,
      { after: { status: 'Resolved', resolutionComment: comment } });

    const updated = await Alert.findById(alert._id)
      .populate('block', 'name')
      .populate('resolvedBy', 'name email')
      .populate('reviewedBy', 'name email');
    return apiSuccess(res, { message: 'Alert resolved successfully', alert: updated });

  } catch (err) {
    console.error('[Alerts] resolveAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. PUT /api/alerts/:id/dismiss  — Admin / Warden
// ─────────────────────────────────────────────────────────────────────────────
exports.dismissAlert = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }
    const alert = await Alert.findById(req.params.id);
    if (!alert) return apiError(res, 'Alert not found', 404);
    if (alert.status === ALERT_STATUS.RESOLVED)
      return apiError(res, 'Cannot dismiss a resolved alert', 400);

    const reason = req.body?.reason?.trim() || 'Dismissed by operator';
    alert.status = ALERT_STATUS.DISMISSED;
    alert.isRead = true;
    alert.comments.push({
      comment: `Dismissed: ${reason}`,
      addedBy: req.user.id,
      role: req.user.role,
    });
    await alert.save();

    await _audit('RESOLVE_ALERT', alert._id, req.user.id,
      `Alert dismissed by ${req.user.role}: ${reason}`);

    return apiSuccess(res, { message: 'Alert dismissed', alert });

  } catch (err) {
    console.error('[Alerts] dismissAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. PUT /api/alerts/:id/acknowledge  — non-students
// ─────────────────────────────────────────────────────────────────────────────
exports.acknowledgeAlert = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }
    const alert = await Alert.findById(req.params.id);
    if (!alert) return apiError(res, 'Alert not found', 404);

    if (req.user.role === ROLES.PRINCIPAL) {
      alert.principalAcknowledgedBy = req.user.id;
      alert.principalAcknowledgedAt = new Date();
    }
    alert.acknowledgedBy = alert.acknowledgedBy || req.user.id;
    alert.acknowledgedAt = alert.acknowledgedAt || new Date();
    alert.isRead = true;
    await alert.save();

    await _audit('REVIEW_ALERT', alert._id, req.user.id,
      `Alert acknowledged by ${req.user.role}`);

    return apiSuccess(res, { message: 'Alert acknowledged', alert });

  } catch (err) {
    console.error('[Alerts] acknowledgeAlert error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /api/alerts/:id/comment  — add investigation note to timeline
//    Students cannot add comments (read-only)
// ─────────────────────────────────────────────────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return apiError(res, 'Students cannot add investigation notes', 403);
    }

    const { comment } = req.body;
    if (!comment?.trim()) return apiError(res, 'Comment text is required', 400);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert ID' });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) return apiError(res, 'Alert not found', 404);
    if ([ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED].includes(alert.status)) {
      return apiError(res, 'Cannot add comment to a closed alert', 400);
    }

    alert.comments.push({
      comment: comment.trim(),
      addedBy: req.user.id,
      role: req.user.role,
      timestamp: new Date(),
    });
    await alert.save();

    const updated = await Alert.findById(alert._id)
      .populate('comments.addedBy', 'name email role')
      .lean();

    return apiSuccess(res, {
      message: 'Comment added',
      comments: updated.comments,
    });

  } catch (err) {
    console.error('[Alerts] addComment error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET /api/alerts/stats  — dynamic counts (Admin / Dean / Principal)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAlertStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = daysAgo(parseInt(days));

    // All aggregations run in parallel
    const [
      byStatus,
      bySeverity,
      byResource,
      byBlockRaw,
      escalationTrend,
      resolutionAgg,
    ] = await Promise.all([
      // Status breakdown
      Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Severity breakdown
      Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Per resource
      Alert.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$resourceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Per block (top 10)
      Alert.aggregate([
        { $match: { createdAt: { $gte: since }, block: { $exists: true, $ne: null } } },
        { $group: { _id: '$block', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Daily trend (escalated alerts)
      Alert.aggregate([
        { $match: { status: ALERT_STATUS.ESCALATED, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          }
        },
        { $sort: { _id: 1 } },
      ]),

      // Average resolution time (hours)
      Alert.aggregate([
        {
          $match: {
            status: ALERT_STATUS.RESOLVED,
            resolvedAt: { $exists: true },
            createdAt: { $gte: since },
          }
        },
        {
          $project: {
            resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            avgMs: { $avg: '$resolutionMs' },
            count: { $sum: 1 },
          }
        },
      ]),
    ]);

    // Enrich block IDs with names
    const blockIds = byBlockRaw.map(b => b._id);
    const blocks = await Block.find({ _id: { $in: blockIds } }).select('name').lean();
    const blockNameMap = blocks.reduce((m, b) => { m[b._id.toString()] = b.name; return m; }, {});
    const byBlock = byBlockRaw.map(b => ({
      blockId: b._id,
      blockName: blockNameMap[b._id?.toString()] || 'Unknown',
      count: b.count,
    }));

    const avgResolutionHours = resolutionAgg[0]
      ? Math.round((resolutionAgg[0].avgMs || 0) / (1000 * 60 * 60))
      : 0;

    // Total active (not terminal) alerts
    const totalActive = await Alert.countDocuments({
      status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] },
    });

    return apiSuccess(res, {
      period: `Last ${days} days`,
      stats: {
        totalActive,
        byStatus,
        bySeverity,
        byResource,
        byBlock,
        escalationTrend,
        avgResolutionHours: `${avgResolutionHours} hours`,
        resolvedCount: resolutionAgg[0]?.count || 0,
      },
    });

  } catch (err) {
    console.error('[Alerts] getAlertStats error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts/count  — lightweight counts for notification badge (role-scoped)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAlertCount = async (req, res) => {
  try {
    const scopeFilter = await _buildScopeFilter(req.user);

    // Base active filter (not terminal)
    const activeFilter = { ...scopeFilter, status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] } };

    const [totalActive, pending, investigating, reviewed, escalated, unread, critical] = await Promise.all([
      Alert.countDocuments(activeFilter),
      Alert.countDocuments({ ...scopeFilter, status: ALERT_STATUS.ACTIVE }),
      Alert.countDocuments({ ...scopeFilter, status: ALERT_STATUS.INVESTIGATING }),
      Alert.countDocuments({ ...scopeFilter, status: ALERT_STATUS.REVIEWED }),
      Alert.countDocuments({ ...scopeFilter, status: ALERT_STATUS.ESCALATED }),
      Alert.countDocuments({ ...scopeFilter, isRead: false, status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] } }),
      Alert.countDocuments({ ...scopeFilter, severity: { $in: ['High', 'Critical', 'Severe'] }, status: { $nin: [ALERT_STATUS.RESOLVED, ALERT_STATUS.DISMISSED] } }),
    ]);

    return apiSuccess(res, {
      counts: {
        totalActive,
        pending,
        investigating,
        reviewed,
        escalated,
        unread,
        critical,
      }
    });
  } catch (err) {
    console.error('[Alerts] getAlertCount error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /api/alerts/analytics  — institutional analytics endpoint
// ─────────────────────────────────────────────────────────────────────────────
exports.getAlertAnalytics = async (req, res) => {
  try {
    const { start: monthStart, end: monthEnd } = currentMonthRange();

    const [
      totalThisMonth,
      perResource,
      perBlock,
      resolutionAgg,
      severityDistribution,
    ] = await Promise.all([
      // Total alerts this month
      Alert.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),

      // Alerts per resource this month
      Alert.aggregate([
        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: '$resourceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, resource: '$_id', count: 1 } },
      ]),

      // Alerts per block this month (with block names)
      Alert.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart, $lte: monthEnd },
            block: { $exists: true, $ne: null },
          }
        },
        { $group: { _id: '$block', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        {
          $lookup: {
            from: 'blocks',
            localField: '_id',
            foreignField: '_id',
            as: 'blockInfo',
          }
        },
        {
          $project: {
            _id: 0,
            blockName: { $arrayElemAt: ['$blockInfo.name', 0] },
            count: 1,
          }
        },
      ]),

      // Average resolution time this month
      Alert.aggregate([
        {
          $match: {
            status: ALERT_STATUS.RESOLVED,
            resolvedAt: { $exists: true },
            createdAt: { $gte: monthStart, $lte: monthEnd },
          }
        },
        {
          $project: {
            resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] }
          }
        },
        { $group: { _id: null, avgMs: { $avg: '$resolutionMs' }, count: { $sum: 1 } } },
      ]),

      // Severity breakdown this month
      Alert.aggregate([
        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { _id: 0, severity: '$_id', count: 1 } },
      ]),
    ]);

    const avgResolutionHours = resolutionAgg[0]
      ? Math.round((resolutionAgg[0].avgMs || 0) / (1000 * 60 * 60))
      : 0;

    return apiSuccess(res, {
      month: monthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      analytics: {
        totalThisMonth,
        perResource,
        perBlock,
        severityDistribution,
        avgResolutionTime: `${avgResolutionHours} hours`,
        resolvedThisMonth: resolutionAgg[0]?.count || 0,
      },
    });

  } catch (err) {
    console.error('[Alerts] getAlertAnalytics error:', err);
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. GET /api/alerts/system  — system alerts (legacy endpoint kept for compat)
// ─────────────────────────────────────────────────────────────────────────────
exports.getSystemAlerts = async (req, res) => {
  try {
    const scopeFilter = await _buildScopeFilter(req.user);

    const alerts = await Alert.find(scopeFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('user', 'name')
      .populate('block', 'name')
      .lean();

    return apiSuccess(res, { alerts });
  } catch (err) {
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. Alert Rule CRUD (unchanged — personal custom rules)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAlertRules = async (req, res) => {
  try {
    const rules = await AlertRule.find({ userId: req.user.id });
    return apiSuccess(res, { rules });
  } catch (err) {
    return apiError(res, err.message);
  }
};

exports.updateAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { returnDocument: 'after' }
    );
    if (!rule) return apiError(res, 'Rule not found', 404);
    return apiSuccess(res, { message: 'Rule updated', rule });
  } catch (err) {
    return apiError(res, err.message);
  }
};

exports.deleteAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!rule) return apiError(res, 'Rule not found', 404);
    return apiSuccess(res, { message: 'Rule deleted' });
  } catch (err) {
    return apiError(res, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MODULE EXPORTS  (reference exports.* — they are set with exports.fn = syntax above)
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getAlerts: exports.getAlerts,
  // Backwards-compatible alias
  getAllAlerts: exports.getAlerts,
  getAlert: exports.getAlert,
  // Backwards-compatible alias
  getAlertById: exports.getAlert,
  getAlertCount: exports.getAlertCount,
  createAlert: exports.createAlert,
  investigateAlert: exports.investigateAlert,
  reviewAlert: exports.reviewAlert,
  resolveAlert: exports.resolveAlert,
  dismissAlert: exports.dismissAlert,
  acknowledgeAlert: exports.acknowledgeAlert,
  addComment: exports.addComment,
  getAlertStats: exports.getAlertStats,
  getAlertAnalytics: exports.getAlertAnalytics,
  getSystemAlerts: exports.getSystemAlerts,
  getAlertRules: exports.getAlertRules,
  updateAlertRule: exports.updateAlertRule,
  deleteAlertRule: exports.deleteAlertRule,
};

