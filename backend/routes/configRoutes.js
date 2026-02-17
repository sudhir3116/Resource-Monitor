const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getThresholds,
    getResourceThreshold,
    updateThreshold,
    createThreshold,
    deleteThreshold
} = require('../controllers/configController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/config/thresholds - Get all threshold configurations
router.get('/thresholds', getThresholds);

// GET /api/config/thresholds/:resource - Get specific resource threshold
router.get('/thresholds/:resource', getResourceThreshold);

// POST /api/config/thresholds - Create new threshold (Admin only)
router.post('/thresholds', createThreshold);

// PUT /api/config/thresholds/:resource - Update threshold (Admin only)
router.put('/thresholds/:resource', updateThreshold);

// DELETE /api/config/thresholds/:resource - Delete threshold (Admin only)
router.delete('/thresholds/:resource', deleteThreshold);

module.exports = router;
