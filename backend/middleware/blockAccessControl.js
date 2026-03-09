/**
 * block-access-control.js
 * Middleware to enforce block-based data access
 * Wardens can only view/edit data for their assigned block
 */

const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Middleware to verify block access
 * Extracts blockId from query/body and verifies user has access
 * 
 * Usage:
 * router.get('/usage', checkBlockAccess, controller.getUsage)
 */
exports.checkBlockAccess = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Admins have access to all blocks
    if (user.role === 'admin' || user.role === 'gm') {
      return next();
    }

    // Wardens can only access their assigned block
    if (user.role === 'warden') {
      if (!user.block) {
        return res.status(403).json({ 
          success: false, 
          message: 'Warden not assigned to a block' 
        });
      }

      // Check if requested blockId matches user's block
      const requestedBlockId = req.query.blockId || req.body.blockId;
      
      if (requestedBlockId) {
        if (!mongoose.Types.ObjectId.isValid(requestedBlockId)) {
          return res.status(400).json({ success: false, message: 'Invalid block ID' });
        }
        
        const matches = requestedBlockId === user.block.toString() || 
                       requestedBlockId === user.block;
        
        if (!matches) {
          return res.status(403).json({ 
            success: false, 
            message: 'You can only access data from your assigned block' 
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('Block access check error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Middleware to automatically attach user's block to queries
 * Useful for list/search endpoints
 * 
 * Usage:
 * router.get('/usage', attachBlockFilter, controller.getUsage)
 */
exports.attachBlockFilter = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next();
    }

    // For wardens, automatically filter by their block
    if (user.role === 'warden' && user.block) {
      req.query.blockId = user.block.toString();
    }

    next();
  } catch (error) {
    console.error('Attach block filter error:', error);
    next();
  }
};

/**
 * Verify user can access specific student/user record
 * Students can only view their own data
 * Wardens can view students in their block
 */
exports.checkStudentAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const targetUserId = req.params.id || req.params.userId;

    if (!user || !targetUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Admins have full access
    if (user.role === 'admin' || user.role === 'gm') {
      return next();
    }

    // Students can only view their own data
    if (user.role === 'student') {
      if (user._id.toString() !== targetUserId && user.id !== targetUserId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Cannot access another student\'s data' 
        });
      }
      return next();
    }

    // Wardens can view students in their block
    if (user.role === 'warden') {
      const targetUser = await User.findById(targetUserId).select('block');
      
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetBlockId = targetUser.block ? targetUser.block.toString() : null;
      const userBlockId = user.block ? user.block.toString() : null;

      if (targetBlockId !== userBlockId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Can only access students in your assigned block' 
        });
      }
    }

    next();
  } catch (error) {
    console.error('Student access check error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verify user can access specific complaint/usage record
 */
exports.checkDataAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const recordId = req.params.id;

    if (!user || !recordId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Admins have full access
    if (user.role === 'admin' || user.role === 'gm') {
      return next();
    }

    // Store the check for controller to verify
    req.hasDataAccess = true;
    req.accessCheckRequired = user.role === 'warden';

    next();
  } catch (error) {
    console.error('Data access check error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
