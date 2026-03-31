const DailyReport = require('../models/DailyReport');
const Block = require('../models/Block');
const User = require('../models/User');
const SystemConfig = require('../models/Resource');
const mongoose = require('mongoose');

/**
 * POST /api/daily-reports
 * Submit a daily report (Wardens only)
 */
exports.createDailyReport = async (req, res) => {
  try {
    const user = req.user;
    const {
      blockId,
      resourceCheck,
      issues,
      studentsPresent,
      maintenanceDone,
      overallStatus
    } = req.body;

    // Validate user is a warden
    if (user.role !== 'warden') {
      return res.status(403).json({ success: false, message: 'Only wardens can submit daily reports' });
    }

    // Validate block ID
    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return res.status(400).json({ success: false, message: 'Valid block ID is required' });
    }

    // Warden must be assigned to this block
    if (user.block.toString() !== blockId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only submit reports for your assigned block' });
    }

    // Check if report already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingReport = await DailyReport.findOne({
      warden: user.id,
      block: blockId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a report for today',
        data: existingReport
      });
    }

    // Create new report
    const report = new DailyReport({
      warden: user.id,
      block: blockId,
      date: today,
      resourceCheck: resourceCheck || [],
      issues: issues || '',
      studentsPresent: studentsPresent || 0,
      maintenanceDone: maintenanceDone || '',
      overallStatus: overallStatus || 'NORMAL',
      submittedAt: new Date()
    });

    await report.save();
    await report.populate('warden', 'name email');
    await report.populate('block', 'name');

    // Emit socket event to notify admins
    try {
      const socketUtil = require('../utils/socket');
      const socketManager = require('../socket/socketManager');
      const io = socketUtil.getIO && socketUtil.getIO();
      if (io) {
        socketManager.emitToRole(io, 'admin', 'dailyReport:submitted', {
          blockName: report.block?.name,
          wardenName: report.warden?.name,
          status: report.overallStatus
        });
      }
    } catch (e) { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: 'Daily report submitted successfully',
      data: report
    });
  } catch (err) {
    console.error('Error creating daily report:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/daily-reports
 * Get daily reports - Wardens see own reports, Admins see all
 */
exports.getDailyReports = async (req, res) => {
  try {
    const user = req.user;
    const { blockId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = {};

    // Role-based filtering
    if (user.role === 'warden') {
      // Wardens see only their own reports
      filter.warden = user.id;
      // Optionally filter by their assigned block
      if (user.block) {
        filter.block = user.block;
      }
    } else if (user.role === 'admin' || user.role === 'gm') {
      // Admins see all reports
      if (blockId && mongoose.Types.ObjectId.isValid(blockId)) {
        filter.block = blockId;
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Date filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Pagination
    const skip = (page - 1) * limit;
    const reports = await DailyReport.find(filter)
      .populate('warden', 'name email')
      .populate('block', 'name')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DailyReport.countDocuments(filter);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching daily reports:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/daily-reports/:id
 * Get single report details
 */
exports.getDailyReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }

    const report = await DailyReport.findById(id)
      .populate('warden', 'name email')
      .populate('block', 'name')
      .populate('reviewedBy', 'name email');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    console.error('Error fetching daily report:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/daily-reports/:id/review
 * Add admin review to report
 */
exports.reviewDailyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { adminNotes } = req.body;

    // Only admin can review
    if (user.role !== 'admin' && user.role !== 'gm') {
      return res.status(403).json({ success: false, message: 'Only admins can review reports' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID' });
    }

    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Update review fields
    report.reviewedBy = user.id;
    report.reviewedAt = new Date();
    if (adminNotes) {
      report.adminNotes = adminNotes;
    }

    await report.save();
    await report.populate('warden', 'name email');
    await report.populate('block', 'name');
    await report.populate('reviewedBy', 'name email');

    res.json({
      success: true,
      message: 'Report reviewed successfully',
      data: report
    });
  } catch (err) {
    console.error('Error reviewing report:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/daily-reports/today/check
 * Check if warden has submitted report today
 */
exports.checkTodayReport = async (req, res) => {
  try {
    const user = req.user;

    if (user.role !== 'warden') {
      return res.status(403).json({ success: false, message: 'Only wardens can check daily reports' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const report = await DailyReport.findOne({
      warden: user.id,
      date: { $gte: today, $lt: tomorrow }
    });

    res.json({
      success: true,
      data: {
        submitted: !!report,
        report: report || null
      }
    });
  } catch (err) {
    console.error('Error checking today report:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
