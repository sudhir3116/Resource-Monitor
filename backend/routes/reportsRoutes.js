const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    exportCSV,
    getBillEstimate,
    getBlockComparison,
    getHistoricalTrends,
    exportPDF
} = require('../controllers/reportsController');

// All routes require authentication
router.use(authMiddleware);

const { query } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

// GET /api/reports/export/csv - Export usage data as CSV
router.get('/export/csv', [query('start').optional().isISO8601(), query('end').optional().isISO8601()], runValidations, auditMiddleware('EXPORT', 'Usage'), exportCSV);

// GET /api/reports/bill-estimate - Calculate monthly bill
router.get('/bill-estimate', [query('resource').optional().isString(), query('month').optional().isISO8601()], runValidations, getBillEstimate);

// GET /api/reports/comparison - Compare blocks
router.get('/comparison', getBlockComparison);

// GET /api/reports/trends - Historical trends
router.get('/trends', getHistoricalTrends);

// GET /api/reports/export/pdf - Export usage data as PDF
router.get('/export/pdf', [query('start').optional().isISO8601(), query('end').optional().isISO8601()], runValidations, auditMiddleware('EXPORT', 'Usage'), exportPDF);

module.exports = router;
