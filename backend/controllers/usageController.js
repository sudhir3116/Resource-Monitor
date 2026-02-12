const Usage = require('../models/Usage')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')
const Alert = require('../models/Alert')

// Create usage and trigger alert checks
exports.createUsage = async (req, res) => {
  try {
    // Accept either camelCase or snake_case inputs from frontend
    const resource_type = req.body.resourceType || req.body.resource_type
    const usage_value = Number(req.body.amount || req.body.usage_value || 0)
    const usage_date = req.body.date || req.body.usage_date || new Date()
    const notes = req.body.notes || ''

    // Basic validation
    if (!resource_type) return res.status(400).json({ message: 'resourceType is required' })
    if (!usage_value && usage_value !== 0) return res.status(400).json({ message: 'amount is required' })
    if (!usage_date) return res.status(400).json({ message: 'date is required' })

    const userId = req.userId || req.user || null
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const usage = await Usage.create({
      userId,
      resource_type,
      usage_value,
      usage_date,
      notes
    })

    // Existing alert rule checks (if any)
    try {
      const rules = await AlertRule.find({ userId, resource_type, active: true })
      const User = require('../models/User')
      const mailer = require('../utils/mailer')

      for (const rule of rules) {
        let triggered = false
        if (rule.comparison === 'gt' && usage_value > rule.threshold_value) triggered = true
        if (rule.comparison === 'lt' && usage_value < rule.threshold_value) triggered = true
        if (rule.comparison === 'eq' && usage_value === Number(rule.threshold_value)) triggered = true
        if (triggered) {
          // Create a clear human-readable message
          let verb = 'triggered'
          if (rule.comparison === 'gt') verb = 'exceeded'
          if (rule.comparison === 'lt') verb = 'fell below'
          if (rule.comparison === 'eq') verb = 'reached'
          const message = `${resource_type} ${verb} threshold ${rule.threshold_value} — value: ${usage_value}`

          const log = await AlertLog.create({
            userId,
            alertRuleId: rule._id,
            resource_type,
            usage_value,
            threshold_value: rule.threshold_value,
            comparison: rule.comparison,
            message
          })

          // send email to user (async, do not block response)
          try {
            const user = await User.findById(userId).select('email name')
            if (user && user.email) {
              const subject = `Alert: ${resource_type} ${rule.comparison} ${rule.threshold_value}`
              const text = `Hello ${user.name || ''},\n\nAn alert was triggered for ${resource_type}.\n\n${log.message}\n\nView your alerts in the dashboard.`
              mailer.sendMail({ to: user.email, subject, text }).catch(err => console.error('Mailer error', err))
            }
          } catch (err) {
            console.error('Error sending alert email', err)
          }
        }
      }
    } catch (e) {
      console.error('AlertRule processing error', e)
    }

    // Simple threshold-based alert creation (example threshold: 1000)
    try {
      const THRESHOLD = 1000
      if (usage_value > THRESHOLD) {
        await Alert.create({
          user: userId,
          resourceType: resource_type,
          amount: usage_value,
          message: 'Usage exceeded safe limit',
          status: 'active'
        })
      }
    } catch (e) {
      console.error('Error creating Alert document', e)
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
