const mongoose = require('mongoose')

const alertLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  alertRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule' },
  resource_type: String,
  usage_value: Number,
  // Additional fields to record what triggered the alert
  threshold_value: Number,
  comparison: String,
  message: String,
  acknowledged: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('AlertLog', alertLogSchema)
