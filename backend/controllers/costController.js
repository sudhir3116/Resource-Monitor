const Usage = require('../models/Usage');
const SystemConfig = require('../models/Resource');
const Block = require('../models/Block');
const mongoose = require('mongoose');

/**
 * GET /api/costs/summary
 * Returns cost statistics for the current month
 * Protected: Admin, GM, Dean
 */
exports.getCostSummary = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get costs for current month
    const currentMonthCosts = await Usage.aggregate([
      {
        $match: {
          usage_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
          deleted: false
        }
      },
      {
        $group: {
          _id: {
            block: '$blockId',
            resource: '$resource_type'
          },
          totalCost: { $sum: '$cost' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get block-wise cost summary
    const blockCosts = await Usage.aggregate([
      {
        $match: {
          usage_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
          deleted: false,
          blockId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$blockId',
          totalCost: { $sum: '$cost' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'blocks',
          localField: '_id',
          foreignField: '_id',
          as: 'blockInfo'
        }
      },
      {
        $unwind: { path: '$blockInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $sort: { totalCost: -1 }
      }
    ]);

    // Get resource-wise cost summary
    const resourceCosts = await Usage.aggregate([
      {
        $match: {
          usage_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
          deleted: false
        }
      },
      {
        $group: {
          _id: '$resource_type',
          totalCost: { $sum: '$cost' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalCost: -1 }
      }
    ]);

    // Calculate totals
    const totalCost = blockCosts.reduce((sum, b) => sum + b.totalCost, 0);

    // Get last month costs for comparison
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonthTotalCost = await Usage.aggregate([
      {
        $match: {
          usage_date: { $gte: lastMonthStart, $lte: lastMonthEnd },
          deleted: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$cost' }
        }
      }
    ]);

    const lastMonthCost = lastMonthTotalCost[0]?.total || 0;
    const costChange = lastMonthCost > 0 
      ? ((totalCost - lastMonthCost) / lastMonthCost * 100).toFixed(2)
      : 0;
    const costChangeDirection = costChange >= 0 ? 'up' : 'down';

    // Find most expensive block
    const mostExpensiveBlock = blockCosts.length > 0 ? blockCosts[0] : null;

    res.json({
      success: true,
      data: {
        summary: {
          totalCost,
          totalCostLastMonth: lastMonthCost,
          costChange: parseFloat(costChange),
          costChangeDirection,
          currency: '₹'
        },
        blockCosts: blockCosts.map(b => ({
          blockId: b._id,
          blockName: b.blockInfo?.name || 'Unknown',
          totalCost: b.totalCost,
          totalUsage: b.totalUsage,
          count: b.count
        })),
        resourceCosts: resourceCosts.map(r => ({
          resource: r._id,
          totalCost: r.totalCost,
          totalUsage: r.totalUsage,
          count: r.count
        })),
        mostExpensiveBlock: mostExpensiveBlock ? {
          blockId: mostExpensiveBlock._id,
          blockName: mostExpensiveBlock.blockInfo?.name || 'Unknown',
          totalCost: mostExpensiveBlock.totalCost
        } : null
      }
    });
  } catch (err) {
    console.error('Error fetching cost summary:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/costs/block/:blockId
 * Returns cost breakdown for a specific block for a date range
 * Query params: startDate, endDate, resource
 */
exports.getBlockCosts = async (req, res) => {
  try {
    const { blockId } = req.params;
    const { startDate, endDate, resource } = req.query;

    if (!mongoose.Types.ObjectId.isValid(blockId)) {
      return res.status(400).json({ success: false, message: 'Invalid block ID' });
    }

    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const match = {
      blockId: new mongoose.Types.ObjectId(blockId),
      usage_date: { $gte: start, $lte: end },
      deleted: false
    };

    if (resource) {
      match.resource_type = resource;
    }

    // Get daily cost breakdown
    const dailyCosts = await Usage.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$usage_date' }
            },
            resource: '$resource_type'
          },
          totalCost: { $sum: '$cost' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': -1 }
      }
    ]);

    // Get resource-wise summary for this block
    const resourceSummary = await Usage.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$resource_type',
          totalCost: { $sum: '$cost' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalCost: -1 }
      }
    ]);

    const blockInfo = await Block.findById(blockId).select('name');
    const totalCost = resourceSummary.reduce((sum, r) => sum + r.totalCost, 0);

    res.json({
      success: true,
      data: {
        block: {
          id: blockId,
          name: blockInfo?.name || 'Unknown'
        },
        period: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        totalCost,
        currency: '₹',
        dailyCosts,
        resourceSummary: resourceSummary.map(r => ({
          resource: r._id,
          totalCost: r.totalCost,
          totalUsage: r.totalUsage,
          count: r.count
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching block costs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/costs/resource/:resourceType
 * Returns cost data for a specific resource type across all blocks
 */
exports.getResourceCosts = async (req, res) => {
  try {
    const { resourceType } = req.params;
    const { startDate, endDate } = req.query;

    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const costs = await Usage.aggregate([
      {
        $match: {
          resource_type: resourceType,
          usage_date: { $gte: start, $lte: end },
          deleted: false
        }
      },
      {
        $group: {
          _id: '$blockId',
          totalCost: { $sum: '$cost' },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'blocks',
          localField: '_id',
          foreignField: '_id',
          as: 'blockInfo'
        }
      },
      {
        $unwind: { path: '$blockInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $sort: { totalCost: -1 }
      }
    ]);

    const totalCost = costs.reduce((sum, c) => sum + c.totalCost, 0);

    res.json({
      success: true,
      data: {
        resource: resourceType,
        period: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        totalCost,
        currency: '₹',
        blockWiseCosts: costs.map(c => ({
          blockId: c._id,
          blockName: c.blockInfo?.name || 'Unknown',
          totalCost: c.totalCost,
          totalUsage: c.totalUsage,
          count: c.count
        }))
      }
    });
  } catch (err) {
    console.error('Error fetching resource costs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
