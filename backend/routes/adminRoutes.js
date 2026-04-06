const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const configController = require('../controllers/configController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const CronLog = require('../models/CronLog');
const { ROLES } = require('../config/roles');
const { param, body } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

router.use(authMiddleware);
router.use(adminMiddleware);

// ── User management ──────────────────────────────────────────────────────────
router.get('/users', adminController.listUsers);
router.get('/blocks', adminController.getBlocks);

// ── Bulk User Operations ─────────────────────────────────────────────────────
router.put(
    '/users/bulk/role',
    [
        body('userIds').isArray({ min: 1, max: 100 }).withMessage('userIds must be an array (1-100)'),
        body('role').isIn(Object.values(ROLES)).withMessage('Invalid role')
    ],
    runValidations,
    auditMiddleware('BULK_UPDATE', 'User'),
    adminController.bulkUpdateRole
);

router.put(
    '/users/bulk/status',
    [
        body('userIds').isArray({ min: 1, max: 100 }).withMessage('userIds must be an array (1-100)'),
        body('status').isIn(['active', 'suspended']).withMessage('Invalid status')
    ],
    runValidations,
    auditMiddleware('BULK_UPDATE', 'User'),
    adminController.bulkUpdateStatus
);

router.delete(
    '/users/bulk',
    [
        body('userIds').isArray({ min: 1, max: 50 }).withMessage('userIds must be an array (1-50)'),
        body('confirmation').equals('DELETE').withMessage('Invalid confirmation')
    ],
    runValidations,
    auditMiddleware('BULK_DELETE', 'User'),
    adminController.bulkDelete
);

router.put(
    '/users/bulk/reset-password',
    [
        body('userIds').isArray({ min: 1, max: 50 }).withMessage('userIds must be an array (1-50)'),
        body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('forceChange').optional().isBoolean()
    ],
    runValidations,
    auditMiddleware('BULK_UPDATE', 'User'),
    adminController.bulkResetPassword
);

// ── Block management ──────────────────────────────────────────────────────────
// Create block
router.post(
    '/blocks',
    [body('name').notEmpty().withMessage('Block name is required')],
    runValidations,
    auditMiddleware('CREATE', 'Block'),
    adminController.createBlock
);

// Delete block
router.delete(
    '/blocks/:id',
    [param('id').isMongoId().withMessage('Invalid block id')],
    runValidations,
    auditMiddleware('DELETE', 'Block'),
    adminController.deleteBlock
);

// Update block
router.patch(
    '/blocks/:id',
    [param('id').isMongoId().withMessage('Invalid block id')],
    runValidations,
    auditMiddleware('UPDATE', 'Block'),
    adminController.updateBlock
);

// Assign warden to block
router.put(
    '/blocks/:id/warden',
    [param('id').isMongoId().withMessage('Invalid block id')],
    runValidations,
    auditMiddleware('UPDATE', 'Block'),
    adminController.assignWardenToBlock
);

// ── Single User Operations ─────────────────────────────────────────────────────
// Create user
router.post(
    '/users',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').optional().isIn(Object.values(ROLES)).withMessage('Invalid role'),
    ],
    runValidations,
    auditMiddleware('CREATE', 'User'),
    adminController.createUser
);

// Update user (name, role, block, room, status)
router.put(
    '/users/:id',
    [param('id').isMongoId().withMessage('Invalid user id')],
    runValidations,
    auditMiddleware('UPDATE', 'User'),
    adminController.updateUser
);

// Reset password
router.patch(
    '/users/:id/password',
    [
        param('id').isMongoId().withMessage('Invalid user id'),
        body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    runValidations,
    adminController.resetPassword
);

// Toggle active/suspended status
router.patch(
    '/users/:id/status',
    [param('id').isMongoId().withMessage('Invalid user id')],
    runValidations,
    adminController.toggleStatus
);

// Delete user
router.delete(
    '/users/:id',
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('DELETE', 'User'),
    adminController.deleteUser
);

// ── User management ──────────────────────────────────────────────────────────
// Role change (kept for backward compat with existing UserManagement inline dropdown)
router.patch(
    '/users/:id/role',
    [
        param('id').isMongoId().withMessage('Invalid id'),
        body('role').notEmpty().withMessage('role is required')
    ],
    runValidations,
    auditMiddleware('UPDATE', 'User'),
    adminController.updateUserRole
);



router.get('/usage/summary', adminController.getSystemUsageSummary);

// ── Cron Job Reliability Logs (admin only) ────────────────────────────────────
// GET /api/admin/cron-logs — returns last 30 runs per job name, sorted by runAt desc
router.get('/cron-logs', async (req, res) => {
    try {
        // Get all distinct job names first
        const jobNames = await CronLog.distinct('jobName');

        // For each job, fetch the last 30 runs
        const results = {};
        await Promise.all(jobNames.map(async (jobName) => {
            results[jobName] = await CronLog.find({ jobName })
                .sort({ runAt: -1 })
                .limit(30)
                .lean();
        }));

        return res.json({
            success: true,
            jobs: jobNames,
            logs: results,
        });
    } catch (err) {
        console.error('[Admin] cron-logs error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch cron logs' });
    }
});

// ── Threshold configuration (admin only) ─────────────────────────────────────
router.get('/config/thresholds', configController.getThresholds);
router.get('/config/thresholds/:resource', configController.getResourceThreshold);
router.post(
    '/config/thresholds',
    [body('resource').notEmpty().withMessage('resource is required')],
    runValidations,
    auditMiddleware('CREATE', 'SystemConfig'),
    configController.createThreshold
);
router.put(
    '/config/thresholds/:resource',
    [param('resource').notEmpty().withMessage('resource required')],
    runValidations,
    auditMiddleware('UPDATE', 'SystemConfig'),
    configController.updateThreshold
);
router.delete(
    '/config/thresholds/:resource',
    [param('resource').notEmpty().withMessage('resource required')],
    runValidations,
    auditMiddleware('DELETE', 'SystemConfig'),
    configController.deleteThreshold
);

// ── Resource Config aliased routes ───────────────────────────────────────────
// ── Onboarding & Approval (NEW) ───────────────────────────────────────────────
router.get('/pending-users', adminController.getPendingUsers);
router.put('/approve/:id', adminController.approveUser);
router.put('/reject/:id', adminController.rejectUser);
router.put('/assign-role/:id', adminController.assignRole);

module.exports = router;
