const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional if block-level usage
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
  resource_type: { type: String, required: true, enum: ['Electricity', 'Water', 'LPG', 'Diesel', 'Food', 'Waste'] },
  category: { type: String }, // e.g., 'Lighting', 'Heating', 'Cooking'
  usage_value: { type: Number, required: true },
  unit: { type: String }, // e.g., 'kWh', 'Liters', 'kg'
  usage_date: { type: Date, required: true, default: Date.now },
  notes: { type: String },

  // Audit fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Validation flags
  isVerified: { type: Boolean, default: false },
  isDuplicate: { type: Boolean, default: false }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for performance
usageSchema.index({ userId: 1, usage_date: -1 });
usageSchema.index({ blockId: 1, usage_date: -1 });
usageSchema.index({ usage_date: -1 }); // Optimized for date-range reports
usageSchema.index({ resource_type: 1 });
usageSchema.index({ createdAt: -1 });
usageSchema.index({ lastUpdatedBy: 1 });

// Pre-save hook to set createdBy if not set
usageSchema.pre('save', function (next) {
  if (this.isNew && !this.createdBy && this.userId) {
    this.createdBy = this.userId;
  }
  next();
});

module.exports = mongoose.model('Usage', usageSchema);
