const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAuditLogs,
    getResourceAuditHistory,
    getAuditStats,
    checkDuplicate
} = require('../controllers/auditLogsController');

const { authorizeRoles: authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// All routes require authentication
router.use(authMiddleware);

// GET /api/audit-logs - Get audit logs with filters (Dean/Principal = read-only)
router.get('/', authorize(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL), getAuditLogs);

// GET /api/audit-logs/stats - Get audit statistics
router.get('/stats', authorize(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL), getAuditStats);

// GET /api/audit-logs/resource/:resourceType/:resourceId - Get resource history
router.get('/resource/:resourceType/:resourceId', authorize(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL), getResourceAuditHistory);

// POST /api/audit-logs/check-duplicate - Check for duplicates
router.post('/check-duplicate', checkDuplicate);

module.exports = router;
