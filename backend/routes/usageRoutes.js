const express = require('express')
const router = express.Router()
const usageController = require('../controllers/usageController')
const protect = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')
const { ROLES } = require('../config/roles')
const { body, param } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

// All routes require authentication
router.use(protect)

// Read-only routes — all authenticated roles can access
router.get('/trends', usageController.getUsageTrends)
router.get('/stats', usageController.getDashboardStats)
router.get('/', usageController.getUsages)
router.get('/:id', usageController.getUsage)

// Write routes — ONLY Admin and Warden
// Students, Dean, Principal are BLOCKED at middleware level (403 Forbidden)
router.post(
        '/',
        authorizeRoles(ROLES.ADMIN, ROLES.WARDEN),
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
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Usage'),
    usageController.updateUsage
)

// Also support PUT for clients that use it
router.put(
    '/:id',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Usage'),
    usageController.updateUsage
)

router.delete(
    '/:id',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('DELETE', 'Usage'),
    usageController.deleteUsage
)

module.exports = router
