const express = require('express')
const router = express.Router()
const usageController = require('../controllers/usageController')
const protect = require('../middleware/authMiddleware')
const wardenMiddleware = require('../middleware/wardenMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')
const { ROLES } = require('../config/roles')
const { body, param } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

const GM = ROLES.GM;

// All routes require authentication
router.use(protect)

// Stats/trends — accessible to all authenticated users (student dashboard uses these)
router.get('/trends', usageController.getUsageTrends)
router.get('/stats', usageController.getDashboardStats)

// Usage list and detail — blocked for students (403)
// General Manager gets full campus visibility alongside Dean/Principal/Admin
router.get('/', authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN), usageController.getUsages)
router.get('/:id', authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN), usageController.getUsage)

// Write routes — ONLY Admin and Warden can CREATE usage records
// Students, Dean, Principal, GM are BLOCKED at middleware level (403 Forbidden)
router.post(
    '/',
    wardenMiddleware,
    [
        body('resourceType').notEmpty().withMessage('resourceType is required'),
        body('amount').not().isEmpty().withMessage('amount is required').bail().isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
        body('date').optional().isISO8601().toDate().withMessage('date must be a valid ISO date'),
    ],
    runValidations,
    auditMiddleware('CREATE', 'Usage'),
    usageController.createUsage
)

router.patch(
    '/:id',
    wardenMiddleware,
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Usage'),
    usageController.updateUsage
)

// Also support PUT for clients that use it
router.put(
    '/:id',
    wardenMiddleware,
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Usage'),
    usageController.updateUsage
)

// DELETE — restricted to Admin and General Manager ONLY.
// Wardens CANNOT delete records (enforced at both route and controller level).
router.delete(
    '/:id',
    authorizeRoles(ROLES.ADMIN, GM),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('DELETE', 'Usage'),
    usageController.deleteUsage
)

// ── EXPORT ROUTES ────────────────────────────────────────────────────────────
router.get(
    '/export/csv',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN),
    usageController.exportUsageCSV
)

router.get(
    '/export/pdf',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN),
    usageController.exportUsagePDF
)

// ── METRICS ROUTES ───────────────────────────────────────────────────────────
router.get(
    '/metrics/efficiency',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN),
    usageController.getEfficiencyMetrics
)

router.get(
    '/anomalies',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN),
    usageController.getAnomalies
)

module.exports = router
