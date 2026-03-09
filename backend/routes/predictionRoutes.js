const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// All prediction routes require authentication
router.use(protect);

// Get predictions for a specific block
router.get(
  '/block/:blockId',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.WARDEN),
  predictionController.getBlockPredictions
);

// Get summary of all blocks with warnings
router.get(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN),
  predictionController.getAllPredictions
);

// Create predictive alerts based on forecasts
router.post(
  '/create-alerts',
  authorizeRoles(ROLES.ADMIN, ROLES.GM),
  predictionController.createPredictiveAlerts
);

module.exports = router;
