const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAlerts,
    reviewAlert,
    resolveAlert,
    dismissAlert,
    createAlert,
    getAlertRules,
    getSystemAlerts,
    updateAlertRule,
    deleteAlertRule
} = require('../controllers/alertsController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/alerts - List alerts with filters
router.get('/', getAlerts);

// GET /api/alerts/rules - Get configured alert rules
router.get('/rules', getAlertRules);

// GET /api/alerts/system - Get system alerts/logs
router.get('/system', getSystemAlerts);

// POST /api/alerts - Create manual alert (Admin, Warden)
router.post('/', createAlert);

// PATCH /api/alerts/:id - Update alert rule (Active/Inactive)
router.patch('/:id', updateAlertRule);

// DELETE /api/alerts/:id - Delete alert rule
router.delete('/:id', deleteAlertRule);

// PUT /api/alerts/:id/review - Mark as reviewed
router.put('/:id/review', reviewAlert);

// PUT /api/alerts/:id/resolve - Resolve with comment
router.put('/:id/resolve', resolveAlert);

// PUT /api/alerts/:id/dismiss - Dismiss alert
router.put('/:id/dismiss', dismissAlert);

module.exports = router;
