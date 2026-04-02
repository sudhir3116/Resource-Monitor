const express = require('express');
const router = express.Router();
const { getExecutiveStats } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// Dean dashboard requires Dean or Admin role
router.get('/stats', authMiddleware, authorizeRoles(ROLES.DEAN, ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.GM), getExecutiveStats);

module.exports = router;
