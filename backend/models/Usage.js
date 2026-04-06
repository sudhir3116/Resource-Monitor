const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional if block-level usage
  blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResourceConfig' }, // NEW: ObjectId Reference
  resource_type: { type: String, required: true, trim: true }, // Legacy: for quick lookups
  category: { type: String }, // e.g., 'Lighting', 'Heating', 'Cooking'
  usage_value: { type: Number, required: true },
  unit: { type: String }, // e.g., 'kWh', 'Liters', 'kg'
  usage_date: { type: Date, required: true, default: Date.now },
  // Cost tracking
  cost: { type: Number, default: 0 },
  currency: { type: String, default: '₹' },
  notes: { type: String },

  // Audit fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Validation flags
  isVerified: { type: Boolean, default: false },
  isDuplicate: { type: Boolean, default: false }
  ,
  // Soft-delete fields
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
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
// Compound index for block+resource+date queries (reports & analytics)
usageSchema.index({ blockId: 1, resource_type: 1, usage_date: -1 });

// Pre-save hook to set createdBy and normalize resource_type
usageSchema.pre('save', function (next) {
  if (this.isNew && !this.createdBy && this.userId) {
    this.createdBy = this.userId;
  }
  if (this.resource_type) {
    this.resource_type = this.resource_type.trim().toLowerCase();
  }
  if (typeof next === 'function') next();
});

module.exports = mongoose.model('Usage', usageSchema);
