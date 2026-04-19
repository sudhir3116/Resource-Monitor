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
  getUserStats,
  getPendingUsers,
  approveUser,
  rejectUser,
  updateStatus
} = require('../controllers/userManagementController');

// All routes require authentication
router.use(auth);

// ── READ ──────────────────────────────────────────────────────────────────────
// Get all users (Admin or GM)
router.get(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  getUsers
);

// Get user stats dashboard
router.get(
  '/stats',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  getUserStats
);

// Get pending users approval list
router.get(
  '/pending-users',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  getPendingUsers
);

// Get single user (Admin or self)
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  getUser
);

// ── CREATE ────────────────────────────────────────────────────────────────────
// Create new user (Admin or GM)
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
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
// Toggle suspend/activate status (Admin or GM, not self)
router.patch(
  '/:id/status',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('UPDATE', 'User'),
  updateStatus
);

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

// Approve User Registration
router.patch(
  '/approve/:id',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('UPDATE', 'User'),
  approveUser
);

// Reject User Registration
router.patch(
  '/reject/:id',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('UPDATE', 'User'),
  rejectUser
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
// Assign user to block
router.put(
  '/:id/assign-block',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  [
    param('id').isMongoId().withMessage('Invalid user id'),
    body('blockId').isMongoId().withMessage('Invalid block id')
  ],
  runValidations,
  auditMiddleware('UPDATE', 'User'),
  assignUserToBlock
);

module.exports = router;
