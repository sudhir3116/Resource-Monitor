/**
 * routes/userManagementRoutes.js
 * User Management Routes - Admin operations for managing users
 */

const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const auth = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  assignUserToBlock,
  getUserStats
} = require('../controllers/userManagementController');

// All routes require authentication
router.use(auth);

// ── READ ──────────────────────────────────────────────────────────────────────
// Get all users (Admin only)
router.get(
  '/',
  authorizeRoles(ROLES.ADMIN),
  getUsers
);

// Get user stats dashboard
router.get(
  '/stats',
  authorizeRoles(ROLES.ADMIN),
  getUserStats
);

// Get single user (Admin or self)
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  getUser
);

// ── CREATE ────────────────────────────────────────────────────────────────────
// Create new user (Admin only)
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(Object.values(ROLES)),
    body('phoneNumber').optional().isMobilePhone()
  ],
  runValidations,
  auditMiddleware('CREATE', 'User'),
  createUser
);

// ── UPDATE ────────────────────────────────────────────────────────────────────
// Update user (Admin or self)
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('email').optional().isEmail(),
    body('phoneNumber').optional().isMobilePhone(),
    body('password').optional().isLength({ min: 6 })
  ],
  runValidations,
  auditMiddleware('UPDATE', 'User'),
  updateUser
);

// ── DELETE ────────────────────────────────────────────────────────────────────
// Delete/suspend user (Admin only)
router.delete(
  '/:id',
  authorizeRoles(ROLES.ADMIN),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('DELETE', 'User'),
  deleteUser
);

// ── ASSIGN TO BLOCK ───────────────────────────────────────────────────────────
// Assign user to block (Admin only)
router.put(
  '/:id/assign-block',
  authorizeRoles(ROLES.ADMIN),
  [
    param('id').isMongoId().withMessage('Invalid user id'),
    body('blockId').isMongoId().withMessage('Invalid block id')
  ],
  runValidations,
  auditMiddleware('UPDATE', 'User'),
  assignUserToBlock
);

module.exports = router;
