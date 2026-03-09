const express = require('express');
const router = express.Router();
const costController = require('../controllers/costController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// All cost routes require authentication
router.use(protect);

// Cost routes - accessible to Admin, GM, and Dean only
router.get(
  '/summary',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN),
  costController.getCostSummary
);

router.get(
  '/block/:blockId',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.WARDEN),
  costController.getBlockCosts
);

router.get(
  '/resource/:resourceType',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN),
  costController.getResourceCosts
);

module.exports = router;
