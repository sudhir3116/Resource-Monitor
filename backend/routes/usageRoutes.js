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

const {
    getUsageSummary,
    getUsageTrends
} = require('../services/usageService')

// Standard summary endpoint — all roles
router.get('/summary',
    authorizeRoles(
        ROLES.ADMIN, GM, ROLES.WARDEN,
        ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT
    ),
    async (req, res) => {
        try {
            const { startDate, endDate, blockId } = req.query;
            let finalBlockId = blockId || null;
            if (typeof finalBlockId === 'string' && finalBlockId.includes('[object')) finalBlockId = null;

            if (!finalBlockId && ['warden', 'student'].includes(req.user.role)) {
                finalBlockId = req.userObj?.block?._id || req.userObj?.block || req.user?.block?._id || req.user?.block || null;
            }
            if (finalBlockId && typeof finalBlockId === 'object') finalBlockId = finalBlockId._id || finalBlockId.toString();

            const data = await getUsageSummary({
                role: req.user.role,
                userId: req.user.id || req.userId,
                blockId: finalBlockId,
                startDate,
                endDate
            });
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
)

// Standard trends endpoint — all roles
router.get('/trends',
    authorizeRoles(
        ROLES.ADMIN, GM, ROLES.WARDEN,
        ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT
    ),
    async (req, res) => {
        try {
            const { range = '7d', blockId } = req.query;
            let finalBlockId = blockId || null;
            if (typeof finalBlockId === 'string' && finalBlockId.includes('[object')) finalBlockId = null;

            if (!finalBlockId && ['warden', 'student'].includes(req.user.role)) {
                finalBlockId = req.userObj?.block?._id || req.userObj?.block || req.user?.block?._id || req.user?.block || null;
            }
            if (finalBlockId && typeof finalBlockId === 'object') finalBlockId = finalBlockId._id || finalBlockId.toString();

            const data = await getUsageTrends({
                role: req.user.role,
                userId: req.user.id || req.userId,
                blockId: finalBlockId,
                range
            });
            return res.status(200).json({ success: true, data });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
)
router.get('/stats', usageController.getDashboardStats)

// Usage list and detail — all roles view their respective data
router.get('/', authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT), usageController.getUsages)
router.get('/:id', authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.STUDENT), usageController.getUsage)

// Write routes — ONLY Admin and Warden can CREATE usage records
// Students, Dean, Principal, GM are BLOCKED at middleware level (403 Forbidden)
router.post(
    '/',
    wardenMiddleware,
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
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
    usageController.exportUsageCSV
)

router.get(
    '/export/pdf',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
    usageController.exportUsagePDF
)

// ── METRICS ROUTES ───────────────────────────────────────────────────────────
router.get(
    '/metrics/efficiency',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
    usageController.getEfficiencyMetrics
)

router.get(
    '/anomalies',
    authorizeRoles(ROLES.ADMIN, GM, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL),
    usageController.getAnomalies
)

module.exports = router
