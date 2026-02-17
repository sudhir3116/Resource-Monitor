const Alert = require('../models/Alert');
const Block = require('../models/Block');
const AlertRule = require('../models/AlertRule');
const { ROLES } = require('../config/roles');

/**
 * @desc    Get all alerts with filters
 * @route   GET /api/alerts?status=Pending&severity=High&blockId=xxx
 * @access  Private (Not for students)
 */
exports.getAlerts = async (req, res) => {
  try {
    const { status, severity, blockId, startDate, endDate } = req.query;

    // Students cannot access alerts
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        error: 'Students do not have access to alerts'
      });
    }

    let filter = {};

    // Role-based filtering
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user.block) {
        filter.block = user.block;
      }
    }

    // Apply query filters
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (blockId) filter.block = blockId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .populate('block', 'name')
      .populate('user', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('reviewedBy', 'name email')
      .limit(100);

    // Calculate summary stats
    const stats = {
      total: alerts.length,
      pending: alerts.filter(a => a.status === 'Pending').length,
      reviewed: alerts.filter(a => a.status === 'Reviewed').length,
      resolved: alerts.filter(a => a.status === 'Resolved').length,
      high: alerts.filter(a => a.severity === 'High' || a.severity === 'Critical').length
    };

    res.json({
      success: true,
      alerts,
      stats
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Mark alert as reviewed
 * @route   PUT /api/alerts/:id/review
 * @access  Private (Warden, Admin, Dean, Principal)
 */
exports.reviewAlert = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    alert.status = 'Reviewed';
    alert.reviewedBy = req.user.id;
    alert.reviewedAt = new Date();
    alert.isRead = true;

    await alert.save();

    const updatedAlert = await Alert.findById(alert._id)
      .populate('block', 'name')
      .populate('reviewedBy', 'name email');

    res.json({
      success: true,
      message: 'Alert marked as reviewed',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Review alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Resolve alert with comment
 * @route   PUT /api/alerts/:id/resolve
 * @access  Private (Admin, Warden, Dean, Principal)
 */
exports.resolveAlert = async (req, res) => {
  try {
    const { comment } = req.body;

    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Resolution comment is required'
      });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    alert.status = 'Resolved';
    alert.resolvedBy = req.user.id;
    alert.resolvedAt = new Date();
    alert.resolutionComment = comment;
    alert.isRead = true;

    await alert.save();

    const updatedAlert = await Alert.findById(alert._id)
      .populate('block', 'name')
      .populate('resolvedBy', 'name email')
      .populate('reviewedBy', 'name email');

    console.log(`✅ Alert resolved by ${req.user.email}: ${alert.message}`);

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alert: updatedAlert
    });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Dismiss alert
 * @route   PUT /api/alerts/:id/dismiss
 * @access  Private (Admin, Warden)
 */
exports.dismissAlert = async (req, res) => {
  try {
    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.WARDEN) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    alert.status = 'Dismissed';
    alert.isRead = true;
    await alert.save();

    res.json({
      success: true,
      message: 'Alert dismissed',
      alert
    });
  } catch (error) {
    console.error('Dismiss alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get alert statistics and trends
 * @route   GET /api/alerts/stats
 * @access  Private (Admin, Dean, Principal)
 */
exports.getAlertStats = async (req, res) => {
  try {
    if (![ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Total alerts
    const totalAlerts = await Alert.countDocuments({
      createdAt: { $gte: startDate }
    });

    // By status
    const byStatus = await Alert.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // By severity
    const bySeverity = await Alert.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // By block
    const byBlock = await Alert.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$block',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Populate block names
    const blocks = await Block.find({ _id: { $in: byBlock.map(b => b._id) } });
    const blockMap = {};
    blocks.forEach(b => blockMap[b._id] = b.name);
    byBlock.forEach(b => b.blockName = blockMap[b._id] || 'Unknown');

    // Trend over time (daily)
    const trend = await Alert.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Average resolution time (for resolved alerts)
    const resolvedAlerts = await Alert.find({
      status: 'Resolved',
      resolvedAt: { $exists: true },
      createdAt: { $gte: startDate }
    });

    let avgResolutionTime = 0;
    if (resolvedAlerts.length > 0) {
      const totalTime = resolvedAlerts.reduce((sum, alert) => {
        const diff = alert.resolvedAt - alert.createdAt;
        return sum + diff;
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedAlerts.length / (1000 * 60 * 60)); // hours
    }

    res.json({
      success: true,
      period: `Last ${days} days`,
      stats: {
        totalAlerts,
        byStatus,
        bySeverity,
        byBlock,
        trend,
        avgResolutionTime: `${avgResolutionTime} hours`
      }
    });
  } catch (error) {
    console.error('Alert stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Create manual alert
 * @route   POST /api/alerts
 * @access  Private (Admin, Warden)
 */
exports.createAlert = async (req, res) => {
  try {
    if (![ROLES.ADMIN, ROLES.WARDEN].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { blockId, resourceType, message, severity, amount, threshold } = req.body;

    if (!blockId || !resourceType || !message) {
      return res.status(400).json({
        success: false,
        error: 'Block, resource type, and message are required'
      });
    }

    const alert = await Alert.create({
      block: blockId,
      resourceType,
      message,
      severity: severity || 'Medium',
      amount,
      threshold,
      status: 'Pending'
    });

    const populatedAlert = await Alert.findById(alert._id)
      .populate('block', 'name');

    console.log(`📢 Manual alert created by ${req.user.email}: ${message}`);

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      alert: populatedAlert
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get all alert rules
 * @route   GET /api/alerts/rules
 * @access  Private
 */
exports.getAlertRules = async (req, res) => {
  try {
    const rules = await AlertRule.find({ userId: req.user.id });
    res.json({ success: true, rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get system logs (alerts)
 * @route   GET /api/alerts/system
 * @access  Private
 */
exports.getSystemAlerts = async (req, res) => {
  try {
    const { ROLES } = require('../config/roles');
    let filter = {};

    // Role-based filtering
    if (req.user.role === ROLES.STUDENT) {
      filter.user = req.user.id;
    } else if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user && user.block) filter.block = user.block;
    }

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('user', 'name block')
      .populate('block', 'name');

    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update alert rule (active/inactive)
 * @route   PATCH /api/alerts/:id
 * @access  Private
 */
exports.updateAlertRule = async (req, res) => {
  try {
    // IDOR Check handled by query filter { userId: req.user.id }
    const rule = await AlertRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, message: 'Rule updated', rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete alert rule
 * @route   DELETE /api/alerts/:id
 * @access  Private
 */
exports.deleteAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAlerts: exports.getAlerts,
  reviewAlert: exports.reviewAlert,
  resolveAlert: exports.resolveAlert,
  dismissAlert: exports.dismissAlert,
  getAlertStats: exports.getAlertStats,
  createAlert: exports.createAlert,
  getAlertRules: exports.getAlertRules,
  getSystemAlerts: exports.getSystemAlerts,
  updateAlertRule: exports.updateAlertRule,
  deleteAlertRule: exports.deleteAlertRule
};
