const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAnalyticsSummary,
    getResourceTrends,
    detectAnomalies,
    getSustainabilityScore,
    getEfficiencyRating
} = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(authMiddleware);

// GET /api/analytics/summary?period=daily|weekly|monthly
router.get('/summary', getAnalyticsSummary);

// GET /api/analytics/trends?days=7&resource=Electricity
router.get('/trends', getResourceTrends);

// GET /api/analytics/anomalies
router.get('/anomalies', detectAnomalies);

// GET /api/analytics/sustainability-score?blockId=xxx
router.get('/sustainability-score', getSustainabilityScore);

// GET /api/analytics/efficiency-rating
router.get('/efficiency-rating', getEfficiencyRating);

module.exports = router;
