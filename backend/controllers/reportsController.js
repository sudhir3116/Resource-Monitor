const Usage = require('../models/Usage');
const SystemConfig = require('../models/SystemConfig');
const Block = require('../models/Block');
const { ROLES } = require('../config/roles');
const mongoose = require('mongoose');

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
    if (![ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL].includes(req.user.role)) {
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
