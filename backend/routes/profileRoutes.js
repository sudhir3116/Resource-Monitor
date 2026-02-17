const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../middleware/asyncHandler');

// Helper: Format user object consistently (same as authController)
const formatUserResponse = (user) => {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
    provider: user.provider || 'local',
    block: user.block,
    room: user.room,
    floor: user.floor
  };
};

// GET /api/profile - returns authenticated user's profile
router.get('/', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password').populate('block');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({
    success: true,
    user: formatUserResponse(user)
  });
}));

// PUT /api/profile - update profile details
router.put('/', auth, asyncHandler(async (req, res) => {
  const { name, avatar } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Update allowed fields
  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar; // Allow empty string to remove avatar

  await user.save();

  // Return updated user without password
  const updatedUser = await User.findById(req.user.id).select('-password');

  console.log('✅ Profile updated for:', user.email);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: formatUserResponse(updatedUser)
  });
}));

// PUT /api/profile/password - change password
router.put('/password', auth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Both current and new passwords are required');
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if this is a Google account
  if (user.provider === 'google') {
    res.status(400);
    throw new Error('Cannot change password for Google accounts. Please manage your password through Google.');
  }

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  // Hash and save new password
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  console.log('✅ Password changed for:', user.email);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

module.exports = router;
