const Usage = require('../models/Usage')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')
const Alert = require('../models/Alert')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog') // Added AuditLog Support
const mailer = require('../utils/mailer')
const { checkThresholds } = require('../services/thresholdService')
const mongoose = require('mongoose')
const Resource = require('../models/Resource')
const { RESOURCE_UNITS } = require('../config/constants')
const { parseSortParam, buildDateRangeFilter, parsePagination } = require('../utils/queryBuilder')
const exportService = require('../services/exportService')
const metricsService = require('../services/metricsService')
const anomalyService = require('../services/anomalyService')

// ── STEP 2: Safe blockId helper (prevents [object Object] in queries) ─────────────────
const safeBlockId = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && raw._id) raw = raw._id;
  const str = raw.toString();
  if (str.includes('[object') || str.length !== 24) {
    console.warn('[UsageCtrl] Invalid blockId rejected:', str);
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(str)) return null;
  return new mongoose.Types.ObjectId(str);
};

// Helper: Calculate Sustainability Score (Context-Aware)
const calculateSustainabilityScore = async (userId, userRole, blockId) => {
  try {
    let score = 100;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Define match stage based on role
    let matchStage = { usage_date: { $gte: currentMonthStart } };

    if (userRole === 'student' || !userRole) {
      if (blockId) {
        matchStage.blockId = blockId;
      } else if (userId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      } else {
        return 0;
      }
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

        if (type === 'Solar' && total > (100 * thresholdMultiplier)) totalPenalty -= 10;
        if (type === 'Waste' && total > (100 * thresholdMultiplier)) totalPenalty += 30;
        if (type === 'Diesel' && total > (50 * thresholdMultiplier)) totalPenalty += 30;
        if (type === 'Electricity' && total > (1000 * thresholdMultiplier)) totalPenalty += 20;
        if (type === 'LPG' && total > (100 * thresholdMultiplier)) totalPenalty += 20;
        if (type === 'Water' && total > (5000 * thresholdMultiplier)) totalPenalty += 10;
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
    const user = req.user
    const role = (user.role || '').toLowerCase()

    // 1. Extract payload rigorously
    console.log("[UsageController.create] req.body:", JSON.stringify(req.body, null, 2));

    const {
      resourceId, resource_id, resource_type,
      amount, value, usage_value,
      date, usage_date,
      notes,
      category = ""
    } = req.body;

    const rId = resourceId || resource_id;
    const finalAmount = amount !== undefined ? amount : (value !== undefined ? value : usage_value);
    const finalDate = date || usage_date || new Date();
    const resolvedNotes = notes || "";

    console.log("[UsageController.create] resolved:", { rId, finalAmount, finalDate, resolvedNotes, resource_type });

    // 2. Validate Required Fields
    if (!rId || finalAmount === undefined || finalAmount === null || !finalDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (resourceId, amount, and date are mandatory)"
      });
    }

    const numAmount = Number(finalAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Usage amount must be a positive number"
      });
    }

    // 3. Resolve Resource (ObjectId takes precedence)
    const resource = await Resource.findById(rId);

    if (!resource) {
      return res.status(404).json({
        message: 'Invalid resource selected'
      });
    }

    if (resource.isActive === false || resource.status === "inactive") {
      return res.status(400).json({
        message: 'Resource is inactive'
      });
    }

    const canonicalResourceType = resource.resource || resource.name;
    const finalUnit = resource.unit || 'units';

    // 4. Resolve Block (Warden always uses their own block)
    let blockId = req.body.blockId || req.body.block;
    if (role === 'warden' || role === 'student') {
      const rawBlock = user.block || req.userObj?.block;
      const bId = rawBlock?._id?.toString() || rawBlock?.toString() || null;
      if (bId) blockId = bId;
    }

    if (!blockId) {
      return res.status(400).json({
        success: false,
        message: 'Block assignment is required for usage recording.'
      });
    }

    // Validate block ID format
    let blockObjectId;
    try {
      blockObjectId = new mongoose.Types.ObjectId(blockId.toString());
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid block ID format.'
      });
    }

    // 5. Create Record
    const usageAmount = Number(numAmount || finalAmount);
    const unitCost = resource.costPerUnit || resource.rate || 0;
    const totalCost = usageAmount * unitCost;

    const usage = await Usage.create({
      blockId: blockObjectId,
      resourceId: resource._id, // Ensure resource link exists
      resource_type: canonicalResourceType,
      usage_value: usageAmount,
      unit: finalUnit,
      cost: totalCost,
      usage_date: new Date(finalDate),
      notes: resolvedNotes.trim() || "",
      category,
      createdBy: new mongoose.Types.ObjectId(req.userId.toString()),
      deleted: false
    });

    // Populate for response
    const populated = await Usage
      .findById(usage._id)
      .populate('blockId', 'name location')
      .populate('resourceId')
      .populate('createdBy', 'name role')
      .lean()

    // Emit socket event for real-time sync
    const io = req.app.get('io') ||
      global.io
    if (io) {
      io.emit('usage:added', {
        blockId: blockId.toString(),
        resource_type: canonicalResourceType
      })
      // Broad refresh events for general dashboards (Requirement Part 3)
      io.emit('dashboard:refresh');
      io.emit('usage:refresh');
      io.emit('complaints:refresh');
      io.emit('alerts:refresh');
      // Added per Requirement Part 3
      io.emit('usage:refresh_trends');
      io.emit('analytics:refresh');
    }

    // Trigger threshold check async (Requirement: Fix parameter mismatch)
    const { checkThresholds } = require('../services/thresholdService')
    if (typeof checkThresholds === 'function') {
      try {
        // Pass discrete fields as expected by checkThresholds signature
        await checkThresholds(
          usage.createdBy,
          usage.resource_type,
          usage.usage_date,
          usage.blockId
        );
      } catch (e) {
        console.error('Threshold check failed:', e.message)
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Usage logged successfully',
      data: populated || usage
    })

  } catch (err) {
    console.error('createUsage:', err)
    return res.status(500).json({
      success: false,
      message: err.message ||
        'Failed to create usage'
    })
  }
}


exports.getUsages = async (req, res) => {
  try {
    // Support both old and new query param names
    const start = req.query.startDate || req.query.start;
    const end = req.query.endDate || req.query.end;
    const resource = req.query.resource_type || req.query.resource;
    const blockQry = req.query.blockId || req.query.block;
    const { category, sort, page = 1, limit = 100, dateRange, filters } = req.query;
    const filter = {};

    // Role-based Access Control
    const callerRole = req.user?.role;

    // Check role and assign filters
    if (!callerRole || callerRole === 'user') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    } else if (callerRole === 'student') {
      const rawBlock = req.user?.block || req.userObj?.block;
      const bId = rawBlock?._id?.toString() || rawBlock?.toString();
      const uId = req.userId || req.user?.id;

      filter.$or = [];
      if (uId) filter.$or.push({ userId: new mongoose.Types.ObjectId(uId) });
      if (bId && mongoose.Types.ObjectId.isValid(bId)) {
        filter.$or.push({ blockId: new mongoose.Types.ObjectId(bId) });
      }

      if (filter.$or.length === 0) {
        filter._id = null; // matches nothing
      }
    } else if (callerRole === 'warden') {
      // Step 2 Fix: safe blockId extraction
      const rawBlock = req.user?.block || req.userObj?.block;
      const blockObjId = safeBlockId(rawBlock);

      if (!blockObjId) {
        return res.status(403).json({
          success: false,
          message: 'Warden is not assigned to any block. Contact the administrator.'
        });
      }
      filter.blockId = blockObjId;
    } else if (['dean', 'admin', 'gm', 'principal'].includes(callerRole)) {
      // Admin / GM / Dean / Principal can see everything, or filter by blockId query param
      if (blockQry && mongoose.Types.ObjectId.isValid(blockQry)) {
        filter.blockId = new mongoose.Types.ObjectId(blockQry);
      }
    }

    // Date range filters
    if (start || end) {
      filter.usage_date = {};
      if (start) filter.usage_date.$gte = new Date(start);
      if (end) filter.usage_date.$lte = new Date(new Date(end).setHours(23, 59, 59, 999));
    }
    if (dateRange) {
      const dateFilter = buildDateRangeFilter({ range: dateRange, dateField: 'usage_date' });
      Object.assign(filter, dateFilter);
    }

    // Resource and category filters
    if (resource && resource !== 'All') {
      const isObjectId = mongoose.Types.ObjectId.isValid(resource);
      if (isObjectId) filter.resource = new mongoose.Types.ObjectId(resource);
      else filter.resource_type = resource;
    }
    if (category) filter.category = category;

    // Additional JSON filters
    if (filters) {
      try {
        const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
        Object.assign(filter, parsedFilters);
      } catch (e) {
        console.error('Invalid filters JSON:', e.message);
      }
    }

    // Exclude soft-deleted records
    filter.deleted = { $ne: true };

    // Sort option
    const allowedSortFields = ['usage_date', 'resource_type', 'usage_value', 'blockId', 'createdAt'];
    let sortOption = { usage_date: -1 };

    if (sort) {
      if (sort.includes(':')) {
        sortOption = parseSortParam(sort, allowedSortFields);
      } else if (sort === '-usage_value' || sort === 'highest_consumption') {
        sortOption = { usage_value: -1 };
      } else if (sort === 'usage_value') {
        sortOption = { usage_value: 1 };
      } else if (sort === 'blockId' || sort === 'block_name') {
        sortOption = { blockId: 1, usage_date: -1 };
      } else if (sort === 'usage_date' || sort === 'oldest') {
        sortOption = { usage_date: 1 };
      } else if (sort === '-usage_date' || sort === 'newest') {
        sortOption = { usage_date: -1 };
      }
    }

    // Pagination
    const { skip, limit: pageLimit } = parsePagination({ page, limit });

    const usages = await Usage.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(pageLimit)
      .populate('userId', 'name email role block')
      .populate('createdBy', 'name email role')
      .populate('blockId', 'name location')
      .populate('resourceId', 'resource unit costPerUnit category'); // Corrected field name: resourceId

    const total = await Usage.countDocuments(filter);

    // 5. Build response
    res.json({
      success: true,
      data: usages,
      total,
      page: Number(page),
      pages: Math.ceil(total / pageLimit)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const isAdmin = ['admin', 'warden', 'dean'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: usage })
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
    const isWardenInBlock = user.role === 'warden' && user.block && existingUsage.blockId && String(user.block) === String(existingUsage.blockId);

    // Admin can edit anything; creator can edit their own; warden can edit records in their block
    if (isAdmin || isCreator || isWardenInBlock) {
      // Allowed — proceed to update
    }
    // Student / Dean / Principal / Warden (non-owners, not in block): No write access
    else {
      const roleMsg = {
        'student': 'Students cannot modify usage records. Please contact your Warden.',
        'warden': 'Wardens can only modify usage records in their assigned block.',
        'dean': 'Deans have read-only access. You cannot modify usage records.',
        'dean': 'Principals have read-only access. You cannot modify usage records.'
      };
      return res.status(403).json({
        success: false,
        message: roleMsg[user.role] || 'Access denied'
      });
    }

    // 3. Prevent Wardens from Changing Block Assignment
    if (user.role === 'warden' && req.body.blockId && String(req.body.blockId) !== String(existingUsage.blockId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot change the block assignment of a usage record. The block is locked to your assigned location.'
      });
    }

    // 4. Perform Update
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
      await checkThresholds(req.userId, usage.resource_type, usage.usage_date, usage.blockId);
    } catch (e) {
      console.error('Error re-checking thresholds after update:', e.message);
    }

    // ⭐ CRITICAL FIX: Emit socket event so UI knows to refresh alert counts immediately
    try {
      const socketUtil = require('../utils/socket');
      const io = socketUtil.getIO && socketUtil.getIO();
      if (io) {
        io.emit('alerts:refresh');
        io.emit('dashboard:refresh');
        io.emit('usage:refresh');
      }
    } catch (e) { /* non-fatal */ }

    res.json({ success: true, message: 'Record updated successfully', data: usage })
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

    // 2. Permission Check: ONLY Admin or General Manager can delete usage records.
    //    Wardens are explicitly prohibited — they log records but cannot remove them.
    //    This enforces the operational hierarchy: wardens create, managers archive/delete.
    const user = req.userObj || await User.findById(req.userId);
    const DELETE_ROLES = ['admin', 'gm'];

    if (!DELETE_ROLES.includes(user.role)) {
      const roleMessages = {
        warden: 'Access denied: Wardens cannot delete usage records. Contact the General Manager or Admin to archive records.',
        dean: 'Access denied: Deans have read-only access and cannot delete usage records.',
        principal: 'Access denied: Principals have read-only access and cannot delete usage records.',
        student: 'Access denied: Students cannot delete usage records.',
      };
      return res.status(403).json({
        success: false,
        message: roleMessages[user.role] || 'Access denied: Insufficient permissions to delete usage records.'
      });
    }

    // 3. Soft-delete: mark record as deleted and set metadata
    existingUsage.deleted = true;
    existingUsage.deletedAt = new Date();
    existingUsage.deletedBy = req.userId;
    await existingUsage.save();

    // Re-run threshold checks for the same date/resource to update/remove alerts
    try {
      await checkThresholds(req.userId, existingUsage.resource_type, existingUsage.usage_date, existingUsage.blockId);
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
      if (io) {
        io.emit('alerts:refresh');
        io.emit('dashboard:refresh');
        io.emit('usage:refresh');
      }
    } catch (e) { /* non-fatal */ }

    res.json({ success: true, message: 'Record deleted (soft) successfully', data: existingUsage })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

exports.getDashboardStats = async (req, res) => {
  try {
    const { getUsageSummary } = require('../services/usageService');
    const u = await User.findById(req.userId);

    // Higher-level roles ALWAYS see GLOBAL data
    const role = (req.user?.role || u?.role || '').toLowerCase();
    const isExecutive = ['admin', 'gm', 'dean', 'principal'].includes(role);
    const blockId = isExecutive ? null : (req.user?.block?._id || req.user?.block || u?.block);

    const data = await getUsageSummary({
      role,
      blockId
    });

    const summaryArr = Object.entries(data.summary || {}).map(([name, metrics]) => ({
      resource_type: name,
      resource: name,
      total: metrics.total || 0,
      value: metrics.total || 0,
      unit: metrics.unit || 'units'
    }));

    const responseData = {
      summary: data.summary || {},
      usageSummary: data.summary || {},
      summaryArray: summaryArr,
      grandTotal: data.grandTotal || 0,
      totalUsage: data.grandTotal || 0,
      totalResources: data.resourceCount || 0,
      activeCampusAlerts: data.alertsCount || 0,
      alertsCount: data.alertsCount || 0,
      resourceCount: data.resourceCount || 0
    };

    res.json({
      success: true,
      data: responseData,
      stats: responseData,
      role
    });
  } catch (err) {
    console.error('[UsageCtrl] getDashboardStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @desc    Get daily usage trend data for a specific resource
 * @route   GET /api/usage/trends?resource=Electricity&range=7days
 * @access  Private (all roles)
 */
exports.getUsageTrends = async (req, res) => {
  try {
    const { getUsageTrends } = require('../services/usageService');
    const { range = '7d' } = req.query;
    const role = (req.user.role || '').toLowerCase();
    const isAdmin = ['admin', 'gm', 'dean', 'principal'].includes(role);

    const u = await User.findById(req.userId);
    const blockId = isAdmin ? null : (req.user.block || u?.block);

    const data = await getUsageTrends({
      role,
      blockId,
      range
    });

    res.json({
      success: true,
      data,
      range
    });
  } catch (err) {
    console.error('[UsageCtrl] getUsageTrends error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * @desc    Export usage data as CSV
 * @route   GET /api/usage/export/csv?startDate=&endDate=&resource=&blockId=
 * @access  Private (not students)
 */
exports.exportUsageCSV = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { startDate, endDate, resource, blockId, dateRange } = req.query;
    let filter = { deleted: { $ne: true } };

    // Apply role-based scoping
    if (req.user?.role === 'warden') {
      const user = await User.findById(req.userId);
      if (user?.block) filter.blockId = user.block;
    } else if (blockId && mongoose.Types.ObjectId.isValid(blockId)) {
      filter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    // Apply date range filter
    const dateFilter = buildDateRangeFilter({ startDate, endDate, dateRange, dateField: 'usage_date' });
    Object.assign(filter, dateFilter);

    if (resource && resource !== 'All') {
      filter.resource_type = resource;
    }

    const usages = await Usage.find(filter)
      .sort({ usage_date: -1 })
      .limit(10000)
      .populate('userId', 'name email')
      .populate('blockId', 'name')
      .lean();

    const csv = exportService.generateUsageCSV(usages);
    const fileName = `usage_export_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);

    // Log export action
    try {
      await AuditLog.create({
        action: 'EXPORT',
        resourceType: 'Usage',
        userId: req.userId,
        description: `Exported ${usages.length} usage records as CSV`,
        changes: { filters: { dateRange, resource, blockId } }
      });
    } catch (e) { /* non-critical */ }
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * @desc    Export usage data as PDF
 * @route   GET /api/usage/export/pdf?startDate=&endDate=&resource=&blockId=
 * @access  Private (not students)
 */
exports.exportUsagePDF = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { startDate, endDate, resource, blockId, dateRange } = req.query;
    let filter = { deleted: { $ne: true } };

    // Apply role-based scoping
    if (req.user?.role === 'warden') {
      const user = await User.findById(req.userId);
      if (user?.block) filter.blockId = user.block;
    } else if (blockId && mongoose.Types.ObjectId.isValid(blockId)) {
      filter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    // Apply date range filter
    const dateFilter = buildDateRangeFilter({ startDate, endDate, dateRange, dateField: 'usage_date' });
    Object.assign(filter, dateFilter);

    if (resource && resource !== 'All') {
      filter.resource_type = resource;
    }

    const usages = await Usage.find(filter)
      .sort({ usage_date: -1 })
      .limit(1000) // PDF limit for performance
      .populate('userId', 'name email')
      .populate('blockId', 'name')
      .lean();

    const fileName = `usage_report_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfDoc = exportService.generateUsagePDF({
      title: 'Usage Report',
      data: usages,
      startDate,
      endDate,
      generatedBy: req.user?.name || 'Administrator'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    pdfDoc.pipe(res);
    pdfDoc.end();

    // Log export action
    try {
      await AuditLog.create({
        action: 'EXPORT',
        resourceType: 'Usage',
        userId: req.userId,
        description: `Exported ${usages.length} usage records as PDF`,
        changes: { filters: { dateRange, resource, blockId } }
      });
    } catch (e) { /* non-critical */ }
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * @desc    Get efficiency metrics for usage
 * @route   GET /api/usage/metrics/efficiency?blockId=&startDate=&endDate=
 * @access  Private
 */
exports.getEfficiencyMetrics = async (req, res) => {
  try {
    const { blockId, startDate, endDate } = req.query;

    // Role-based scoping
    let scopedBlockId = blockId;
    if (req.user?.role === 'warden') {
      const user = await User.findById(req.userId);
      scopedBlockId = user?.block;
    }

    const efficiency = await metricsService.calculateEfficiencyScore(
      scopedBlockId ? new mongoose.Types.ObjectId(scopedBlockId) : null,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    const costData = await metricsService.calculateResourceCost(
      scopedBlockId ? new mongoose.Types.ObjectId(scopedBlockId) : null,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    const trend = await metricsService.calculateTrend('daily', scopedBlockId ? new mongoose.Types.ObjectId(scopedBlockId) : null);
    const topResources = await metricsService.getTopConsumingResources(
      scopedBlockId ? new mongoose.Types.ObjectId(scopedBlockId) : null,
      5
    );

    res.json({
      success: true,
      efficiency,
      cost: costData,
      trend,
      topResources,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Efficiency metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * @desc    Get anomalies in usage patterns
 * @route   GET /api/usage/anomalies?blockId=
 * @access  Private (Admin/Warden+)
 */
exports.getAnomalies = async (req, res) => {
  try {
    if (!req.user || !['admin', 'warden', 'gm', 'dean'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { blockId } = req.query;

    // Role-based scoping
    let scopedBlockId = blockId;
    if (req.user?.role === 'warden') {
      const user = await User.findById(req.userId);
      scopedBlockId = user?.block;
    }

    const anomalies = await anomalyService.detectAnomalies(scopedBlockId || null);

    res.json({
      success: true,
      anomalies,
      count: anomalies.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Anomalies detection error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}
