const { SERVER_INSTANCE_ID } = require('../config/runtime');
const { ROLES } = require('../config/roles');
const User = require("../models/User");
const PasswordResetToken = require('../models/PasswordResetToken');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
require('dotenv').config();

const GENERATE_TOKENS = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    instanceId: SERVER_INSTANCE_ID // Bind token to current server instance
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Refresh token also needs instanceId to be invalidated on restart
  const refreshToken = jwt.sign(
    { id: user._id, instanceId: SERVER_INSTANCE_ID },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

const SET_COOKIES = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax', // Required for Google OAuth redirect flow
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax', // Must match accessToken policy
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("All fields are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(409);
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Public registration is restricted to Students only
  // Admins must be created via Seed script or by another Admin
  const userRole = ROLES.STUDENT;

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: userRole
  });

  const { accessToken, refreshToken } = GENERATE_TOKENS(user);
  SET_COOKIES(res, accessToken, refreshToken);

  res.status(201).json({
    success: true,
    message: "Registered successfully",
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const { accessToken, refreshToken } = GENERATE_TOKENS(user);
  SET_COOKIES(res, accessToken, refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (with cookie)
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    res.status(401);
    throw new Error('No refresh token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Critical Security Check: Instance ID (Server Restart Validation)
    if (decoded.instanceId !== SERVER_INSTANCE_ID) {
      res.status(403);
      throw new Error('Session expired (server restart)');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401);
      throw new Error('User not found');
    }

    // Issue new access token
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, instanceId: SERVER_INSTANCE_ID },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json({ success: true, message: 'Refreshed' });
  } catch (err) {
    res.status(403); // Forbidden implies invalid token logic
    throw new Error('Invalid refresh token');
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const verifyToken = asyncHandler(async (req, res) => {
  // req.user is populated by authMiddleware
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    res.status(401);
    throw new Error("User not found");
  }
  res.status(200).json({ success: true, user });
});

// @desc    Request Password Reset
// @route   POST /api/auth/forgot
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Email required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Fail silently for security
    return res.status(200).json({ success: true, message: 'If that email exists, a reset token has been sent.' });
  }

  // create token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await PasswordResetToken.create({ user: user._id, token, expiresAt });

  // In production: send email with reset link. For now returning context.
  res.json({ success: true, message: 'Reset token generated (check console/email)', token });
});

// @desc    Reset Password
// @route   POST /api/auth/reset/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token || !password) {
    res.status(400);
    throw new Error('Token and password required');
  }

  const record = await PasswordResetToken.findOne({ token });
  if (!record) {
    res.status(400);
    throw new Error('Invalid or expired token');
  }
  if (record.expiresAt < new Date()) {
    res.status(400);
    throw new Error('Token expired');
  }

  const user = await User.findById(record.user);
  if (!user) {
    res.status(400);
    throw new Error('User not found');
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  await PasswordResetToken.deleteOne({ _id: record._id });

  res.json({ success: true, message: 'Password reset successful' });
});

module.exports = {
  GENERATE_TOKENS,
  SET_COOKIES,
  register,
  login,
  logout,
  refresh,
  verifyToken,
  forgotPassword,
  resetPassword
};