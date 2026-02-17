const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    exportCSV,
    getBillEstimate,
    getBlockComparison,
    getHistoricalTrends
} = require('../controllers/reportsController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/reports/export/csv - Export usage data as CSV
router.get('/export/csv', exportCSV);

// GET /api/reports/bill-estimate - Calculate monthly bill
router.get('/bill-estimate', getBillEstimate);

// GET /api/reports/comparison - Compare blocks
router.get('/comparison', getBlockComparison);

// GET /api/reports/trends - Historical trends
router.get('/trends', getHistoricalTrends);

module.exports = router;
