/**
 * routes/alertsRoutes.js
 * Clean, validated routes for Alerts module
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
  addComment,
  getAlertStats,
  getAlertAnalytics,
  getSystemAlerts,
  getAlertRules,
  updateAlertRule,
  deleteAlertRule,
} = require('../controllers/alertsController');

// All routes require authentication
router.use(auth);

// READ
router.get('/', getAlerts);
router.get('/system', getSystemAlerts);
router.get('/count', getAlertCount);
router.get('/stats', authorize(ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.WARDEN), getAlertStats);
router.get('/analytics', authorize(ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL), getAlertAnalytics);
router.get('/rules', getAlertRules);
router.get('/:id', [param('id').isMongoId().withMessage('Invalid id')], runValidations, getAlert);

// CREATE
router.post('/',
  authorize(ROLES.ADMIN, ROLES.WARDEN),
  [body('resourceType').notEmpty().withMessage('resourceType is required'), body('message').notEmpty().withMessage('message is required')],
  runValidations,
  auditMiddleware('CREATE', 'Alert'),
  createAlert
);

// COMMENTS
router.post('/:id/comment',
  authorize(ROLES.ADMIN, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
  [param('id').isMongoId().withMessage('Invalid id'), body('comment').notEmpty().withMessage('comment is required')],
  runValidations,
  auditMiddleware('ADD_COMMENT', 'Alert'),
  addComment
);

// LIFECYCLE
router.put('/:id/investigate', authorize(ROLES.WARDEN, ROLES.ADMIN), [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('REVIEW_ALERT', 'Alert'), investigateAlert);
router.put('/:id/acknowledge', authorize(ROLES.WARDEN, ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL), [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('REVIEW_ALERT', 'Alert'), acknowledgeAlert);
router.put('/:id/review', authorize(ROLES.WARDEN, ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL), [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('REVIEW_ALERT', 'Alert'), reviewAlert);
router.put('/:id/resolve', authorize(ROLES.WARDEN, ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL), [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('RESOLVE_ALERT', 'Alert'), resolveAlert);
router.put('/:id/dismiss', authorize(ROLES.ADMIN, ROLES.WARDEN), [param('id').isMongoId().withMessage('Invalid id'), body('reason').optional().isString()], runValidations, auditMiddleware('DISMISS_ALERT', 'Alert'), dismissAlert);

// RULE MANAGEMENT
router.patch('/:id', [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('UPDATE', 'Alert'), updateAlertRule);
router.delete('/:id', [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('DELETE', 'Alert'), deleteAlertRule);

module.exports = router;
