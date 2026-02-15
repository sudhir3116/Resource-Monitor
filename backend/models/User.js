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
    }
  },
  { timestamps: true }
);



module.exports = mongoose.model("User", userSchema);