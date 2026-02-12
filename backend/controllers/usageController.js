const Usage = require('../models/Usage')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')
const Alert = require('../models/Alert')
const User = require('../models/User')
const mailer = require('../utils/mailer')

// Helper: Calculate Sustainability Score (Hostel Enhanced)
const calculateSustainabilityScore = async (userId) => {
  let score = 100
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  // 1. Fetch Aggregated Usage
  const usageStats = await Usage.aggregate([
    { $match: { userId: userId, usage_date: { $gte: currentMonthStart } } },
    { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
  ])

  // 2. Weighted Penalties
  // Severe: Waste, Diesel (-30 per breach) | High: Elec, LPG (-20) | Moderate: Water, Food (-10)
  // Thresholds (Hypothetical for Hostel scale):
  // Waste > 100kg, Diesel > 50L, Elec > 1000kWh, LPG > 100kg, Water > 5000L, Food > 200kg

  usageStats.forEach(stat => {
    const type = stat._id
    const total = stat.total

    // Penalties
    if (type === 'Waste' && total > 100) score -= 30
    if (type === 'Diesel' && total > 50) score -= 30
    if (type === 'Electricity' && total > 1000) score -= 20
    if (type === 'LPG' && total > 100) score -= 20
    if (type === 'Water' && total > 5000) score -= 10
    if (type === 'Food' && total > 200) score -= 10
  })

  // 3. Week-over-Week Improvement Bonus
  // Compare last 7 days vs previous 7 days
  const today = new Date()
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7)
  const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14)

  const thisWeek = await Usage.aggregate([{ $match: { userId, usage_date: { $gte: sevenDaysAgo } } }, { $group: { _id: null, total: { $sum: '$usage_value' } } }])
  const lastWeek = await Usage.aggregate([{ $match: { userId, usage_date: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } }, { $group: { _id: null, total: { $sum: '$usage_value' } } }])

  const thisWeekTotal = thisWeek[0]?.total || 0
  const lastWeekTotal = lastWeek[0]?.total || 0

  if (lastWeekTotal > 0 && thisWeekTotal < lastWeekTotal) {
    score += 10 // Bonus for reducing usage
  }

  return Math.max(0, Math.min(100, Math.round(score)))
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

// Create usage and trigger alert checks
exports.createUsage = async (req, res) => {
  try {
    const resource_type = req.body.resourceType || req.body.resource_type
    const category = req.body.category || 'General' // New Field
    const usage_value = Number(req.body.amount || req.body.usage_value || 0)
    const usage_date = req.body.date || req.body.usage_date || new Date()
    const notes = req.body.notes || ''

    if (!resource_type) return res.status(400).json({ message: 'resourceType is required' })
    if (!usage_value && usage_value !== 0) return res.status(400).json({ message: 'amount is required' })
    if (!usage_date) return res.status(400).json({ message: 'date is required' })

    const userId = req.userId || req.user || null
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const usage = await Usage.create({
      userId,
      resource_type,
      category,
      usage_value,
      usage_date,
      notes
    })

    // --- Intelligent Waste Detection ---

    // 1. Spike Detection (Compare vs Last 3 Records average)
    // Fetch last 3 records for this resource & category (excluding current)
    const recentRecords = await Usage.find({
      userId,
      resource_type,
      _id: { $ne: usage._id } // exclude self
    }).sort({ usage_date: -1 }).limit(3)

    if (recentRecords.length >= 3) {
      const avgRecent = recentRecords.reduce((acc, curr) => acc + curr.usage_value, 0) / recentRecords.length
      // Spike if > 50% increase over recent average
      if (usage_value > avgRecent * 1.5) {
        const message = `Spike detected: ${resource_type} (${category}) usage of ${usage_value} is 50% higher than average of last 3 records (${avgRecent.toFixed(1)}).`

        await Alert.create({
          user: userId,
          resourceType: resource_type,
          amount: usage_value,
          message,
          status: 'danger'
        })
        await sendAlertEmail(userId, `Alert: ${resource_type} Spike`, message)
      }
    }

    // 2. High Waste Alert (Specific rule for Waste)
    if (resource_type === 'Waste' && usage_value > 50) { // Limit: 50kg per entry?
      const message = `High Waste Generated: ${usage_value} units recorded in ${category}.`
      await Alert.create({
        user: userId,
        resourceType: 'Waste',
        amount: usage_value,
        message,
        status: 'danger'
      })
      await sendAlertEmail(userId, 'Alert: High Waste Generation', message)
    }

    // 3. Monthly Overconsumption (Check Aggregated)
    const startOfMonth = new Date(new Date(usage_date).getFullYear(), new Date(usage_date).getMonth(), 1);
    const monthlyStats = await Usage.aggregate([
      { $match: { userId, resource_type, usage_date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$usage_value' } } }
    ])
    const currentMonthlyTotal = monthlyStats[0]?.total || usage_value

    // Hostel Limits
    const MONTHLY_LIMITS = {
      'Electricity': 1000,
      'Water': 5000,
      'Food': 500,
      'LPG': 200,
      'Diesel': 100,
      'Waste': 200
    };
    const limit = MONTHLY_LIMITS[resource_type];

    if (limit && currentMonthlyTotal > limit) {
      // Prevent spamming? (Ideally) 
      // For now, simple alert
      const message = `Overconsumption: ${resource_type} monthly total (${currentMonthlyTotal}) usage has exceeded the limit (${limit}).`
      // Check if alert exists recently to avoid dupes could be added here
      await Alert.create({
        user: userId,
        resourceType: resource_type,
        amount: currentMonthlyTotal,
        message,
        status: 'warning'
      });
    }

    // --- Legacy Alert Rules (User Defined) ---
    // (Kept as is for compatibility)
    try {
      const rules = await AlertRule.find({ userId, resource_type, active: true })
      for (const rule of rules) {
        let triggered = false
        if (rule.comparison === 'gt' && usage_value > rule.threshold_value) triggered = true
        if (rule.comparison === 'lt' && usage_value < rule.threshold_value) triggered = true
        if (rule.comparison === 'eq' && usage_value === Number(rule.threshold_value)) triggered = true

        if (triggered) {
          const message = `Rule Triggered: ${resource_type} rule (${rule.comparison} ${rule.threshold_value}) met by value ${usage_value}.`
          await AlertLog.create({
            userId, alertRuleId: rule._id, resource_type, usage_value, threshold_value: rule.threshold_value, comparison: rule.comparison, message
          })
          await Alert.create({ user: userId, resourceType: resource_type, amount: usage_value, message, status: 'warning' });
          await sendAlertEmail(userId, `Alert Rule: ${resource_type}`, message);
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
    const filter = { userId: req.userId }
    if (resource) filter.resource_type = resource
    if (category) filter.category = category // New Filter

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

    const usages = await Usage.find(filter).sort(sortOption)
    res.json({ usages })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getUsage = async (req, res) => {
  try {
    const usage = await Usage.findOne({ _id: req.params.id, userId: req.userId })
    if (!usage) return res.status(404).json({ message: 'Not found' })
    res.json({ usage })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.updateUsage = async (req, res) => {
  try {
    const usage = await Usage.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true })
    if (!usage) return res.status(404).json({ message: 'Not found' })
    res.json({ usage })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.deleteUsage = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admins only' })
    }

    const usage = await Usage.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!usage) return res.status(404).json({ message: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    // Check "category" filter? usually dashboard aggregates all, 
    // but if query param exists we could filter. For now global stats.

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();

    // Fetch aggregated usage for this month
    const usageStats = await Usage.aggregate([
      { $match: { userId: userId, usage_date: { $gte: startOfMonth } } },
      { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
    ]);

    const stats = {};
    usageStats.forEach(item => {
      const currentTotal = item.total;
      const predictedTotal = (currentTotal / daysPassed) * daysInMonth;

      // Mock Rates (Hostel Rates)
      let rate = 0;
      if (item._id === 'Electricity') rate = 12; // INR/Unit
      if (item._id === 'Water') rate = 0.5;
      if (item._id === 'LPG') rate = 80; // per kg
      if (item._id === 'Diesel') rate = 95; // per L
      if (item._id === 'Food') rate = 150; // per plate/unit?

      const estimatedBill = predictedTotal * rate;

      stats[item._id] = {
        current: currentTotal,
        predicted: Math.round(predictedTotal),
        estimatedBill: estimatedBill.toFixed(2)
      };
    });

    const score = await calculateSustainabilityScore(userId);

    let status = 'Green';
    if (score < 60) status = 'Red';
    else if (score < 85) status = 'Yellow';

    const recentAlerts = await Alert.find({ user: userId }).sort({ createdAt: -1 }).limit(5);

    res.json({
      stats,
      sustainabilityScore: score,
      status,
      recentAlerts
    });

  } catch (err) {
    console.error('getDashboardStats error', err);
    res.status(500).json({ message: err.message });
  }
}

