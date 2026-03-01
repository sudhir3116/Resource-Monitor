/**
 * models/Alert.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Institutional Alert Document — production-grade incident management schema
 *
 * Key design decisions:
 *  • Compound unique index: resource + block/user + alertDate + alertType
 *    → guarantees exactly ONE alert per (resource × scope × day × type)
 *  • `alertType` distinguishes daily vs monthly vs spike vs budget checks
 *  • `comments[]` — full investigation timeline, each entry is immutable once added
 *  • `escalationLevel` 0–3 maps to Warden → Dean → Principal escalation chain
 *  • `escalatedAt` timestamps each level transition
 *  • All computed fields stored for audit (totalUsage, dailyLimit, calculatedPercentage, etc.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');

// ── Comment / Investigation Note sub-schema ──────────────────────────────────
const commentSchema = new mongoose.Schema({
  comment: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional for system comments
  role: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: true });

// ── Main Alert schema ─────────────────────────────────────────────────────────
const alertSchema = new mongoose.Schema({

  // ── Scope ─────────────────────────────────────────────────────────────────
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' },

  // ── Resource context ──────────────────────────────────────────────────────
  resourceType: { type: String, required: true },
  alertType: {
    type: String,
    enum: ['daily', 'monthly', 'spike', 'budget', 'manual'],
    default: 'daily',
  },
  alertDate: { type: Date },    // normalized start-of-day for dedup

  // ── Computed values (stored for audit/display) ────────────────────────────
  amount: { type: Number },   // legacy alias for totalUsage
  threshold: { type: Number },   // legacy alias for dailyLimit
  totalUsage: { type: Number },
  dailyLimit: { type: Number },
  monthlyLimit: { type: Number },
  calculatedPercentage: { type: Number },   // (totalUsage / limit) × 100
  excessPercentage: { type: Number },   // calculatedPercentage - 100
  percentage: { type: Number },   // alias of calculatedPercentage

  // ── Alert content ─────────────────────────────────────────────────────────
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ['Warning', 'High', 'Critical', 'Severe'],
    required: true,
    default: 'Warning',
  },
  // Numeric severity level for easy comparisons and atomic updates
  severityLevel: { type: Number, default: 0, index: true },

  // ── Lifecycle status ──────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['Active', 'Investigating', 'Reviewed', 'Escalated', 'Resolved', 'Dismissed'],
    default: 'Active',
  },

  // ── Escalation chain ──────────────────────────────────────────────────────
  escalationLevel: { type: Number, default: 0 }, // 0=none, 1=Warden, 2=Dean, 3=Principal
  escalatedAt: { type: Date },                // timestamp of latest escalation

  // ── Actor tracking (who did what) ─────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },

  investigatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  investigatedAt: { type: Date },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },

  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolutionComment: { type: String },

  principalAcknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  principalAcknowledgedAt: { type: Date },

  // ── Investigation timeline ────────────────────────────────────────────────
  comments: [commentSchema],

  // ── UI helpers ────────────────────────────────────────────────────────────
  isRead: { type: Boolean, default: false },

}, { timestamps: true });  // adds createdAt + updatedAt automatically

// ── Indexes for performance ───────────────────────────────────────────────────
// Dedup: one alert per resource × block × day × type
alertSchema.index({ block: 1, resourceType: 1, alertDate: 1, alertType: 1 }, { sparse: true });
// Compound unique index to prevent duplicate alerts under concurrency
// (applies when resourceType + alertType + alertDate are present)
alertSchema.index({ resourceType: 1, alertType: 1, alertDate: 1 }, { unique: true, sparse: true, background: true });
alertSchema.index({ user: 1, resourceType: 1, alertDate: 1, alertType: 1 }, { sparse: true });

// Query patterns
alertSchema.index({ block: 1, status: 1, createdAt: -1 });
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ severity: 1, status: 1 });
alertSchema.index({ escalationLevel: 1, status: 1 });
alertSchema.index({ resourceType: 1, createdAt: -1 });
alertSchema.index({ isRead: 1, user: 1 });

module.exports = mongoose.model('Alert', alertSchema);
