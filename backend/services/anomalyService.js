/**
 * services/anomalyService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Detect abnormal usage patterns and create anomaly alerts
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Block = require('../models/Block');
const mongoose = require('mongoose');

/**
 * Detect anomalies by comparing current usage to historical average
 * Anomaly: if today_usage > 1.5 × weekly_average
 * 
 * @param {ObjectId|string} blockId - Block to check (optional, check all if null)
 * @param {string} resourceType - Resource to check (optional)
 * @returns {Promise<Array>} Array of anomalies {blockId, resource, today, weeklyAvg, anomalyFactor}
 */
async function detectAnomalies(blockId = null, resourceType = null) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const matchFilterToday = {
      usage_date: { $gte: today, $lt: tomorrow },
      deleted: { $ne: true }
    };

    const matchFilterWeek = {
      usage_date: { $gte: weekAgo, $lt: today },
      deleted: { $ne: true }
    };

    if (blockId) {
      matchFilterToday.blockId = new mongoose.Types.ObjectId(blockId);
      matchFilterWeek.blockId = new mongoose.Types.ObjectId(blockId);
    }

    if (resourceType) {
      matchFilterToday.resource_type = resourceType;
      matchFilterWeek.resource_type = resourceType;
    }

    // Get today's usage
    const todayUsage = await Usage.aggregate([
      { $match: matchFilterToday },
      {
        $group: {
          _id: '$blockId',
          resource: '$resource_type',
          totalUsage: { $sum: '$usage_value' }
        }
      }
    ]);

    // Get week average
    const weekUsage = await Usage.aggregate([
      { $match: matchFilterWeek },
      {
        $group: {
          _id: {
            blockId: '$blockId',
            resource: '$resource_type'
          },
          totalUsage: { $sum: '$usage_value' }
        }
      }
    ]);

    // Build week average map
    const weekMap = {};
    weekUsage.forEach(item => {
      const key = `${item._id.blockId}:${item._id.resource}`;
      weekMap[key] = item.totalUsage / 7; // Average per day
    });

    // Detect anomalies
    const anomalies = [];
    const anomalyThreshold = 1.5; // 50% spike threshold

    todayUsage.forEach(item => {
      const key = `${item._id}:${item.resource}`;
      const weekAvg = weekMap[key] || 0;
      
      // Only flag if we have historical data to compare
      if (weekAvg > 0) {
        const anomalyFactor = item.totalUsage / weekAvg;
        
        if (anomalyFactor >= anomalyThreshold) {
          anomalies.push({
            blockId: item._id,
            resource: item.resource,
            today: item.totalUsage,
            weeklyAvg: Math.round(weekAvg * 100) / 100,
            anomalyFactor: Math.round(anomalyFactor * 100) / 100,
            excessAmount: Math.round((item.totalUsage - weekAvg) * 100) / 100,
            severity: anomalyFactor > 2 ? 'Critical' : anomalyFactor > 1.8 ? 'High' : 'Warning'
          });
        }
      }
    });

    return anomalies;
  } catch (error) {
    console.error('Error detecting anomalies:', error.message);
    return [];
  }
}

/**
 * Create anomaly alerts in the system from detected anomalies
 * Only creates if alert doesn't already exist for today
 * 
 * @param {Array} anomalies - From detectAnomalies()
 * @param {string} userId - System user to credit (Optional)
 * @returns {Promise<Array>} Created alert IDs
 */
async function createAnomalyAlerts(anomalies = [], userId = null) {
  try {
    const createdAlerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const anomaly of anomalies) {
      // Check if similar alert exists for today already
      const existing = await Alert.findOne({
        block: anomaly.blockId,
        resourceType: anomaly.resource,
        alertType: 'spike',
        alertDate: { $gte: today }
      });

      if (existing) continue; // Skip, already exists

      // Create new anomaly alert
      const alert = await Alert.create({
        block: new mongoose.Types.ObjectId(anomaly.blockId),
        resourceType: anomaly.resource,
        alertType: 'spike',
        alertDate: today,
        message: `Unusual spike detected: ${anomaly.resource} usage is ${anomaly.anomalyFactor}x normal (${anomaly.today} vs ${anomaly.weeklyAvg} daily average)`,
        severity: anomaly.severity,
        status: 'Active',
        totalUsage: anomaly.today,
        excessPercentage: Math.round(((anomaly.today - anomaly.weeklyAvg) / anomaly.weeklyAvg) * 100 * 100) / 100,
        createdBy: userId,
        createdAt: new Date()
      });

      createdAlerts.push(alert._id);
    }

    return createdAlerts;
  } catch (error) {
    console.error('Error creating anomaly alerts:', error.message);
    return [];
  }
}

/**
 * Analyze usage patterns per student/user
 * Identify students with abnormal consumption patterns
 * 
 * @param {number} daysBack - Historical period (default 30)
 * @returns {Promise<Array>} [{userId, avgDaily, maxDaily, variation, riskLevel}]
 */
async function analyzeUserPatterns(daysBack = 30) {
  try {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - daysBack);

    const patterns = await Usage.aggregate([
      {
        $match: {
          userId: { $exists: true, $ne: null },
          usage_date: { $gte: startDate },
          deleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$userId',
          avgUsage: { $avg: '$usage_value' },
          maxUsage: { $max: '$usage_value' },
          minUsage: { $min: '$usage_value' },
          count: { $sum: 1 }
        }
      },
      {
        $addFields: {
          range: { $subtract: ['$maxUsage', '$minUsage'] },
          variation: {
            $cond: [
              { $eq: ['$avgUsage', 0] },
              0,
              { $divide: [{ $subtract: ['$maxUsage', '$minUsage'] }, '$avgUsage'] }
            ]
          }
        }
      },
      {
        $addFields: {
          riskLevel: {
            $cond: [
              { $gte: ['$variation', 3] },
              'High',
              {
                $cond: [
                  { $gte: ['$variation', 2] },
                  'Medium',
                  'Low'
                ]
              }
            ]
          }
        }
      },
      { $sort: { variation: -1 } },
      { $limit: 50 }
    ]);

    return patterns.map(p => ({
      userId: p._id,
      avgDaily: Math.round(p.avgUsage * 100) / 100,
      maxDaily: Math.round(p.maxUsage * 100) / 100,
      minDaily: Math.round(p.minUsage * 100) / 100,
      variation: Math.round(p.variation * 100) / 100,
      riskLevel: p.riskLevel,
      recordCount: p.count
    }));
  } catch (error) {
    console.error('Error analyzing user patterns:', error.message);
    return [];
  }
}

/**
 * Check if a specific block's usage pattern is anomalous
 * Compare to campus average
 * 
 * @param {ObjectId|string} blockId - Block to analyze
 * @returns {Promise<Object>} {blockId, blockUsage, campusAvg, anomaly: boolean, ratio, recommendation}
 */
async function analyzeBlockAnomaly(blockId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get block's total usage today
    const blockUsage = await Usage.aggregate([
      {
        $match: {
          blockId: new mongoose.Types.ObjectId(blockId),
          usage_date: { $gte: today, $lt: tomorrow },
          deleted: { $ne: true }
        }
      },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]);

    const blockTotal = blockUsage[0]?.total || 0;

    // Get campus average per block
    const allBlocks = await Block.countDocuments({ status: 'Active' });
    const campusTotal = await Usage.aggregate([
      {
        $match: {
          usage_date: { $gte: today, $lt: tomorrow },
          deleted: { $ne: true }
        }
      },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]);

    const campusAvg = allBlocks > 0 ? (campusTotal[0]?.total || 0) / allBlocks : 0;
    const ratio = campusAvg > 0 ? blockTotal / campusAvg : 0;
    const isAnomaly = ratio > 1.5; // More than 50% above average

    let recommendation = 'Normal usage pattern';
    if (ratio > 2) {
      recommendation = 'Critical: Investigate immediately. Usage is 2x average.';
    } else if (ratio > 1.5) {
      recommendation = 'High: Review usage patterns. Significantly above campus average.';
    } else if (ratio < 0.5 && blockTotal > 0) {
      recommendation = 'Good: Well below average. Maintain current efficiency.';
    }

    return {
      blockId,
      blockUsage: Math.round(blockTotal * 100) / 100,
      campusAvg: Math.round(campusAvg * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      anomaly: isAnomaly,
      recommendation
    };
  } catch (error) {
    console.error('Error analyzing block anomaly:', error.message);
    return { anomaly: false, recommendation: 'Unable to analyze.' };
  }
}

module.exports = {
  detectAnomalies,
  createAnomalyAlerts,
  analyzeUserPatterns,
  analyzeBlockAnomaly
};
