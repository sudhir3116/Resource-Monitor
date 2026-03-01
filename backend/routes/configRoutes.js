const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const { body, param } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');
const {
    getThresholds,
    getResourceThreshold,
    createThreshold,
    updateThreshold,
    updateThresholdById,
    bulkUpdateThresholds,
    setBlockOverride,
    removeBlockOverride,
    deleteThreshold,
    getBlocks
} = require('../controllers/configController');

// All routes require authentication
router.use(authMiddleware);

// ── Read routes (Admin + Warden can view) ──────────────────────────────────
router.get('/thresholds', getThresholds);
router.get('/thresholds/:resource', getResourceThreshold);
router.get('/blocks', getBlocks);

// ── Write routes (Admin only) ──────────────────────────────────────────────
router.post(
    '/thresholds',
    authorizeRoles(ROLES.ADMIN),
        [
            body('resource').notEmpty().withMessage('resource is required'),
            body('dailyThreshold').optional().isNumeric(),
            body('monthlyThreshold').optional().isNumeric(),
            body('unit').optional().isString()
        ],
        runValidations,
        auditMiddleware('CREATE', 'SystemConfig'),
        createThreshold
);

router.put(
    '/thresholds/bulk-update',
    authorizeRoles(ROLES.ADMIN),
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    bulkUpdateThresholds
);

// PUT / PATCH by resource name (primary endpoint used by UI)
router.put(
    '/thresholds/:resource',
    authorizeRoles(ROLES.ADMIN),
    [param('resource').notEmpty().withMessage('resource required')],
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    updateThreshold
);

// PATCH alias — supports partial updates, same handler
router.patch(
    '/thresholds/:resource',
    authorizeRoles(ROLES.ADMIN),
    [param('resource').notEmpty().withMessage('resource required')],
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    updateThreshold
);

// PUT by MongoDB _id (alternative for callers who have the document ID)
router.put(
    '/thresholds/by-id/:id',
    authorizeRoles(ROLES.ADMIN),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    updateThresholdById
);

router.put(
    '/thresholds/:resource/block-override/:blockId',
    authorizeRoles(ROLES.ADMIN),
    [param('resource').notEmpty().withMessage('resource required'), param('blockId').isMongoId().withMessage('Invalid blockId')],
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    setBlockOverride
);

router.delete(
    '/thresholds/:resource/block-override/:blockId',
    authorizeRoles(ROLES.ADMIN),
    [param('resource').notEmpty().withMessage('resource required'), param('blockId').isMongoId().withMessage('Invalid blockId')],
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    removeBlockOverride
);

router.delete(
    '/thresholds/:resource',
    authorizeRoles(ROLES.ADMIN),
    [param('resource').notEmpty().withMessage('resource required')],
    runValidations,
    auditMiddleware('DELETE', 'SystemConfig'),
    deleteThreshold
);

module.exports = router;
