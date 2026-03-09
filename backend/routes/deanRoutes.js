const express = require('express');
const router = express.Router();
const deanController = require('../controllers/deanController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// All dean routes require authentication
router.use(protect);

// Dean summary dashboard data
router.get(
  '/summary',
  authorizeRoles(ROLES.DEAN, ROLES.ADMIN, ROLES.GM),
  deanController.getDeanSummary
);

module.exports = router;
