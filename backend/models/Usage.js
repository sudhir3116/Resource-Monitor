const mongoose = require('mongoose')

const usageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional if block-level usage
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
  resource_type: { type: String, required: true, enum: ['Electricity', 'Water', 'LPG', 'Diesel', 'Food', 'Waste'] },
  category: { type: String }, // e.g., 'Lighting', 'Heating', 'Cooking'
  usage_value: { type: Number, required: true },
  unit: { type: String }, // e.g., 'kWh', 'Liters', 'kg'
  usage_date: { type: Date, required: true, default: Date.now },
  notes: { type: String }
}, { timestamps: true });

// Indexes for performance
usageSchema.index({ userId: 1, usage_date: -1 });
usageSchema.index({ blockId: 1, usage_date: -1 });
usageSchema.index({ resource_type: 1 });

module.exports = mongoose.model('Usage', usageSchema)
