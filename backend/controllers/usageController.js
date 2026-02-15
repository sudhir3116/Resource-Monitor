const Usage = require('../models/Usage')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')
const Alert = require('../models/Alert')
const User = require('../models/User')
const mailer = require('../utils/mailer')
const { checkThresholds } = require('../services/thresholdService')
const mongoose = require('mongoose')

// Helper: Calculate Sustainability Score (Safe & Robust)
const calculateSustainabilityScore = async (userId) => {
  try {
    if (!userId) return 0;

    let score = 100
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 1. Fetch Aggregated Usage
    const usageStats = await Usage.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), usage_date: { $gte: currentMonthStart } } },
      { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
    ]) || []

    // 2. Weighted Penalties
    if (Array.isArray(usageStats)) {
      usageStats.forEach(stat => {
        if (!stat || !stat._id) return;
        const type = stat._id
        const total = Number(stat.total) || 0

        if (type === 'Waste' && total > 100) score -= 30
        if (type === 'Diesel' && total > 50) score -= 30
        if (type === 'Electricity' && total > 1000) score -= 20
        if (type === 'LPG' && total > 100) score -= 20
        if (type === 'Water' && total > 5000) score -= 10
        if (type === 'Food' && total > 200) score -= 10
      })
    }

    // 3. Week-over-Week Improvement
    const today = new Date()
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7)
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14)

    const thisWeek = await Usage.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), usage_date: { $gte: sevenDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]) || []

    const lastWeek = await Usage.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), usage_date: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ]) || []

    const thisWeekTotal = (thisWeek[0] && thisWeek[0].total) || 0
    const lastWeekTotal = (lastWeek[0] && lastWeek[0].total) || 0

    if (lastWeekTotal > 0 && thisWeekTotal < lastWeekTotal) {
      score += 10
    }

    return Math.max(0, Math.min(100, Math.round(score)))
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
    const resource_type = req.body.resourceType || req.body.resource_type || req.body.resource
    const category = req.body.category || 'General'
    const usage_value = Number(req.body.amount || req.body.usage_value || 0)
    const usage_date = req.body.date || req.body.usage_date || new Date()
    const notes = req.body.notes || ''

    if (!resource_type) return res.status(400).json({ message: 'resourceType is required' })
    if (!usage_value && usage_value !== 0) return res.status(400).json({ message: 'amount is required' })
    if (!usage_date) return res.status(400).json({ message: 'date is required' })

    const userId = req.userId || req.user || null
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const user = await User.findById(userId);

    const usage = await Usage.create({
      userId,
      blockId: user?.block || null,
      resource_type,
      category,
      usage_value,
      usage_date,
      notes
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
            severity: 'medium',
            status: 'active'
          });
          await sendAlertEmail(userId, `Custom Alert Rule: ${resource_type}`, message);
        }
      }
    } catch (e) {
      console.error('AlertRule error', e)
    }

    res.status(201).json({ usage })
  } catch (err) {
    console.error('createUsage error', err)
    res.status(500).json({ message: err.message })
  }
}

exports.getUsages = async (req, res) => {
  try {
    const { start, end, resource, category, sort } = req.query
    const filter = {}

    if (req.user.role === 'student' || !req.user.role || req.user.role === 'user') {
      filter.userId = req.userId
    } else if (req.user.role === 'warden') {
      // Warden sees all usage for their block
      const user = await User.findById(req.userId);
      if (user && user.block) {
        filter.blockId = user.block;
      } else {
        // Fallback if no block assigned
        filter.userId = req.userId;
      }
    }
    if (resource) filter.resource_type = resource
    if (category) filter.category = category

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

    const usages = await Usage.find(filter)
      .sort(sortOption)
      .populate('userId', 'name email role block');
    res.json({ usages })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getUsage = async (req, res) => {
  try {
    const filter = { _id: req.params.id }
    if (req.user.role === 'student' || !req.user.role || req.user.role === 'user') {
      filter.userId = req.userId
    }

    const usage = await Usage.findOne(filter)
    if (!usage) return res.status(404).json({ message: 'Not found' })
    res.json({ usage })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.updateUsage = async (req, res) => {
  try {
    const filter = { _id: req.params.id }
    if (req.user.role !== 'admin') {
      filter.userId = req.userId
    }

    const usage = await Usage.findOneAndUpdate(filter, req.body, { new: true })
    if (!usage) return res.status(404).json({ message: 'Not found or unauthorized' })
    res.json({ usage })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.deleteUsage = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const filter = { _id: req.params.id }
    if (user.role !== 'admin') {
      filter.userId = req.userId
    }

    const usage = await Usage.findOneAndDelete(filter)
    if (!usage) return res.status(404).json({ message: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
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

    const score = await calculateSustainabilityScore(userId);

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
