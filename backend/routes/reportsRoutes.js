const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const {
  exportCSV,
  getBillEstimate,
  getBlockComparison,
  getHistoricalTrends,
  exportPDF,
  getSummary,
  getEfficiency,
  getManagementReport
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

// GET /api/reports/summary - Summary insights with % change, top blocks, alerts & complaints
router.get('/summary', [query('start').optional().isISO8601(), query('end').optional().isISO8601()], runValidations, getSummary);

// GET /api/reports/efficiency - Block efficiency scores ranked
router.get('/efficiency', [query('start').optional().isISO8601(), query('end').optional().isISO8601()], runValidations, getEfficiency);

// GET /api/reports/management-summary - Management/executive PDF report
router.get(
  '/management-summary',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL),
  auditMiddleware('EXPORT', 'ManagementReport'),
  getManagementReport
);

module.exports = router;
