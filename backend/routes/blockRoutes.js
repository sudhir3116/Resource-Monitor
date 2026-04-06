/**
 * routes/blockRoutes.js
 * Block Management Routes - CRUD operations on hostel blocks
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
  getBlocks,
  getBlock,
  createBlock,
  updateBlock,
  deleteBlock,
  assignWarden,
  getPublicBlocks
} = require('../controllers/blockController');

// Public route for registration
router.get('/public', getPublicBlocks);

// All other routes require authentication
router.use(auth);

const GM = ROLES.GM;

// ── READ ──────────────────────────────────────────────────────────────────────
// Blockscan be read by Admin, GM, Warden, Dean, Principal
router.get(
  '/',
  authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
  getBlocks
);

router.get(
  '/:id',
  authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  getBlock
);

// ── CREATE ────────────────────────────────────────────────────────────────────
// Only Admin can create blocks
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN),
  [
    body('name').notEmpty().withMessage('Block name is required'),
    body('type').optional().isIn(['Hostel', 'Academic', 'Administrative', 'Service']),
    body('capacity').optional().isInt({ min: 0 })
  ],
  runValidations,
  auditMiddleware('CREATE', 'Block'),
  createBlock
);

// ── UPDATE ────────────────────────────────────────────────────────────────────
// Admin & GM can update blocks
router.patch(
  '/:id',
  authorizeRoles(ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('UPDATE', 'Block'),
  updateBlock
);

// ── DELETE ────────────────────────────────────────────────────────────────────
// Only Admin can delete blocks
router.delete(
  '/:id',
  authorizeRoles(ROLES.ADMIN),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('DELETE', 'Block'),
  deleteBlock
);

// ── ASSIGN WARDEN ─────────────────────────────────────────────────────────────
// Admin & GM can assign wardens to blocks
router.put(
  '/:id/assign-warden',
  authorizeRoles(ROLES.ADMIN, GM),
  [
    param('id').isMongoId().withMessage('Invalid block id'),
    body('wardenId').isMongoId().withMessage('Invalid warden id')
  ],
  runValidations,
  auditMiddleware('UPDATE', 'Block'),
  assignWarden
);

module.exports = router;
