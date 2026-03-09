const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true })

// Compound index to prevent multiple active tokens per user
schema.index({ user: 1, token: 1 }, { unique: true })

module.exports = mongoose.model('PasswordResetToken', schema)
