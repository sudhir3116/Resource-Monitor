const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Complaint = require('../models/Complaint');
const Block = require('../models/Block');
const SystemConfig = require('../models/SystemConfig');
const mongoose = require('mongoose');

/**
 * GET /api/dean/summary
 * Returns comprehensive summary data for dean/principal dashboard
 * Combines: costs, alerts, complaints, efficiency scores
 */
exports.getDeanSummary = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch all required data in parallel
    const [
      currentMonthUsages,
      lastMonthUsages,
      activeAlerts,
      allAlerts,
      currentComplaints,
      lastMonthComplaints,
      blocks,
      configs
    ] = await Promise.all([
      // Current month usage
      Usage.aggregate([
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
            totalUsage: { $sum: '$usage_value' },
            totalCost: { $sum: '$cost' }
          }
        }
      ]),
      // Last month usage for comparison
      Usage.aggregate([
        {
          $match: {
            usage_date: { $gte: lastMonthStart, $lte: lastMonthEnd },
            deleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$cost' }
          }
        }
      ]),
      // Active alerts
      Alert.find({ status: 'active' }).limit(100),
      // All alerts (for summary)
      Alert.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart }
          }
        },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]),
      // Current month resolved complaints
      Complaint.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart },
            status: 'resolved'
          }
        },
        {
          $count: 'count'
        }
      ]),
      // Last month complaints
      Complaint.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
          }
        },
        {
          $count: 'count'
        }
      ]),
      // Get all blocks
      Block.find().select('_id name'),
      // Get all configs for limits
      SystemConfig.find()
    ]);

    // Calculate key metrics
    const currentMonthTotalCost = currentMonthUsages.reduce((sum, u) => sum + u.totalCost, 0);
    const lastMonthTotalCost = lastMonthUsages[0]?.totalCost || 0;
    const costChangePercent = lastMonthTotalCost > 0 
      ? ((currentMonthTotalCost - lastMonthTotalCost) / lastMonthTotalCost * 100).toFixed(1)
      : 0;

    // Alert counts by severity
    const alertsBySeverity = {};
    allAlerts.forEach(a => {
      alertsBySeverity[a._id] = a.count;
    });

    // Calculate efficiency score
    let totalUsagePercent = 0;
    let resourceCount = 0;

    const blockStats = await Promise.all(blocks.map(async (block) => {
      const blockUsages = currentMonthUsages.filter(u => 
        u._id.block && u._id.block.toString() === block._id.toString()
      );

      const blockStats = {
        blockId: block._id,
        blockName: block.name,
        resources: {}
      };

      // Get limits for this block
      for (const config of configs) {
        const usage = blockUsages.find(u => u._id.resource === config.resource);
        const limit = config.monthlyThreshold || config.dailyLimitPerBlock || 0;
        const usedAmount = usage?.totalUsage || 0;
        const usagePercent = limit > 0 ? (usedAmount / limit * 100) : 0;
        
        blockStats.resources[config.resource] = {
          usage: usedAmount,
          limit: limit,
          percent: Math.min(100, Math.round(usagePercent)),
          cost: usage?.totalCost || 0
        };

        if (config.resource) {
          totalUsagePercent += usagePercent;
          resourceCount++;
        }
      }

      blockStats.totalCost = blockUsages.reduce((sum, u) => sum + u.totalCost, 0);
      blockStats.efficiency = Math.max(0, Math.min(100, Math.round(100 - (totalUsagePercent / (resourceCount || 1)) / blocks.length)));

      return blockStats;
    }));

    // Sort by cost
    blockStats.sort((a, b) => b.totalCost - a.totalCost);

    // Efficiency score calculation
    const avgUsagePercent = resourceCount > 0 ? totalUsagePercent / resourceCount : 0;
    const efficiencyScore = Math.max(0, Math.min(100, Math.round(100 - avgUsagePercent)));

    // Complaint counts
    const resolvedThisMonth = currentComplaints[0]?.count || 0;
    const complaintsLastMonth = lastMonthComplaints[0]?.count || 0;

    res.json({
      success: true,
      data: {
        keyMetrics: {
          totalMonthlyCost: Math.round(currentMonthTotalCost),
          totalMonthlyCostLastMonth: Math.round(lastMonthTotalCost),
          costChangePercent: parseFloat(costChangePercent),
          activeAlerts: activeAlerts.length,
          complaintsResolvedThisMonth: resolvedThisMonth,
          complaintsLastMonth: complaintsLastMonth,
          efficiencyScore: efficiencyScore,
          currency: '₹'
        },
        alerts: {
          active: activeAlerts.length,
          bySeverity: alertsBySeverity
        },
        blockPerformance: blockStats.map(bs => ({
          blockId: bs.blockId,
          blockName: bs.blockName,
          electricity: bs.resources['Electricity'] || { usage: 0, limit: 0, percent: 0, cost: 0 },
          water: bs.resources['Water'] || { usage: 0, limit: 0, percent: 0, cost: 0 },
          lpg: bs.resources['LPG'] || { usage: 0, limit: 0, percent: 0, cost: 0 },
          totalCost: bs.totalCost,
          efficiency: bs.efficiency
        })),
        costTrend: {
          currentMonth: currentMonthTotalCost,
          lastMonth: lastMonthTotalCost,
          changePercent: costChangePercent
        }
      }
    });
  } catch (err) {
    console.error('Error fetching dean summary:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
