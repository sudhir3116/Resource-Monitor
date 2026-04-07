const { SERVER_INSTANCE_ID } = require('../config/runtime');
const { ROLES } = require('../config/roles');
const User = require("../models/User");
const PasswordResetToken = require('../models/PasswordResetToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const { OAuth2Client } = require('google-auth-library');
const Block = require("../models/Block");
require('dotenv').config();

const getBlockFromEmail = async (email) => {
  if (!email) return null;
  const e = email.toLowerCase();
  let blockName = null;
  if (e.includes('_a@college')) blockName = 'Block A';
  else if (e.includes('_b@college')) blockName = 'Block B';

  if (blockName) {
    const block = await Block.findOne({ name: blockName });
    return block ? block._id : null;
  }
  return null;
};

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
    { expiresIn: '7d' } // Long-lived token as requested
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
    block: user.block || null,  // populated Block object {_id, name} or raw ObjectId
    room: user.room || null,
    department: user.department || null,
    avatar: user.avatar || null,
    status: user.status || 'active',
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
  let { name, email, password, blockId } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("All fields are required");
  }

  email = email.toLowerCase(); // Normalize email
  
  // Try auto-detection, fallback to provided blockId
  const autoBlockId = await getBlockFromEmail(email);
  const finalBlockId = autoBlockId || blockId;

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
    role: null, // Role assignment delayed until after approval
    block: finalBlockId || null,
    provider: 'local',
    status: 'PENDING',
    isApproved: false
  });

  // Notify admins via alert
  try {
    const Alert = require('../models/Alert');
    await Alert.create({
      resourceType: 'User',
      severity: 'medium',
      message: `New user registration pending approval: ${email}`,
      status: 'active'
    });

    const socketUtil = require('../utils/socket');
    const io = socketUtil.getIO && socketUtil.getIO();
    if (io) {
      io.emit('alerts:refresh');
      io.emit('dashboard:refresh');
      io.emit('users:refresh');
    }
  } catch(e) {}

  res.status(201).json({
    success: true,
    message: "Registration submitted. Waiting for admin approval.",
    user: formatUserResponse(user)
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

  console.log("Login attempt:", email);
  const user = await User.findOne({ email }).populate('block', 'name');
  console.log("User found:", user);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Check suspension status
  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the administrator.' });
  }

  // STRICT VALIDATION: Check Approval Status
  if (user.status !== "APPROVED") {
    // Check for legacy lowercase status just in case, but prioritize the new Uppercase
    if (user.status !== 'approved' && user.status !== 'active') {
        return res.status(403).json({ success: false, message: "Your account is not approved yet" });
    }
  }
  
  // STRICT VALIDATION: Check Role Assignment
  if (!user.role) {
    return res.status(403).json({ success: false, message: "Your role is not assigned yet. Please contact admin" });
  }

  // Handle existing users with plain passwords (Task 5 from previous instruction, Task 1 from this one if needed)
  if (!user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;
    await user.save();
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Auto-assign block based on email pattern if not already assigned
  const autoBlockId = await getBlockFromEmail(user.email);
  if (!user.block && autoBlockId) {
    user.block = autoBlockId;
    await user.save();
    console.log('✅ Retroactively assigned block to user:', user.email);
  }

  const { accessToken, refreshToken } = GENERATE_TOKENS(user);
  SET_COOKIES(res, accessToken, refreshToken);

  console.log('✅ Email/password login successful for:', user.email);

  // Return full formatted user object for consistency with Task 5 requirement
  res.status(200).json({
    success: true,
    token: accessToken,
    user: formatUserResponse(user),
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
    let user = await User.findOne({ email: payload.email }).populate('block', 'name');
    const autoBlockId = await getBlockFromEmail(payload.email);

    if (user) {
      console.log('👤 Existing user found - ID:', user._id);

      // Check suspension status
      if (user.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the administrator.' });
      }

      // Approval Blocking Logic
      if (user.status?.toUpperCase() === "PENDING") {
        return res.status(403).json({ success: false, message: "Waiting for admin approval" });
      }
      if (user.status?.toUpperCase() === "REJECTED") {
        return res.status(403).json({ success: false, message: "Your request was rejected" });
      }
      if (!user.isApproved && user.status?.toUpperCase() !== 'APPROVED') {
        return res.status(403).json({ success: false, message: "Not approved yet" });
      }
      // Update Google ID and avatar if not set
      let needsSave = false;
      if (!user.googleId) {
        user.googleId = payload.sub;
        user.provider = 'google';
        needsSave = true;
      }
      if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
        needsSave = true;
      }
      if (!user.block && autoBlockId) {
        user.block = autoBlockId;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
        console.log('✅ Updated existing user with Google info and block assignment');
      }
    } else {
      console.log('🆕 Creating new user from Google account');

      // Create new user with default student role and pending status
      user = await User.create({
        name: payload.name,
        email: payload.email,
        password: await bcrypt.hash(Math.random().toString(36), 10),
        googleId: payload.sub,
        provider: 'google',
        avatar: payload.picture,
        block: autoBlockId || null,
        role: ROLES.STUDENT, // Default role
        status: 'PENDING',
        isApproved: false
      });
      console.log('✅ New user created with STUDENT role - ID:', user._id, 'Block:', autoBlockId || 'None');

      // Notify admins via alert
      try {
        const Alert = require('../models/Alert');
        await Alert.create({
          resourceType: 'User',
          severity: 'medium',
          message: `New Google integration pending approval: ${payload.email}`,
          status: 'active'
        });

        const socketUtil = require('../utils/socket');
        const io = socketUtil.getIO && socketUtil.getIO();
        if (io) io.emit('alerts:refresh');
      } catch(e) {}

      return res.status(201).json({
        success: true,
        message: "Registration successful. Await admin approval.",
        user: formatUserResponse(user)
      });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = GENERATE_TOKENS(user);
    SET_COOKIES(res, accessToken, refreshToken);

    console.log('✅ Google login successful for:', user.email, '- Role:', user.role);

    // Return full formatted user object for consistency with email/password login
    res.status(200).json({
      success: true,
      message: "Google login successful",
      token: accessToken,
      user: formatUserResponse(user),
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

  // If authenticated, mark lastLogoutAt and blacklist the token
  try {
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, { lastLogoutAt: new Date() });
    }

    // Blacklist the current access token so it cannot be reused even within its TTL
    let token = null;
    if (req.headers['authorization']?.startsWith('Bearer ')) {
      token = req.headers['authorization'].split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (token) {
      try {
        const decoded = jwt.decode(token);
        const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
        await TokenBlacklist.findOneAndUpdate(
          { token },
          { token, expiresAt },
          { upsert: true, new: true }
        );
      } catch (blacklistErr) {
        console.error('Failed to blacklist token on logout:', blacklistErr.message);
      }
    }
  } catch (e) {
    // proceed to clear cookies even if DB write fails
    console.error('Failed to process logout cleanup:', e.message);
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


    const user = await User.findById(decoded.id);
    if (!user) {
      // Clear cookies for non-existent user
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      res.status(401);
      throw new Error('User account not found');
    }

    // Block refresh for suspended accounts
    if (user.status === 'suspended') {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      res.status(403);
      throw new Error('Your account has been suspended. Please contact the administrator.');
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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

  // Populate block so wardens get { _id, name } in the user object
  const user = await User.findById(req.user.id)
    .select("-password")
    .populate('block', 'name');

  if (!user) {
    res.status(401);
    throw new Error("User not found");
  }

  // Return full user object including block assignment for session restore
  res.status(200).json({
    success: true,
    user: formatUserResponse(user),
    data: formatUserResponse(user)  // Include 'data' for consistency
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