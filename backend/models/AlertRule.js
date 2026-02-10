const mongoose = require('mongoose')

const alertRuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resource_type: { type: String, required: true },
  threshold_value: { type: Number, required: true },
  comparison: { type: String, enum: ['gt','lt'], default: 'gt' },
  active: { type: Boolean, default: true }
}, { timestamps: true })

module.exports = mongoose.model('AlertRule', alertRuleSchema)
