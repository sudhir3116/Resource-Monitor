const { SERVER_INSTANCE_ID } = require('../config/runtime');
const { ROLES } = require('../config/roles');
const User = require("../models/User");
const PasswordResetToken = require('../models/PasswordResetToken');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

// Initialize Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const GENERATE_TOKENS = (user) => {
  const payload = {
    id: user._id,
    role: user.role,
    instanceId: SERVER_INSTANCE_ID
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

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
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }
};

// Helper: Format user object consistently
const formatUserResponse = (user) => {
  return {
    id: user._id,
    _id: user._id, // Include both for compatibility
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    provider: user.provider || 'local'
  };
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  let { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("All fields are required");
  }

  email = email.toLowerCase(); // Normalize email

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(409);
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: ROLES.STUDENT,
    provider: 'local'
  });

  const { accessToken, refreshToken } = GENERATE_TOKENS(user);
  SET_COOKIES(res, accessToken, refreshToken);

  res.status(201).json({
    success: true,
    message: "Registered successfully",
    token: accessToken,
    data: formatUserResponse(user)
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  let { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  email = email.toLowerCase(); // Normalize email

  const user = await User.findOne({ email });
  if (!user) {
    console.log(`❌ Login failed: User not found for email ${email}`);
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.log(`❌ Login failed: Password mismatch for user ${email}`);
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const { accessToken, refreshToken } = GENERATE_TOKENS(user);
  SET_COOKIES(res, accessToken, refreshToken);

  console.log('✅ Email/password login successful for:', user.email);

  res.status(200).json({
    success: true,
    message: "Login successful",
    token: accessToken,
    data: formatUserResponse(user)
  });
});

// @desc    Google OAuth Login (ID Token Verification) - Campus-Wide
// @route   POST /api/auth/google
// @access  Public
const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400);
    throw new Error("Google ID token is required");
  }

  try {
    // Verify the Google ID token
    console.log('🔍 Verifying Google ID token...');
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    console.log('✅ Google token verified successfully');
    console.log('📧 Email:', payload.email);
    console.log('👤 Name:', payload.name);

    // Optional: Check email domain restriction for campus-wide deployment
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS;
    if (allowedDomains && allowedDomains.trim() !== '') {
      const domains = allowedDomains.split(',').map(d => d.trim().toLowerCase());
      const userDomain = payload.email.split('@')[1].toLowerCase();

      if (!domains.includes(userDomain)) {
        console.log('❌ Email domain not allowed:', userDomain);
        console.log('✅ Allowed domains:', domains);
        res.status(403);
        throw new Error(`Access restricted. Only ${domains.join(', ')} email addresses are allowed.`);
      }
      console.log('✅ Email domain check passed:', userDomain);
    } else {
      console.log('ℹ️  No domain restriction - accepting any Google account');
    }

    // Check if user exists
    let user = await User.findOne({ email: payload.email });

    if (user) {
      console.log('👤 Existing user found - ID:', user._id);
      // Update Google ID and avatar if not set
      if (!user.googleId) {
        user.googleId = payload.sub;
        user.provider = 'google';
        if (!user.avatar && payload.picture) {
          user.avatar = payload.picture;
        }
        await user.save();
        console.log('✅ Updated existing user with Google info');
      }
    } else {
      console.log('🆕 Creating new user from Google account');

      // Create new user with default student role
      user = await User.create({
        name: payload.name,
        email: payload.email,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        googleId: payload.sub,
        provider: 'google',
        avatar: payload.picture,
        role: ROLES.STUDENT // Default role - admin can update later
      });
      console.log('✅ New user created with STUDENT role - ID:', user._id);
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = GENERATE_TOKENS(user);
    SET_COOKIES(res, accessToken, refreshToken);

    console.log('✅ Google login successful for:', user.email, '- Role:', user.role);

    // Return consistent user object structure
    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: formatUserResponse(user)
    });
  } catch (error) {
    console.error('❌ Google login error:', error.message);

    // Handle specific errors
    if (error.message && error.message.includes('Token used too late')) {
      res.status(401);
      throw new Error('Google token expired. Please try logging in again.');
    }

    if (error.message && error.message.includes('Invalid token signature')) {
      res.status(401);
      throw new Error('Invalid Google token. Please try again.');
    }

    if (error.message && error.message.includes('Access restricted')) {
      throw error; // Already has proper status code
    }

    res.status(400);
    throw new Error(`Google authentication failed: ${error.message}`);
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // If authenticated, mark lastLogoutAt to invalidate tokens
  try {
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, { lastLogoutAt: new Date() });
    }
  } catch (e) {
    // proceed to clear cookies even if DB write fails
    console.error('Failed to set lastLogoutAt during logout:', e.message);
  }

  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax'
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/refresh'
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

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


    // Check if token is from a previous server instance (or missing instanceId)
    if (!decoded.instanceId || decoded.instanceId !== SERVER_INSTANCE_ID) {
      // Clear invalid cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      res.status(403);
      throw new Error('Session expired (server reset or invalid token). Please log in again.');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      // Clear cookies for non-existent user
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      res.status(401);
      throw new Error('User account not found');
    }

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

    res.json({ success: true, message: 'Refreshed', token: accessToken });
  } catch (err) {
    // Clear cookies on any error to prevent infinite retry loops
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    // Provide specific error message
    if (err.name === 'TokenExpiredError') {
      res.status(403);
      throw new Error('Refresh token expired. Please log in again.');
    }
    if (err.message && err.message.includes('server reset')) {
      throw err; // Already has proper status and message
    }
    if (err.message && err.message.includes('User account not found')) {
      throw err; // Already has proper status and message
    }

    res.status(403);
    // Generic message for other JWT errors (invalid signature, malformed)
    throw new Error('Invalid authentication session. Please log in again.');
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const verifyToken = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    res.status(401);
    throw new Error("User not found");
  }

  // Return consistent user object
  res.status(200).json({
    success: true,
    data: formatUserResponse(user)
  });
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
    return res.status(200).json({
      success: true,
      message: 'If that email exists, a reset token has been sent.'
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await PasswordResetToken.create({ user: user._id, token, expiresAt });

  res.json({
    success: true,
    message: 'Reset token generated (check console/email)',
    token
  });
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
  formatUserResponse,
  register,
  login,
  googleLogin,
  logout,
  refresh,
  verifyToken,
  forgotPassword,
  resetPassword
};