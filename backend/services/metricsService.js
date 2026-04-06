/**
 * services/metricsService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculate efficiency scores, resource costs, trends, and analytics
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Usage = require('../models/Usage');
const SystemConfig = require('../models/ResourceConfig');
const Block = require('../models/Block');
const mongoose = require('mongoose');

/**
 * Calculate overall efficiency score for a block or campus
 * Formula: efficiency = ((limit - usage) / limit) * 100
 * Capped at 0-100 range
 * 
 * @param {ObjectId|string} blockId - Block identifier (optional, campus-wide if null)
 * @param {Date} startDate - Period start
 * @param {Date} endDate - Period end
 * @returns {Promise<number>} Efficiency score 0-100
 */
async function calculateEfficiencyScore(blockId = null, startDate = null, endDate = null) {
  try {
    const start = startDate || new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 30); // Last 30 days
    
    const end = endDate || new Date();
    end.setHours(23, 59, 59, 999);

    const matchFilter = {
      usage_date: { $gte: start, $lte: end },
      deleted: { $ne: true }
    };

    if (blockId) {
      matchFilter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    // Get actual usage by resource
    const usageStats = await Usage.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$resource_type',
          totalUsage: { $sum: '$usage_value' }
        }
      }
    ]);

    // Get thresholds from SystemConfig
    const configs = await SystemConfig.find({ isActive: true });
    const configMap = {};
    configs.forEach(c => {
      configMap[c.resource] = c;
    });

    let totalScore = 0;
    let resourceCount = 0;

    // Calculate score per resource
    usageStats.forEach(stat => {
      const resource = stat._id;
      const usage = stat.totalUsage || 0;
      const config = configMap[resource];

      if (!config) return; // Skip if no config

      // Calculate days in period
      const daysInPeriod = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      // Estimate expected usage based on thresholds
      // Assume threshold is per person per day, multiply by estimated occupancy
      const expectedUsage = (config.dailyThreshold || 0) * daysInPeriod * 50; // Assume 50 people
      
      if (expectedUsage > 0) {
        let efficiency = ((expectedUsage - usage) / expectedUsage) * 100;
        efficiency = Math.max(0, Math.min(100, efficiency)); // Cap 0-100
        totalScore += efficiency;
        resourceCount++;
      }
    });

    return resourceCount > 0 ? Math.round(totalScore / resourceCount) : 100;
  } catch (error) {
    console.error('Error calculating efficiency score:', error.message);
    return 50; // Default middle value on error
  }
}

/**
 * Calculate estimated cost for resource usage
 * 
 * @param {ObjectId|string} blockId - Block identifier (optional)
 * @param {Date} startDate - Period start
 * @param {Date} endDate - Period end
 * @param {string} resourceType - Specific resource (optional)
 * @returns {Promise<Object>} {totalCost, breakdown: [{resource, usage, rate, cost}]}
 */
async function calculateResourceCost(blockId = null, startDate = null, endDate = null, resourceType = null) {
  try {
    const start = startDate || new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 30);
    
    const end = endDate || new Date();
    end.setHours(23, 59, 59, 999);

    const matchFilter = {
      usage_date: { $gte: start, $lte: end },
      deleted: { $ne: true }
    };

    if (blockId) {
      matchFilter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    if (resourceType) {
      matchFilter.resource_type = resourceType;
    }

    // Aggregate usage by resource
    const usageByResource = await Usage.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$resource_type',
          totalUsage: { $sum: '$usage_value' }
        }
      }
    ]);

    // Get cost rates
    const configs = await SystemConfig.find({ isActive: true });
    const rateMap = {};
    configs.forEach(c => {
      rateMap[c.resource] = c.costPerUnit || c.rate || 0;
    });

    let totalCost = 0;
    const breakdown = [];

    usageByResource.forEach(item => {
      const resource = item._id;
      const usage = item.totalUsage || 0;
      const rate = rateMap[resource] || 0;
      const cost = usage * rate;
      totalCost += cost;

      breakdown.push({
        resource,
        usage: Math.round(usage * 100) / 100,
        rate,
        cost: Math.round(cost * 100) / 100
      });
    });

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown,
      period: { start, end }
    };
  } catch (error) {
    console.error('Error calculating resource cost:', error.message);
    return { totalCost: 0, breakdown: [], period: { start: null, end: null } };
  }
}

/**
 * Calculate block comparison metrics
 * Returns efficiency and cost for each block
 * 
 * @param {Date} startDate - Period start
 * @param {Date} endDate - Period end
 * @returns {Promise<Array>} Array of {blockId, blockName, efficiency, totalCost, usageCount}
 */
async function compareBlockMetrics(startDate = null, endDate = null) {
  try {
    const start = startDate || new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 30);
    
    const end = endDate || new Date();
    end.setHours(23, 59, 59, 999);

    const blocks = await Block.find({ status: 'Active' }).lean();
    const results = [];

    for (const block of blocks) {
      const efficiency = await calculateEfficiencyScore(block._id, start, end);
      const costData = await calculateResourceCost(block._id, start, end);
      
      const usageCount = await Usage.countDocuments({
        blockId: block._id,
        usage_date: { $gte: start, $lte: end },
        deleted: { $ne: true }
      });

      results.push({
        blockId: block._id,
        blockName: block.name,
        capacity: block.capacity,
        efficiency,
        totalCost: costData.totalCost,
        usageCount,
        costBreakdown: costData.breakdown
      });
    }

    // Sort by efficiency descending
    return results.sort((a, b) => b.efficiency - a.efficiency);
  } catch (error) {
    console.error('Error comparing block metrics:', error.message);
    return [];
  }
}

/**
 * Calculate usage trend (7-day, 30-day, etc.)
 * Returns arrays of daily totals for charting
 * 
 * @param {string} period - 'daily'|'weekly'|'monthly'
 * @param {ObjectId|string} blockId - Optional block filter
 * @returns {Promise<Array>} [{date, total, resource breakdown}]
 */
async function calculateTrend(period = 'daily', blockId = null) {
  try {
    let groupByFormat, daysBack;

    switch (period) {
      case 'weekly':
        groupByFormat = '%Y-W%V'; // Week of year
        daysBack = 90; // 3 months
        break;
      case 'monthly':
        groupByFormat = '%Y-%m'; // Month
        daysBack = 365; // 1 year
        break;
      case 'daily':
      default:
        groupByFormat = '%Y-%m-%d'; // Day
        daysBack = 30; // 30 days
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - daysBack);

    const matchFilter = {
      usage_date: { $gte: startDate },
      deleted: { $ne: true }
    };

    if (blockId) {
      matchFilter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    const trend = await Usage.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: groupByFormat, date: '$usage_date' } },
            resource: '$resource_type'
          },
          totalUsage: { $sum: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Reorganize data for charting
    const trendMap = {};
    trend.forEach(item => {
      const date = item._id.date;
      if (!trendMap[date]) {
        trendMap[date] = { date, total: 0, byResource: {} };
      }
      trendMap[date].total += item.totalUsage;
      trendMap[date].byResource[item._id.resource] = item.totalUsage;
    });

    return Object.values(trendMap);
  } catch (error) {
    console.error('Error calculating trend:', error.message);
    return [];
  }
}

/**
 * Get highest consuming resources across campus or by block
 * 
 * @param {ObjectId|string} blockId - Optional block filter
 * @param {number} limit - Top N results
 * @returns {Promise<Array>} [{resource, total, count, averagePerDay}]
 */
async function getTopConsumingResources(blockId = null, limit = 10) {
  try {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const matchFilter = {
      usage_date: { $gte: startDate },
      deleted: { $ne: true }
    };

    if (blockId) {
      matchFilter.blockId = new mongoose.Types.ObjectId(blockId);
    }

    const results = await Usage.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$resource_type',
          total: { $sum: '$usage_value' },
          count: { $sum: 1 },
          avg: { $avg: '$usage_value' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: limit }
    ]);

    // Calculate average per day
    const daysBack = 30;
    return results.map(r => ({
      resource: r._id,
      total: Math.round(r.total * 100) / 100,
      count: r.count,
      average: Math.round(r.avg * 100) / 100,
      averagePerDay: Math.round((r.total / daysBack) * 100) / 100
    }));
  } catch (error) {
    console.error('Error getting top consuming resources:', error.message);
    return [];
  }
}

/**
 * Calculate efficiency rank for blocks
 * Returns sorted list with percentile ranks
 * 
 * @returns {Promise<Array>} [{blockId, blockName, efficiency, percentile, rank}]
 */
async function getBlockEfficiencyRankings() {
  try {
    const metrics = await compareBlockMetrics();
    
    if (metrics.length === 0) return [];

    // Calculate percentiles
    const sorted = metrics.sort((a, b) => b.efficiency - a.efficiency);
    
    return sorted.map((block, index) => ({
      ...block,
      rank: index + 1,
      percentile: Math.round(((sorted.length - index) / sorted.length) * 100)
    }));
  } catch (error) {
    console.error('Error calculating block rankings:', error.message);
    return [];
  }
}

module.exports = {
  calculateEfficiencyScore,
  calculateResourceCost,
  compareBlockMetrics,
  calculateTrend,
  getTopConsumingResources,
  getBlockEfficiencyRankings
};
