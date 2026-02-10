const mongoose = require('mongoose')

const usageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resource_type: { type: String, required: true },
  usage_value: { type: Number, required: true },
  usage_date: { type: Date, required: true },
  notes: { type: String }
}, { timestamps: true })

module.exports = mongoose.model('Usage', usageSchema)
