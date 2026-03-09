const Usage = require('../models/Usage');
const SystemConfig = require('../models/SystemConfig');
const Block = require('../models/Block');
const { ROLES } = require('../config/roles');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

/**
 * @desc    Generate CSV export of usage data
 * @route   GET /api/reports/export/csv?resource=&blockId=&start=&end=
 * @access  Private (Not for students)
 */
exports.exportCSV = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { resource, blockId, start, end } = req.query;

    let filter = {};

    // Role-based filtering
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user.block) filter.blockId = user.block;
    }

    // Apply query filters
    if (resource) filter.resource_type = resource;
    if (blockId) filter.blockId = blockId;

    if (start || end) {
      filter.usage_date = {};
      if (start) filter.usage_date.$gte = new Date(start);
      if (end) filter.usage_date.$lte = new Date(end);
    }

    // Exclude soft-deleted records
    filter.deleted = { $ne: true };
    const usages = await Usage.find(filter)
      .sort({ usage_date: -1 })
      .populate('userId', 'name email')
      .populate('blockId', 'name')
      .limit(10000);

    // Build CSV
    const headers = ['Date', 'Resource', 'Category', 'Value', 'Unit', 'Block', 'User', 'Notes'];
    const rows = usages.map(u => [
      new Date(u.usage_date).toISOString().split('T')[0],
      u.resource_type,
      u.category || '',
      u.usage_value,
      u.unit || '',
      u.blockId?.name || '',
      u.userId?.name || '',
      (u.notes || '').replace(/,/g, ';') // Escape commas
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=usage_report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Calculate monthly bill estimate
 * @route   GET /api/reports/bill-estimate?blockId=&month=&year=
 * @access  Private (Not for students)
 */
exports.getBillEstimate = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { blockId, month, year } = req.query;

    // Default to current month/year
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Calculate date range
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    let filter = {
      usage_date: { $gte: startDate, $lte: endDate }
    };

    // Role-based filtering
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user.block) filter.blockId = new mongoose.Types.ObjectId(user.block);
    } else if (blockId) {
      filter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    // Aggregate usage by resource
    // Exclude soft-deleted records
    filter.deleted = { $ne: true };
    const usageByResource = await Usage.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$resource_type',
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get cost rates from SystemConfig
    const configs = await SystemConfig.find({});
    const rateMap = {};
    configs.forEach(c => {
      rateMap[c.resource] = c.rate || 0;
    });

    // Calculate costs
    let totalCost = 0;
    const breakdown = usageByResource.map(item => {
      const rate = rateMap[item._id] || 0;
      const cost = item.totalUsage * rate;
      totalCost += cost;

      return {
        resource: item._id,
        usage: Math.round(item.totalUsage * 100) / 100,
        rate,
        cost: Math.round(cost * 100) / 100,
        recordCount: item.count
      };
    });

    // Get block details if applicable
    let blockDetails = null;
    if (blockId) {
      const block = await Block.findById(blockId);
      if (block) {
        blockDetails = {
          id: block._id,
          name: block.name,
          capacity: block.capacity
        };
      }
    }

    res.json({
      success: true,
      period: {
        month: targetMonth,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
      },
      block: blockDetails,
      breakdown,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: '₹'
    });
  } catch (error) {
    console.error('Bill estimate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Compare usage across blocks
 * @route   GET /api/reports/comparison?resource=&month=&year=
 * @access  Private (Admin, Dean, Principal)
 */
exports.getBlockComparison = async (req, res) => {
  try {
    if (![ROLES.ADMIN, ROLES.DEAN].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { resource, month, year } = req.query;

    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    let matchFilter = {
      usage_date: { $gte: startDate, $lte: endDate }
    };

    if (resource) {
      matchFilter.resource_type = resource;
    }

    // Ensure blockId in matchFilter is handled correctly if it existed, 
    // but here we are grouping by blockId anyway.
    // If there were a blockId filter, we'd cast it.

    // Aggregate by block
    const blockUsage = await Usage.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { block: '$blockId', resource: '$resource_type' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalUsage: -1 } }
    ]);

    // Populate block names
    const blockIds = [...new Set(blockUsage.map(b => b._id.block).filter(Boolean))];
    const blocks = await Block.find({ _id: { $in: blockIds } });
    const blockMap = {};
    blocks.forEach(b => blockMap[b._id] = b.name);

    // Format results
    const comparison = blockUsage.map(item => ({
      block: blockMap[item._id.block] || 'Unknown',
      blockId: item._id.block,
      resource: item._id.resource,
      usage: Math.round(item.totalUsage * 100) / 100,
      recordCount: item.count
    }));

    // Group by resource if no specific resource requested
    const byResource = {};
    comparison.forEach(item => {
      if (!byResource[item.resource]) {
        byResource[item.resource] = [];
      }
      byResource[item.resource].push(item);
    });

    res.json({
      success: true,
      period: {
        month: targetMonth,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
      },
      comparison,
      byResource
    });
  } catch (error) {
    console.error('Block comparison error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get historical trends for a resource
 * @route   GET /api/reports/trends?resource=&months=6&blockId=
 * @access  Private (Not for students)
 */
exports.getHistoricalTrends = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { resource, months = 6, blockId } = req.query;
    const monthsInt = parseInt(months);

    if (!resource) {
      return res.status(400).json({
        success: false,
        error: 'Resource parameter is required'
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsInt);

    let filter = {
      resource_type: resource,
      usage_date: { $gte: startDate, $lte: endDate }
    };

    // Role-based filtering
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user.block) filter.blockId = new mongoose.Types.ObjectId(user.block);
    } else if (blockId) {
      filter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    // Aggregate by month
    const trends = await Usage.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$usage_date' },
            month: { $month: '$usage_date' }
          },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 },
          avgUsage: { $avg: '$usage_value' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format results
    const formattedTrends = trends.map(t => ({
      year: t._id.year,
      month: t._id.month,
      monthName: new Date(t._id.year, t._id.month - 1).toLocaleString('default', { month: 'short' }),
      label: `${new Date(t._id.year, t._id.month - 1).toLocaleString('default', { month: 'short' })} ${t._id.year}`,
      usage: Math.round(t.totalUsage * 100) / 100,
      average: Math.round(t.avgUsage * 100) / 100,
      recordCount: t.count
    }));

    res.json({
      success: true,
      resource,
      period: `Last ${monthsInt} months`,
      trends: formattedTrends
    });
  } catch (error) {
    console.error('Historical trends error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;

/**
 * @desc    Summary insights for a date range
 * @route   GET /api/reports/summary?start=&end=
 * @access  Private (Not for students)
 */
exports.getSummary = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const Alert = require('../models/Alert');
    const Complaint = require('../models/Complaint');

    const { start, end } = req.query;
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Previous equivalent period for % change
    const periodLen = endDate - startDate;
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLen);

    // Base filter
    let scopeFilter = {};
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id).lean();
      if (user?.block) scopeFilter.blockId = user.block;
    }

    // Usage aggregation — current period
    const currentUsage = await Usage.aggregate([
      { $match: { ...scopeFilter, usage_date: { $gte: startDate, $lte: endDate }, deleted: { $ne: true } } },
      { $group: { _id: { block: '$blockId', resource: '$resource_type' }, total: { $sum: '$usage_value' } } },
      { $sort: { total: -1 } },
    ]);

    // Usage aggregation — previous period (for % change)
    const prevUsage = await Usage.aggregate([
      { $match: { ...scopeFilter, usage_date: { $gte: prevStart, $lte: prevEnd }, deleted: { $ne: true } } },
      { $group: { _id: { block: '$blockId', resource: '$resource_type' }, total: { $sum: '$usage_value' } } },
    ]);

    // Build a lookup map: "blockId:resource" -> total
    const prevMap = {};
    prevUsage.forEach(p => {
      prevMap[`${p._id.block}:${p._id.resource}`] = p.total;
    });

    // Populate block names
    const blockIds = [...new Set(currentUsage.map(u => u._id.block).filter(Boolean))];
    const blocks = await Block.find({ _id: { $in: blockIds } }).select('name').lean();
    const blockNameMap = {};
    blocks.forEach(b => { blockNameMap[b._id.toString()] = b.name; });

    // Enrich with % change and block names
    const usageByResourceBlock = currentUsage.map(item => {
      const key = `${item._id.block}:${item._id.resource}`;
      const prev = prevMap[key] || 0;
      const pctChange = prev > 0 ? Math.round(((item.total - prev) / prev) * 100) : null;
      return {
        blockId: item._id.block,
        blockName: blockNameMap[item._id.block?.toString()] || 'Unknown',
        resource: item._id.resource,
        total: Math.round(item.total * 100) / 100,
        prevTotal: Math.round(prev * 100) / 100,
        pctChange,
        improved: pctChange !== null ? pctChange < 0 : null,
      };
    });

    // Top 3 blocks per resource
    const byResource = {};
    usageByResourceBlock.forEach(item => {
      if (!byResource[item.resource]) byResource[item.resource] = [];
      byResource[item.resource].push(item);
    });
    const top3ByResource = {};
    Object.keys(byResource).forEach(r => {
      top3ByResource[r] = byResource[r].slice(0, 3); // already sorted desc
    });

    // % change by resource (summed across all blocks)
    const resourceTotals = {};
    const prevResourceTotals = {};
    usageByResourceBlock.forEach(item => {
      resourceTotals[item.resource] = (resourceTotals[item.resource] || 0) + item.total;
      prevResourceTotals[item.resource] = (prevResourceTotals[item.resource] || 0) + item.prevTotal;
    });
    const resourceChanges = Object.keys(resourceTotals).map(r => ({
      resource: r,
      total: Math.round(resourceTotals[r] * 100) / 100,
      prevTotal: Math.round(prevResourceTotals[r] * 100) / 100,
      pctChange: prevResourceTotals[r] > 0
        ? Math.round(((resourceTotals[r] - prevResourceTotals[r]) / prevResourceTotals[r]) * 100)
        : null,
      improved: prevResourceTotals[r] > 0 ? resourceTotals[r] < prevResourceTotals[r] : null,
    }));

    // Alert counts by severity in the period
    const alertsBySeverity = await Alert.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $project: { _id: 0, severity: '$_id', count: 1 } },
    ]);

    // Complaint stats
    const [totalComplaints, resolvedComplaints] = await Promise.all([
      Complaint.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Complaint.countDocuments({ status: 'resolved', updatedAt: { $gte: startDate, $lte: endDate } }),
    ]);

    return res.json({
      success: true,
      period: { start: startDate, end: endDate },
      previousPeriod: { start: prevStart, end: prevEnd },
      resourceChanges,
      top3ByResource,
      usageByResourceBlock,
      alertsBySeverity,
      complaints: { total: totalComplaints, resolved: resolvedComplaints },
    });
  } catch (error) {
    console.error('[Reports] getSummary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Block efficiency scores for a date range
 * @route   GET /api/reports/efficiency?start=&end=
 * @access  Private (Not for students)
 *
 * Efficiency score per block per resource:
 *   score = max(0, 100 - (actual / limit) * 100)
 *   Lower usage relative to limit → higher score (more efficient)
 * Blocks that exceeded limit on more than 3 days are flagged.
 */
exports.getEfficiency = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { start, end } = req.query;
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    let scopeFilter = {};
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id).lean();
      if (user?.block) scopeFilter.blockId = user.block;
    }

    // Get all resource configs for limits
    const configs = await SystemConfig.find({}).lean();
    const limitMap = {};
    configs.forEach(c => {
      limitMap[c.resource] = c.dailyLimitPerPerson || c.monthlyLimitPerPerson || null;
    });

    // Aggregate daily usage per block per resource
    const dailyUsage = await Usage.aggregate([
      {
        $match: {
          ...scopeFilter,
          usage_date: { $gte: startDate, $lte: endDate },
          deleted: { $ne: true },
        }
      },
      {
        $group: {
          _id: {
            block: '$blockId',
            resource: '$resource_type',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$usage_date' } }
          },
          dailyTotal: { $sum: '$usage_value' },
        }
      },
    ]);

    // Group by block+resource to compute efficiency
    const blockResourceMap = {};
    dailyUsage.forEach(d => {
      const key = `${d._id.block}:${d._id.resource}`;
      if (!blockResourceMap[key]) {
        blockResourceMap[key] = { blockId: d._id.block, resource: d._id.resource, days: [] };
      }
      blockResourceMap[key].days.push(d.dailyTotal);
    });

    // Populate block names
    const blockIds = [...new Set(Object.values(blockResourceMap).map(v => v.blockId).filter(Boolean))];
    const blocks = await Block.find({ _id: { $in: blockIds } }).select('name').lean();
    const blockNameMap = {};
    blocks.forEach(b => { blockNameMap[b._id.toString()] = b.name; });

    // Calculate efficiency scores
    const scores = Object.values(blockResourceMap).map(item => {
      const limit = limitMap[item.resource];
      const avgDailyUsage = item.days.reduce((s, v) => s + v, 0) / item.days.length;
      let score = 100; // default if no limit configured
      let daysExceeded = 0;

      if (limit && limit > 0) {
        score = Math.max(0, Math.round(100 - (avgDailyUsage / limit) * 100));
        daysExceeded = item.days.filter(d => d > limit).length;
      }

      return {
        blockId: item.blockId,
        blockName: blockNameMap[item.blockId?.toString()] || 'Unknown',
        resource: item.resource,
        avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
        limit: limit || null,
        score,
        daysExceeded,
        flagged: daysExceeded > 3,
        rating: score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red',
      };
    });

    // Sort: most efficient first
    scores.sort((a, b) => b.score - a.score);

    return res.json({
      success: true,
      period: { start: startDate, end: endDate },
      scores,
    });
  } catch (error) {
    console.error('[Reports] getEfficiency error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Generate simple PDF export of usage data (table-like)
 * @route   GET /api/reports/export/pdf?resource=&blockId=&start=&end=
 * @access  Private (Not for students)
 */
exports.exportPDF = async (req, res) => {
  try {
    if (req.user.role === ROLES.STUDENT) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { resource, blockId, start, end } = req.query;

    let filter = {};
    if (req.user.role === ROLES.WARDEN) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user.block) filter.blockId = user.block;
    }

    if (resource) filter.resource_type = resource;
    if (blockId) filter.blockId = blockId;
    if (start || end) {
      filter.usage_date = {};
      if (start) filter.usage_date.$gte = new Date(start);
      if (end) filter.usage_date.$lte = new Date(end);
    }

    // Exclude soft-deleted records
    filter.deleted = { $ne: true };

    const usages = await Usage.find(filter).sort({ usage_date: -1 }).limit(10000)
      .populate('userId', 'name email')
      .populate('blockId', 'name')
      .lean();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=usage_report_${new Date().toISOString().split('T')[0]}.pdf`);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    // Some test environments (unit/QA harnesses) pass a simplified `res` stub
    // that is not a full stream and does not implement `.on`. Detect this
    // and fall back to buffering the PDF into memory, otherwise pipe
    // directly to the response stream for low-memory streaming.
    const { PassThrough } = require('stream');
    const isStreamLike = typeof res.write === 'function' && typeof res.on === 'function';

    let bufferChunks = null;
    if (isStreamLike) {
      doc.pipe(res);
    } else {
      // Buffer into memory and send when finished (safe for QA/testing)
      bufferChunks = [];
      const pt = new PassThrough();
      pt.on('data', (c) => bufferChunks.push(c));
      pt.on('end', () => {
        try {
          const pdfBuf = Buffer.concat(bufferChunks);
          // If the stub provides `send`, use it; otherwise try `res.write` + `res.end`.
          if (typeof res.send === 'function') {
            res.setHeader && res.setHeader('Content-Type', 'application/pdf');
            res.setHeader && res.setHeader('Content-Disposition', `attachment; filename=usage_report_${new Date().toISOString().split('T')[0]}.pdf`);
            return res.send(pdfBuf);
          } else if (typeof res.write === 'function') {
            res.write(pdfBuf);
            return res.end && res.end();
          }
        } catch (e) {
          console.error('PDF buffer send error:', e);
        }
      });
      doc.pipe(pt);
    }

    doc.fontSize(14).text('Usage Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10);

    const tableTop = doc.y + 10;
    const rowHeight = 18;
    const colWidths = [80, 80, 60, 60, 60, 80, 80, 80];
    const headers = ['Date', 'Resource', 'Category', 'Value', 'Unit', 'Block', 'User', 'Notes'];

    // Draw header
    let x = doc.x;
    headers.forEach((h, i) => {
      doc.text(h, x, tableTop, { width: colWidths[i], continued: false, ellipsis: true });
      x += colWidths[i];
    });

    let y = tableTop + rowHeight;
    for (const u of usages) {
      x = doc.x;
      const row = [new Date(u.usage_date).toISOString().split('T')[0], u.resource_type, u.category || '', String(u.usage_value), u.unit || '', u.blockId?.name || '', u.userId?.name || '', (u.notes || '')];
      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i], continued: false, ellipsis: true });
        x += colWidths[i];
      });
      y += rowHeight;
      if (y > doc.page.height - 50) { doc.addPage(); y = doc.y; }
    }

    // Finalize PDF and end the stream
    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    Generate professional management PDF report
 * @route   GET /api/reports/management-summary?month=&year=
 * @access  Private (Admin, GM, Dean only)
 */
exports.getManagementReport = async (req, res) => {
  try {
    // Role check
    if (!['admin', 'gm', 'dean'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin, GM, and Dean can access this report.'
      });
    }

    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

    // Calculate month range
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const lastMonthStart = new Date(year, month - 2, 1);
    const lastMonthEnd = new Date(year, month - 1, 0);

    // Fetch all required data
    const [
      currentUsages,
      lastMonthUsages,
      alerts,
      allAlerts,
      complaints,
      allComplaints,
      blocks,
      configs
    ] = await Promise.all([
      Usage.find({
        usage_date: { $gte: monthStart, $lte: monthEnd },
        deleted: false
      }).populate('blockId', 'name'),
      Usage.find({
        usage_date: { $gte: lastMonthStart, $lte: lastMonthEnd },
        deleted: false
      }),
      require('../models/Alert').find({
        status: 'active',
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }),
      require('../models/Alert').find({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }),
      require('../models/Complaint').find({
        status: 'resolved',
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }),
      require('../models/Complaint').find({
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }),
      Block.find().select('name'),
      SystemConfig.find({ isActive: true })
    ]);

    // Calculate metrics
    const totalUsageCost = currentUsages.reduce((sum, u) => sum + (u.cost || 0), 0);
    const lastMonthCost = lastMonthUsages.reduce((sum, u) => sum + (u.cost || 0), 0);
    const costChangePercent = lastMonthCost > 0
      ? ((totalUsageCost - lastMonthCost) / lastMonthCost * 100).toFixed(1)
      : 0;

    const resolvedComplaints = complaints.length;
    const totalComplaints = allComplaints.length;
    const complaintResolutionRate = totalComplaints > 0
      ? ((resolvedComplaints / totalComplaints) * 100).toFixed(1)
      : 0;

    // Calculate average resolution time
    let totalResolutionTime = 0;
    complaints.forEach(c => {
      if (c.resolvedAt && c.createdAt) {
        totalResolutionTime += (c.resolvedAt - c.createdAt);
      }
    });
    const avgResolutionDays = resolvedComplaints > 0
      ? Math.round(totalResolutionTime / resolvedComplaints / (1000 * 60 * 60 * 24))
      : 0;

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=management_report_${year}_${String(month).padStart(2, '0')}.pdf`);
    doc.pipe(res);

    // Title and header
    doc.fontSize(20).font('Helvetica-Bold').text('EcoMonitor - Performance Report', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Monthly Report: ${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown();

    // Executive Summary
    doc.fontSize(14).font('Helvetica-Bold').text('EXECUTIVE SUMMARY', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Resource Cost: ₹${totalUsageCost.toFixed(2)}`, { indent: 20 });
    doc.text(`Cost Change vs Last Month: ${costChangePercent > 0 ? '+' : ''}${costChangePercent}%`, { indent: 20 });
    doc.text(`Active Alerts: ${alerts.length}`, { indent: 20 });
    doc.text(`Complaints Resolved: ${resolvedComplaints}/${totalComplaints} (${complaintResolutionRate}%)`, { indent: 20 });
    doc.text(`Avg Resolution Time: ${avgResolutionDays} days`, { indent: 20 });
    doc.moveDown();

    // Block-wise Summary Table
    doc.fontSize(14).font('Helvetica-Bold').text('BLOCK-WISE SUMMARY', { underline: true });
    doc.moveDown(0.5);

    // Prepare block data
    const blockStats = blocks.map(block => {
      const blockUsages = currentUsages.filter(u => u.blockId._id.toString() === block._id.toString());
      const blockCost = blockUsages.reduce((sum, u) => sum + (u.cost || 0), 0);
      const blockUsage = blockUsages.reduce((sum, u) => sum + u.usage_value, 0);
      return {
        name: block.name,
        usage: blockUsage.toFixed(1),
        cost: blockCost.toFixed(2)
      };
    });

    // Simple table for blocks
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Block', 40, { width: 100 });
    doc.text('Usage', 150, { width: 80 });
    doc.text('Cost (₹)', 230, { width: 80 });
    doc.moveTo(40, doc.y).lineTo(400, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(9);
    blockStats.forEach(stat => {
      doc.text(stat.name, 40, { width: 100 });
      doc.text(stat.usage, 150, { width: 80 });
      doc.text(stat.cost, 230, { width: 80 });
      doc.moveDown(0.3);
    });

    doc.moveDown();

    // Alert Summary
    doc.fontSize(14).font('Helvetica-Bold').text('ALERTS SUMMARY', { underline: true });
    doc.fontSize(11).font('Helvetica');
    const alertBySeverity = {};
    allAlerts.forEach(a => {
      alertBySeverity[a.severity] = (alertBySeverity[a.severity] || 0) + 1;
    });
    Object.entries(alertBySeverity).forEach(([severity, count]) => {
      doc.text(`${severity}: ${count}`, { indent: 20 });
    });
    doc.moveDown();

    // Recommendations
    doc.fontSize(14).font('Helvetica-Bold').text('RECOMMENDATIONS', { underline: true });
    doc.fontSize(11).font('Helvetica');
    
    const recommendations = [];
    if (costChangePercent > 10) {
      recommendations.push('• Resource costs increased significantly. Review usage patterns for anomalies.');
    }
    if (costChangePercent < -10) {
      recommendations.push('• Resource costs decreased. Analyze factors contributing to savings.');
    }
    if (alerts.length > 5) {
      recommendations.push('• High number of active alerts. Prioritize investigation and mitigation.');
    }
    if (complaintResolutionRate < 80) {
      recommendations.push('• Complaint resolution rate below target. Review complaint handling process.');
    }
    recommendations.push('• Continue monitoring resource usage trends.');

    recommendations.forEach(rec => {
      doc.text(rec, { align: 'left' });
    });

    doc.end();
  } catch (error) {
    console.error('Management report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
