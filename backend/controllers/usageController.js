const Usage = require('../models/Usage')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')
const Alert = require('../models/Alert')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog') // Added AuditLog Support
const mailer = require('../utils/mailer')
const { checkThresholds } = require('../services/thresholdService')
const mongoose = require('mongoose')
const SystemConfig = require('../models/SystemConfig')
const { RESOURCE_UNITS } = require('../config/constants')

// Helper: Calculate Sustainability Score (Context-Aware)
const calculateSustainabilityScore = async (userId, userRole, blockId) => {
  try {
    let score = 100;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Define match stage based on role
    let matchStage = { usage_date: { $gte: currentMonthStart } };

    if (userRole === 'student' || !userRole) {
      if (!userId) return 0;
      matchStage.userId = new mongoose.Types.ObjectId(userId);
    } else if (userRole === 'warden' && blockId) {
      matchStage.blockId = blockId;
    } else if (userRole === 'warden' && !blockId) {
      // Fallback for warden without block
      matchStage.userId = new mongoose.Types.ObjectId(userId);
    }
    // Admin/Dean/Principal: Calculate based on system average or keep it 100 as baseline?
    // Requirement says "Dean/Principal: read-only analytics". Usually they want to see the CAMPUS score.
    // For now, if Admin/Dean, we calculate based on ALL usage (Campus Score).

    // 1. Fetch Aggregated Usage
    const usageStats = await Usage.aggregate([
      { $match: matchStage },
      { $group: { _id: '$resource_type', total: { $sum: '$usage_value' }, count: { $sum: 1 } } }
    ]) || [];

    // Scale factors: If calculating for a block/campus, thresholds should be higher or per-capita.
    // Since we don't have user count easily here, we'll use a simplified heuristic or per-usage average.
    // However, to be safe and "refactor safely", let's stick to the existing logic but applied to the *aggregate*.
    // If it's a block, the total usage will be huge, so the score might drop to 0 if we use the same thresholds.
    // We should normalize by user count or verify if thresholds are per-person.
    // The previous code had hardcoded thresholds (e.g. Electricity > 1000).
    // Let's assume these are per-student thresholds.
    // If checking for a Block, we should ideally divide by number of students.
    // For now, to prevent score crashing for Wardens, we will return a "System Health" score or similar.
    // But easiest: If Warden, calculate score based on *their own* behavior? No, that's useless.
    // Let's normalize by count if count > 0.

    let totalPenalty = 0;

    if (Array.isArray(usageStats)) {
      usageStats.forEach(stat => {
        if (!stat || !stat._id) return;
        const type = stat._id;
        const total = Number(stat.total) || 0;
        // Normalize if it's a group view (Warden/Admin)
        // detailed logic: if role != student, divide by roughly estimated users or just use the count of records as proxy?
        // Using count of records as proxy for "days * users".
        // Let's stick to the original logic for Students.
        // For Wardens/Admins, we'll average the score of recent usages? No too complex.

        // SIMPLE FIX: If not student, lenient thresholds (x100)
        let thresholdMultiplier = (userRole === 'student') ? 1 : 50;

        if (type === 'Waste' && total > (100 * thresholdMultiplier)) totalPenalty += 30;
        if (type === 'Diesel' && total > (50 * thresholdMultiplier)) totalPenalty += 30;
        if (type === 'Electricity' && total > (1000 * thresholdMultiplier)) totalPenalty += 20;
        if (type === 'LPG' && total > (100 * thresholdMultiplier)) totalPenalty += 20;
        if (type === 'Water' && total > (5000 * thresholdMultiplier)) totalPenalty += 10;
        if (type === 'Food' && total > (200 * thresholdMultiplier)) totalPenalty += 10;
      });
    }

    score -= totalPenalty;

    // 3. Week-over-Week Improvement
    const today = new Date();
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14);

    // Apply same matching scope for trends
    let thisWeekMatch = { ...matchStage, usage_date: { $gte: sevenDaysAgo } };
    let lastWeekMatch = { ...matchStage, usage_date: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } };

    const thisWeek = await Usage.aggregate([
      { $match: thisWeekMatch },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]) || [];

    const lastWeek = await Usage.aggregate([
      { $match: lastWeekMatch },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]) || [];

    const thisWeekTotal = (thisWeek[0] && thisWeek[0].total) || 0;
    const lastWeekTotal = (lastWeek[0] && lastWeek[0].total) || 0;

    if (lastWeekTotal > 0 && thisWeekTotal < lastWeekTotal) {
      score += 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  } catch (err) {
    console.error('Error calculating score:', err.message);
    return 50;
  }
}

// Helper: Send Email
const sendAlertEmail = async (userId, subject, message) => {
  try {
    const user = await User.findById(userId).select('email name')
    if (user && user.email) {
      const text = `Hello ${user.name || ''},\n\n${message}\n\nView your dashboard for details.`
      await mailer.sendMail({ to: user.email, subject, text })
    }
  } catch (err) {
    console.error('Error sending alert email', err)
  }
}

exports.createUsage = async (req, res) => {
  try {
    // ── Role Guard (middleware must run first, but double-check here) ──────────
    const callerRole = req.user?.role;
    const WRITE_ROLES = ['admin', 'warden'];
    if (!callerRole || !WRITE_ROLES.includes(callerRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only Wardens and Admins can log usage. Your role: '${callerRole || 'unknown'}'`
      });
    }

    const resource_type = req.body.resourceType || req.body.resource_type || req.body.resource
    const category = req.body.category || 'General'
    const rawValue = req.body.amount ?? req.body.usage_value
    const usage_date = req.body.date || req.body.usage_date || new Date()
    const notes = req.body.notes || ''

    // ── Numeric & Positive Validation ─────────────────────────────────────────
    if (!resource_type) return res.status(400).json({ success: false, message: 'Resource type is required' })
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return res.status(400).json({ success: false, message: 'Usage value is required' })
    }
    const usage_value = Number(rawValue)
    if (isNaN(usage_value)) return res.status(400).json({ success: false, message: 'Usage value must be a number' })
    if (usage_value <= 0) return res.status(400).json({ success: false, message: 'Usage value must be greater than zero' })
    if (!usage_date) return res.status(400).json({ success: false, message: 'Date is required' })

    // ── Prevent Future Dates ──────────────────────────────────────────────────
    if (new Date(usage_date) > new Date()) {
      return res.status(400).json({ success: false, message: 'Usage date cannot be in the future' });
    }

    const userId = req.userId || req.user?.id || null
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' })

    const user = await User.findById(userId);

    const usage = await Usage.create({
      userId,
      blockId: user?.block || null,
      resource_type,
      category,
      usage_value,
      unit: req.body.unit || (await (async () => {
        try {
          const cfg = await SystemConfig.findOne({ resource: resource_type });
          return cfg?.unit || RESOURCE_UNITS[resource_type] || '';
        } catch (e) { return RESOURCE_UNITS[resource_type] || ''; }
      })()),
      usage_date,
      notes,
      createdBy: userId
    })

    await checkThresholds(userId, resource_type, usage_date);

    try {
      const rules = await AlertRule.find({ userId, resource_type, active: true })
      for (const rule of rules) {
        let triggered = false
        if (rule.comparison === 'gt' && usage_value > rule.threshold_value) triggered = true
        if (rule.comparison === 'lt' && usage_value < rule.threshold_value) triggered = true
        if (rule.comparison === 'eq' && usage_value === Number(rule.threshold_value)) triggered = true

        if (triggered) {
          const message = `Custom Rule Triggered: ${resource_type} (${rule.comparison} ${rule.threshold_value}) met by value ${usage_value}.`
          await AlertLog.create({
            userId, alertRuleId: rule._id, resource_type, usage_value, threshold_value: rule.threshold_value, comparison: rule.comparison, message
          })
          await Alert.create({
            user: userId,
            block: user?.block || null,
            resourceType: resource_type,
            amount: usage_value,
            message,
            severity: 'Medium',
            status: 'Pending'
          });
          await sendAlertEmail(userId, `Custom Alert Rule: ${resource_type}`, message);
        }
      }
    } catch (e) {
      console.error('AlertRule error', e)
    }

    // AUDIT LOG
    try {
      await AuditLog.create({
        action: 'CREATE',
        resourceType: 'Usage',
        resourceId: usage._id,
        userId: userId,
        changes: {
          after: usage.toObject()
        },
        description: `Logged new usage: ${usage_value} ${resource_type}`
      });
    } catch (err) {
      console.error('AuditLog error', err);
    }

    res.status(201).json({ success: true, message: 'Usage logged successfully', usage })
  } catch (err) {
    console.error('createUsage error', err)
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getUsages = async (req, res) => {
  try {
    const { start, end, resource, category, sort, page = 1, limit = 100 } = req.query
    const filter = {}

    // Role-based Access Control
    if (req.user.role === 'student' || !req.user.role || req.user.role === 'user') {
      filter.userId = req.userId
    } else if (req.user.role === 'warden') {
      const user = await User.findById(req.userId);
      if (user && user.block) {
        filter.blockId = user.block;
      } else {
        filter.userId = req.userId;
      }
    }
    // Admin/Dean/Principal see all

    if (resource && resource !== 'All') filter.resource_type = resource
    if (category) filter.category = category

    // Exclude soft-deleted records
    filter.deleted = { $ne: true };

    if (start || end) {
      filter.usage_date = {}
      if (start) filter.usage_date.$gte = new Date(start)
      if (end) filter.usage_date.$lte = new Date(end)
    }

    let sortOption = { usage_date: -1 }
    if (sort) {
      const [field, order] = sort.split(':')
      sortOption = { [field]: order === 'desc' ? -1 : 1 }
    }

    const skip = (page - 1) * limit;
    const usages = await Usage.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'name email role block');

    const total = await Usage.countDocuments(filter);

    res.json({ success: true, usages, total, page: Number(page), pages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getUsage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid record ID' });
    }
    const filter = { _id: id, deleted: { $ne: true } }

    // Strict IDOR Check
    const usage = await Usage.findOne(filter);

    if (!usage) return res.status(404).json({ success: false, message: 'Record not found' })

    // Check ownership
    const isOwner = String(usage.userId) === String(req.userId);
    const isAdmin = ['admin', 'warden', 'dean', 'principal'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, usage })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.updateUsage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid record ID' });
    }

    // 1. Fetch existing record
    const existingUsage = await Usage.findById(id);
    if (!existingUsage) return res.status(404).json({ success: false, message: 'Record not found' });

    // 2. IDOR / Permission Check: Allow if admin OR createdBy matches
    const user = req.userObj || await User.findById(req.userId);
    const isAdmin = user.role === 'admin';
    const isCreator = String(existingUsage.createdBy) === String(req.userId) || String(existingUsage.userId) === String(req.userId);

    // Admin can edit anything; creator can edit their own
    if (isAdmin || isCreator) {
      // Allowed — proceed to update
    }
    // Student / Dean / Principal / Warden (non-owners): No write access
    else {
      const roleMsg = {
        'student': 'Students cannot modify usage records. Please contact your Warden.',
        'warden': 'Wardens can only modify their own usage records or those in their block.',
        'dean': 'Deans have read-only access. You cannot modify usage records.',
        'principal': 'Principals have read-only access. You cannot modify usage records.'
      };
      return res.status(403).json({
        success: false,
        message: roleMsg[user.role] || 'Access denied'
      });
    }

    // 3. Perform Update
    req.body.lastUpdatedBy = req.userId; // Audit trail
    const usage = await Usage.findByIdAndUpdate(id, req.body, { returnDocument: 'after' });

    // AUDIT LOG
    try {
      await AuditLog.create({
        action: 'UPDATE',
        resourceType: 'Usage',
        resourceId: usage._id,
        userId: req.userId,
        changes: {
          before: existingUsage.toObject(),
          after: usage.toObject()
        },
        description: `Updated usage record for ${usage.resource_type}`
      });
    } catch (err) {
      console.error('AuditLog error', err);
    }

    // Re-run threshold checks to recalculate any affected alerts
    try {
      await checkThresholds(req.userId, usage.resource_type, usage.usage_date);
    } catch (e) {
      console.error('Error re-checking thresholds after update:', e.message);
    }

    res.json({ success: true, message: 'Record updated successfully', usage })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.deleteUsage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid record ID' });
    }

    // 1. Fetch existing record
    const existingUsage = await Usage.findById(id);
    if (!existingUsage) return res.status(404).json({ success: false, message: 'Record not found' });

    // 2. IDOR / Permission Check: Allow if admin OR createdBy matches
    const user = req.userObj || await User.findById(req.userId);
    const isAdmin = user.role === 'admin';
    const isCreator = String(existingUsage.createdBy) === String(req.userId) || String(existingUsage.userId) === String(req.userId);

    // Admin can delete anything; creator can delete their own
    if (isAdmin || isCreator) {
      // Allowed — proceed to delete
    }
    // Student / Dean / Principal / Warden (non-owners): No write access
    else {
      const roleMsg = {
        'student': 'Students cannot delete usage records. Please contact your Warden.',
        'warden': 'Wardens can only delete their own usage records or those in their block.',
        'dean': 'Deans have read-only access. You cannot delete usage records.',
        'principal': 'Principals have read-only access. You cannot delete usage records.'
      };
      return res.status(403).json({
        success: false,
        message: roleMsg[user.role] || 'Access denied'
      });
    }

    // 3. Soft-delete: mark record as deleted and set metadata
    existingUsage.deleted = true;
    existingUsage.deletedAt = new Date();
    existingUsage.deletedBy = req.userId;
    await existingUsage.save();

    // Re-run threshold checks for the same date/resource to update/remove alerts
    try {
      await checkThresholds(req.userId, existingUsage.resource_type, existingUsage.usage_date);
    } catch (e) {
      console.error('Error re-checking thresholds after delete:', e.message);
    }

    // AUDIT LOG — include before/after
    try {
      await AuditLog.create({
        action: 'DELETE',
        resourceType: 'Usage',
        resourceId: existingUsage._id,
        userId: req.userId,
        changes: {
          before: existingUsage.toObject(),
          after: { deleted: true, deletedAt: existingUsage.deletedAt }
        },
        description: `Soft-deleted usage record for ${existingUsage.resource_type}`
      });
    } catch (err) {
      console.error('AuditLog error', err);
    }

    // Emit a lightweight event so connected clients can refresh alert counts
    try {
      const socketUtil = require('../utils/socket');
      const io = socketUtil.getIO && socketUtil.getIO();
      if (io) io.emit('alerts:refresh');
    } catch (e) { /* non-fatal */ }

    res.json({ success: true, message: 'Record deleted (soft) successfully' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getDashboardStats = async (req, res) => {
  try {
    if (!req.user || !req.userId) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    const userId = req.userId;
    const userRole = req.user.role || 'student';
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let matchStage = { usage_date: { $gte: startOfMonth } };

    try {
      if (userRole === 'student') {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      } else if (userRole === 'warden') {
        const user = await User.findById(userId);
        if (user && user.block) {
          // If warden has a block, aggregate usage for that block
          // We can match by blockId directly if Usage has blockId, or by userIds in that block
          // Usage model has blockId, so let's try that first for efficiency, 
          // but fallback to userId list if blockId isn't populated on usages.
          // Since usageController.createUsage adds blockId, we should prioritize blockId.
          matchStage.blockId = user.block;
          delete matchStage.userId; // Remove userId constraint to see all block usage
        } else {
          // Warden without block sees their own usage
          matchStage.userId = new mongoose.Types.ObjectId(userId);
        }
      } else if (['admin', 'dean', 'principal'].includes(userRole)) {
        // Admin/Dean/Principal might want to see everything or just their own.
        // For now, let's show them their own usage here, 
        // as they have specific dashboards for system-wide stats.
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }
    } catch (filterErr) {
      console.error('Filter construction error:', filterErr);
      matchStage.userId = new mongoose.Types.ObjectId(userId);
    }

    const usageStats = await Usage.aggregate([
      { $match: matchStage },
      { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
    ]) || [];

    const stats = {};
    let totalUsage = 0;

    if (Array.isArray(usageStats)) {
      usageStats.forEach(item => {
        if (!item || !item._id) return;

        let rate = 0;
        switch (item._id) {
          case 'Electricity': rate = 12; break;
          case 'Water': rate = 0.5; break;
          case 'LPG': rate = 80; break;
          case 'Diesel': rate = 95; break;
          case 'Food': rate = 150; break;
          default: rate = 10;
        }

        const val = Number(item.total) || 0;
        stats[item._id] = {
          current: val,
          cost: (val * rate).toFixed(2)
        };
        totalUsage += val;
      });
    }



    // Calculate Sustainability Score with Role Context
    let blockId = null;
    if (req.userObj && req.userObj.block) blockId = req.userObj.block;
    // Fallback if not attached
    if (!blockId && userRole === 'warden') {
      const u = await User.findById(userId);
      if (u) blockId = u.block;
    }

    const score = await calculateSustainabilityScore(userId, userRole, blockId);

    let alertFilter = {};
    if (userRole === 'student') {
      alertFilter.user = userId;
    } else if (userRole === 'warden') {
      const user = await User.findById(userId);
      if (user && user.block) {
        alertFilter.block = user.block;
      } else {
        alertFilter.user = userId;
      }
    }

    const recentAlerts = await Alert.find(alertFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .catch(() => []);

    res.json({
      role: userRole,
      stats: stats,
      sustainabilityScore: score,
      totalUsage: totalUsage,
      monthlyUsage: [],
      recentAlerts: recentAlerts || []
    });

  } catch (err) {
    console.error('getDashboardStats CRITICAL Failure:', err);
    res.json({
      role: req.user?.role || 'student',
      stats: {},
      sustainabilityScore: 0,
      totalUsage: 0,
      monthlyUsage: [],
      recentAlerts: []
    });
  }
}

/**
 * @desc    Get daily usage trend data for a specific resource
 * @route   GET /api/usage/trends?resource=Electricity&range=7days
 * @access  Private (all roles)
 */
exports.getUsageTrends = async (req, res) => {
  try {
    const { resource, range = '7days' } = req.query;
    const userId = req.userId || req.user?.id;
    const userRole = req.user?.role || 'student';

    // ── Date range ──────────────────────────────────────────────
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    let startDate;
    if (range === '30days') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    } else if (range === 'monthly') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    } else {
      // Default: 7 days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 6); // inclusive of today = 7 days
    }
    startDate.setHours(0, 0, 0, 0);

    // ── Role-based match filter ──────────────────────────────────
    let matchFilter = { usage_date: { $gte: startDate, $lte: endDate } };

    if (resource && resource !== 'All') {
      matchFilter.resource_type = resource;
    }

    if (userRole === 'student') {
      matchFilter.userId = new mongoose.Types.ObjectId(userId);
    } else if (userRole === 'warden') {
      const user = await User.findById(userId);
      if (user && user.block) {
        matchFilter.blockId = user.block;
      } else {
        matchFilter.userId = new mongoose.Types.ObjectId(userId);
      }
    }
    // admin / dean / principal → no extra filter, see all

    // ── Aggregate by date ────────────────────────────────────────
    const aggregated = await Usage.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$usage_date' }
          },
          total: { $sum: '$usage_value' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          total: { $round: ['$total', 2] }
        }
      }
    ]);

    res.json({ success: true, data: aggregated, range, resource: resource || 'All' });

  } catch (err) {
    console.error('getUsageTrends error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
