const Usage = require('../models/Usage');
const SystemConfig = require('../models/SystemConfig');
const Alert = require('../models/Alert');
const Block = require('../models/Block');
const { predictEndOfMonth } = require('../utils/usagePredictor');
const mongoose = require('mongoose');

/**
 * GET /api/predictions/block/:blockId
 * Returns usage predictions for all resources in a block for the current month
 */
exports.getBlockPredictions = async (req, res) => {
  try {
    const { blockId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blockId)) {
      return res.status(400).json({ success: false, message: 'Invalid block ID' });
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all resource configs
    const configs = await SystemConfig.find({ isActive: true });

    // Get current month usages for this block
    const usages = await Usage.find({
      blockId: new mongoose.Types.ObjectId(blockId),
      usage_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
      deleted: false
    });

    // Group usages by resource
    const usagesByResource = {};
    configs.forEach(cfg => {
      usagesByResource[cfg.resource] = usages.filter(u => u.resource_type === cfg.resource);
    });

    // Generate predictions for each resource
    const predictions = [];
    let hasWarning = false;

    for (const config of configs) {
      const resourceUsages = usagesByResource[config.resource] || [];
      const limit = config.monthlyThreshold || 0;

      const prediction = await predictEndOfMonth(resourceUsages, limit, now);

      predictions.push({
        resource: config.resource,
        unit: config.unit,
        costPerUnit: config.costPerUnit,
        limit: limit,
        prediction: {
          ...prediction,
          projectedCost: prediction.projectedTotal * config.costPerUnit
        },
        status: prediction.projectedPercent > 100 ? 'EXCEED' : 
                prediction.projectedPercent > 90 ? 'WARNING' : 'NORMAL',
        severity: prediction.projectedPercent > 100 ? 'critical' :
                  prediction.projectedPercent > 90 ? 'high' : 'low'
      });

      if (prediction.projectedPercent >= 90) {
        hasWarning = true;
      }
    }

    // Get block info
    const block = await Block.findById(blockId).select('name');

    res.json({
      success: true,
      data: {
        block: {
          id: blockId,
          name: block?.name || 'Unknown'
        },
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        predictions: predictions.sort((a, b) => b.prediction.projectedPercent - a.prediction.projectedPercent),
        hasWarning: hasWarning,
        generatedAt: now.toISOString()
      }
    });
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/predictions
 * Returns predictions for all blocks (summary view)
 */
exports.getAllPredictions = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const blocks = await Block.find().select('_id name');
    const configs = await SystemConfig.find({ isActive: true });

    const predictions = [];

    for (const block of blocks) {
      const usages = await Usage.find({
        blockId: block._id,
        usage_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
        deleted: false
      });

      const usagesByResource = {};
      configs.forEach(cfg => {
        usagesByResource[cfg.resource] = usages.filter(u => u.resource_type === cfg.resource);
      });

      let blockTotalPercent = 0;
      let resourceCount = 0;
      let hasWarning = false;

      for (const config of configs) {
        const resourceUsages = usagesByResource[config.resource] || [];
        const limit = config.monthlyThreshold || 0;
        const prediction = await predictEndOfMonth(resourceUsages, limit, now);

        if (prediction.projectedPercent >= 90) {
          hasWarning = true;
          blockTotalPercent += prediction.projectedPercent;
          resourceCount++;
        }
      }

      if (hasWarning) {
        predictions.push({
          blockId: block._id,
          blockName: block.name,
          averageProjectedPercent: resourceCount > 0 ? Math.round(blockTotalPercent / resourceCount) : 0,
          hasWarning: true
        });
      }
    }

    res.json({
      success: true,
      data: {
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        blocksWithWarnings: predictions.sort((a, b) => b.averageProjectedPercent - a.averageProjectedPercent),
        totalWarnings: predictions.length,
        generatedAt: now.toISOString()
      }
    });
  } catch (err) {
    console.error('Error fetching all predictions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/predictions/create-alerts
 * Create predictive alerts based on forecasts
 * Called by admin to generate alerts for forecasted exceedances
 */
exports.createPredictiveAlerts = async (req, res) => {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const blocks = await Block.find().select('_id');
    const configs = await SystemConfig.find({ isActive: true });

    let alertsCreated = 0;

    for (const block of blocks) {
      const usages = await Usage.find({
        blockId: block._id,
        usage_date: { $gte: currentMonthStart, $lte: currentMonthEnd },
        deleted: false
      });

      for (const config of configs) {
        const resourceUsages = usages.filter(u => u.resource_type === config.resource);
        const prediction = await predictEndOfMonth(resourceUsages, config.monthlyThreshold || 0, now);

        // Create alert only if projected to exceed 90% of limit
        if (prediction.projectedPercent >= 90) {
          // Check if alert already exists for this block+resource
          const existingAlert = await Alert.findOne({
            block: block._id,
            resourceType: config.resource,
            alertType: 'predictive',
            status: { $ne: 'resolved' },
            createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // Within last 24h
          });

          if (!existingAlert) {
            const severity = prediction.projectedPercent > 100 ? 'Critical' :
                           prediction.projectedPercent > 95 ? 'High' : 'Medium';

            const message = prediction.projectedPercent > 100
              ? `${config.resource} projected to exceed limit by ${Math.round(prediction.exceedByAmount)} ${config.unit} by ${prediction.exceedByDate}`
              : `${config.resource} projected to reach ${Math.round(prediction.projectedPercent)}% of monthly limit by month end`;

            await Alert.create({
              block: block._id,
              resourceType: config.resource,
              alertType: 'predictive',
              amount: Math.round(prediction.projectedTotal),
              message: message,
              severity: severity,
              status: 'active',
              metaData: {
                currentUsage: prediction.currentUsage,
                projectedTotal: prediction.projectedTotal,
                projectedPercent: prediction.projectedPercent,
                exceedByDate: prediction.exceedByDate,
                confidence: prediction.confidence
              }
            });

            alertsCreated++;
          }
        }
      }
    }

    res.json({
      success: true,
      message: `${alertsCreated} predictive alerts created`,
      data: { alertsCreated }
    });
  } catch (err) {
    console.error('Error creating predictive alerts:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
