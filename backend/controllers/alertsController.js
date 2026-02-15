const Alert = require('../models/Alert')
const AlertRule = require('../models/AlertRule')
const AlertLog = require('../models/AlertLog')

exports.getSystemAlerts = async (req, res) => {
  try {
    const filter = {};
    // Role based visibility
    if (req.user.role === 'student') {
      filter.user = req.userId;
    }
    // Block manager logic can be added here if needed (e.g. filter.block = user.block)

    // Sort by newest first
    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('block', 'name');

    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

exports.createRule = async (req, res) => {
  try {
    const { resource_type, threshold_value, comparison } = req.body
    const rule = await AlertRule.create({ userId: req.userId, resource_type, threshold_value, comparison })
    res.status(201).json({ rule })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.listRules = async (req, res) => {
  try {
    const rules = await AlertRule.find({ userId: req.userId })
    const logs = await AlertLog.find({ userId: req.userId }).sort({ createdAt: -1 })
    res.json({ rules, logs })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.updateRule = async (req, res) => {
  try {
    const rule = await AlertRule.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true })
    if (!rule) return res.status(404).json({ message: 'Not found' })
    res.json({ rule })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.deleteRule = async (req, res) => {
  try {
    const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, userId: req.userId })
    if (!rule) return res.status(404).json({ message: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.listLogs = async (req, res) => {
  try {
    const logs = await AlertLog.find({ userId: req.userId }).sort({ createdAt: -1 })
    res.json({ logs })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
