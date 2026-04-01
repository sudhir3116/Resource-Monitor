const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAnalyticsSummary,
    getResourceTrends,
    detectAnomalies,
    getSustainabilityScore,
    getEfficiencyRating,
    getBudgetMonitoring,
    getHostelLeaderboard,
    getBlockAnalytics
} = require('../controllers/analyticsController');
const { query } = require('express-validator');
const runValidations = require('../middleware/validate');

// All analytics routes require authentication
router.use(authMiddleware);

// Executive Access Control
router.use((req, res, next) => {
    const isPrincipal = (req.user?.role || '').toLowerCase() === 'principal';
    const allowedForPrincipal = ['/summary', '/trends'];

    if (isPrincipal && !allowedForPrincipal.some(p => req.path.startsWith(p))) {
        return res.status(403).json({
            success: false,
            message: 'Principal role restricted to summary analytics only'
        });
    }
    next();
});

// GET /api/analytics/summary?period=daily|weekly|monthly
router.get('/summary', [query('period').optional().isIn(['daily', 'weekly', 'monthly'])], runValidations, getAnalyticsSummary);

// GET /api/analytics/trends?days=7&resource=Electricity
router.get('/trends', [query('days').optional().isInt({ gt: 0 }), query('resource').optional().isString()], runValidations, getResourceTrends);

// GET /api/analytics/anomalies
router.get('/anomalies', detectAnomalies);

// GET /api/analytics/sustainability-score?blockId=xxx
router.get('/sustainability-score', [query('blockId').optional().isMongoId()], runValidations, getSustainabilityScore);

// GET /api/analytics/efficiency-rating
router.get('/efficiency-rating', getEfficiencyRating);

// GET /api/analytics/budget
router.get('/budget', getBudgetMonitoring);

// GET /api/analytics/leaderboard
router.get('/leaderboard', getHostelLeaderboard);

// GET /api/analytics/block/:blockId - Block-specific analytics for students
router.get('/block/:blockId', getBlockAnalytics);

module.exports = router;
