const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto')
const PasswordResetToken = require('../models/PasswordResetToken')
require('dotenv').config()

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    return res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/auth/forgot
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset token has been created' })

    // create token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

    await PasswordResetToken.create({ user: user._id, token, expiresAt })

    // In production: send email with reset link containing token. For now return token for local testing
    return res.json({ message: 'Reset token generated', token })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/reset/:token
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params
    const { password } = req.body
    if (!token) return res.status(400).json({ message: 'Token required' })
    if (!password) return res.status(400).json({ message: 'Password required' })

    const record = await PasswordResetToken.findOne({ token })
    if (!record) return res.status(400).json({ message: 'Invalid or expired token' })
    if (record.expiresAt < new Date()) return res.status(400).json({ message: 'Token expired' })

    const user = await User.findById(record.user)
    if (!user) return res.status(400).json({ message: 'User not found' })

    user.password = await bcrypt.hash(password, 10)
    await user.save()

    // remove token after use
    await PasswordResetToken.deleteOne({ _id: record._id })

    return res.json({ message: 'Password reset successful' })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};