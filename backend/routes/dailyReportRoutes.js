const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// All routes require authentication
router.use(protect);

// Get all reports (Admins see all, Wardens see own)
router.get(
  '/',
  dailyReportController.getDailyReports
);

// Check if warden has submitted report today
router.get(
  '/today/check',
  authorizeRoles(ROLES.WARDEN),
  dailyReportController.checkTodayReport
);

// Get single report
router.get(
  '/:id',
  dailyReportController.getDailyReport
);

// Create daily report (Wardens only)
router.post(
  '/',
  authorizeRoles(ROLES.WARDEN),
  dailyReportController.createDailyReport
);

// Review report (Admin/GM only)
router.put(
  '/:id/review',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  dailyReportController.reviewDailyReport
);

module.exports = router;
