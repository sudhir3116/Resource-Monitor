/**
 * routes/alertsRoutes.js
 * Clean, validated routes for Alerts module
 *
 * Role permission matrix:
 *   READ:      Admin, GM, Warden (own block), Dean, Principal, Student (own block)
 *   INVESTIGATE: Warden, Admin, GM
 *   RESOLVE:   Admin, GM only  (Wardens cannot close alerts)
 *   ESCALATE:  Admin, GM
 *   DISMISS:   Admin, GM
 *   REOPEN:    Admin, GM
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { authorizeRoles: authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const { param, body, query } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

const {
  getAlerts,
  getAlert,
  getAlertCount,
  createAlert,
  investigateAlert,
  reviewAlert,
  resolveAlert,
  dismissAlert,
  acknowledgeAlert,
  escalateAlert,
  reopenAlert,
  addComment,
  getAlertStats,
  getAlertAnalytics,
  getSystemAlerts,
  getAlertRules,
  updateAlertRule,
  deleteAlertRule,
  exportAlertsCSV,
  exportAlertsPDF,
} = require('../controllers/alertsController');

const GM = ROLES.GM;

// All routes require authentication
router.use(auth);

// ── READ ──────────────────────────────────────────────────────────────────────
router.get('/', authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT), getAlerts);
router.get('/system', authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL), getSystemAlerts);
router.get('/count', authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT), getAlertCount);
router.get('/stats', authorize(ROLES.ADMIN, GM, ROLES.DEAN, ROLES.WARDEN, ROLES.PRINCIPAL), getAlertStats);
router.get('/analytics', authorize(ROLES.ADMIN, GM, ROLES.DEAN, ROLES.PRINCIPAL), getAlertAnalytics);
router.get('/rules', authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL), getAlertRules);
router.get('/:id', authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT),
  [param('id').isMongoId().withMessage('Invalid id')], runValidations, getAlert);

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/',
  authorize(ROLES.ADMIN, ROLES.WARDEN),
  [
    body('resourceType').notEmpty().withMessage('resourceType is required'),
    body('message').notEmpty().withMessage('message is required'),
  ],
  runValidations,
  auditMiddleware('CREATE', 'Alert'),
  createAlert
);

// ── COMMENTS ──────────────────────────────────────────────────────────────────
router.post('/:id/comment',
  authorize(ROLES.ADMIN, GM, ROLES.WARDEN),
  [param('id').isMongoId().withMessage('Invalid id'), body('comment').notEmpty().withMessage('comment is required')],
  runValidations,
  auditMiddleware('ADD_COMMENT', 'Alert'),
  addComment
);

// ── LIFECYCLE ─────────────────────────────────────────────────────────────────

// Wardens can investigate (flag for review); they cannot close alerts.
router.put('/:id/investigate',
  authorize(ROLES.WARDEN, ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('REVIEW_ALERT', 'Alert'),
  investigateAlert
);

// Acknowledge: GM, Dean, Principal, Admin
router.put('/:id/acknowledge',
  authorize(ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('REVIEW_ALERT', 'Alert'),
  acknowledgeAlert
);

// Review: GM, Warden, Admin (Dean/Principal read-only, do not mark Reviewed)
router.put('/:id/review',
  authorize(ROLES.WARDEN, ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('REVIEW_ALERT', 'Alert'),
  reviewAlert
);

// RESOLVE: Admin and General Manager ONLY — Wardens cannot resolve
router.put('/:id/resolve',
  authorize(ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id')],
  runValidations,
  auditMiddleware('RESOLVE_ALERT', 'Alert'),
  resolveAlert
);

// DISMISS: Admin and GM only (Wardens cannot dismiss)
router.put('/:id/dismiss',
  authorize(ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id'), body('reason').optional().isString()],
  runValidations,
  auditMiddleware('DISMISS_ALERT', 'Alert'),
  dismissAlert
);

// ESCALATE: Admin and GM
router.put('/:id/escalate',
  authorize(ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id'), body('reason').optional().isString()],
  runValidations,
  auditMiddleware('RESOLVE_ALERT', 'Alert'),
  escalateAlert
);

// REOPEN: Admin and GM
router.put('/:id/reopen',
  authorize(ROLES.ADMIN, GM),
  [param('id').isMongoId().withMessage('Invalid id'), body('reason').optional().isString()],
  runValidations,
  auditMiddleware('RESOLVE_ALERT', 'Alert'),
  reopenAlert
);

// ── RULE MANAGEMENT ───────────────────────────────────────────────────────────
router.patch('/:id', [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('UPDATE', 'Alert'), updateAlertRule);
router.delete('/:id', [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('DELETE', 'Alert'), deleteAlertRule);

// ── EXPORT ROUTES ─────────────────────────────────────────────────────────────
router.get(
  '/export/csv',
  authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
  exportAlertsCSV
);

router.get(
  '/export/pdf',
  authorize(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
  exportAlertsPDF
);

module.exports = router;
