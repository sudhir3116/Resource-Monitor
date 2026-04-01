const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const protect = require('../middleware/authMiddleware');
const wardenMiddleware = require('../middleware/wardenMiddleware');
const { authorizeRoles: authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// 1. Student Dashboard (Personal + Block Comparison)
router.get('/student', protect, dashboardController.getStudentStats);

// 2. Warden Dashboard (Block Alerts + Daily Usage)
router.get('/warden', protect, wardenMiddleware, dashboardController.getWardenStats);

// 3. Admin/Principal Executive Dashboard (Campus Totals + Cost)
const { allowRoles } = require('../middleware/roleMiddleware');

router.get('/executive', protect, authorize(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL), dashboardController.getExecutiveStats);

// 4. Base Dashboard Redirect/Shared Route
router.get('/', protect, authorize(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL), dashboardController.getExecutiveStats);

module.exports = router;
