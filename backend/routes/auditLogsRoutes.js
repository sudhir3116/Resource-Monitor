const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAuditLogs,
    getResourceAuditHistory,
    getAuditStats,
    checkDuplicate
} = require('../controllers/auditLogsController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/audit-logs - Get audit logs with filters
router.get('/', getAuditLogs);

// GET /api/audit-logs/stats - Get audit statistics
router.get('/stats', getAuditStats);

// GET /api/audit-logs/resource/:resourceType/:resourceId - Get resource history
router.get('/resource/:resourceType/:resourceId', getResourceAuditHistory);

// POST /api/audit-logs/check-duplicate - Check for duplicates
router.post('/check-duplicate', checkDuplicate);

module.exports = router;
