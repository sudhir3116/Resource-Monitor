const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: true,
    },
    googleId: {
      type: String,
    },
    avatar: {
      type: String,
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    role: {
      type: String,
      enum: Object.values(require('../config/roles').ROLES),
      default: 'student',
      index: true
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
      index: true
    },
    room: {
      type: String // Room number
    },
    floor: {
      type: Number
    },
    // Institutional Fields
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'graduated'],
      default: 'active' // Default active for now to prevent lockout, modify logic in controller
    },
    department: {
      type: String, // e.g., 'Computer Science', 'Mechanical Engineering'
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    lastLogin: {
      type: Date
    },
    lastLogoutAt: {
      type: Date,
      default: null
    },
    forcePasswordChange: {
      type: Boolean,
      default: false
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// ── Backward Compatibility for Dean/Principal Role ──────────────────────────
userSchema.pre('save', function () {
  if (this.role === 'dean_principal' || this.role === 'Dean / Principal') {
    this.role = 'dean';
  }
});

module.exports = mongoose.model("User", userSchema);