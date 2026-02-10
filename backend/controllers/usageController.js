const Usage = require('../models/Usage')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')

// Create usage and trigger alert checks
exports.createUsage = async (req, res) => {
  try {
    const { resource_type, usage_value, usage_date, notes } = req.body
    const usage = await Usage.create({
      userId: req.userId,
      resource_type,
      usage_value,
      usage_date,
      notes
    })

    // check alert rules for this user and resource
    const rules = await AlertRule.find({ userId: req.userId, resource_type, active: true })
    for (const rule of rules) {
      let triggered = false
      if (rule.comparison === 'gt' && usage_value > rule.threshold_value) triggered = true
      if (rule.comparison === 'lt' && usage_value < rule.threshold_value) triggered = true
      if (triggered) {
        await AlertLog.create({
          userId: req.userId,
          alertRuleId: rule._id,
          resource_type,
          usage_value,
          message: `Threshold ${rule.comparison} ${rule.threshold_value} exceeded: ${usage_value}`
        })
      }
    }

    res.status(201).json({ usage })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getUsages = async (req, res) => {
  try {
    const { start, end, resource } = req.query
    const filter = { userId: req.userId }
    if (resource) filter.resource_type = resource
    if (start || end) filter.usage_date = {}
    if (start) filter.usage_date.$gte = new Date(start)
    if (end) filter.usage_date.$lte = new Date(end)

    const usages = await Usage.find(filter).sort({ usage_date: -1 })
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
    const usage = await Usage.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!usage) return res.status(404).json({ message: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
