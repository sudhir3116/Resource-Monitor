const mongoose = require('mongoose')

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resourceType: { type: String, required: true },
  amount: { type: Number, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Alert', alertSchema)
