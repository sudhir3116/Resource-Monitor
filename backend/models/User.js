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
      enum: [null, ...Object.values(require('../config/roles').ROLES), 'STUDENT', 'WARDEN', 'ADMIN', 'DEAN', 'PRINCIPAL'],
      default: null,
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
      enum: ["PENDING", "APPROVED", "REJECTED", 'active', 'suspended', 'graduated', 'pending', 'approved', 'rejected'],
      default: "PENDING" // Default pending for strict approval flow
    },
    isApproved: {
      type: Boolean,
      default: false
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

// Role definitions are managed in config/roles.js

module.exports = mongoose.model("User", userSchema);