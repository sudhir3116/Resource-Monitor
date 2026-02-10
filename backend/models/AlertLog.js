const mongoose = require('mongoose')

const alertLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  alertRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule' },
  resource_type: String,
  usage_value: Number,
  message: String,
  acknowledged: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('AlertLog', alertLogSchema)
