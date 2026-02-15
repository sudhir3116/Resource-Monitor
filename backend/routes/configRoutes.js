const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/config/thresholds
 * Get all resource threshold configurations (read-only for all authenticated users)
 */
router.get('/thresholds', async (req, res) => {
    try {
        const configs = await SystemConfig.find().sort({ resource: 1 });
        res.json({ configs });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * GET /api/config/thresholds/:resource
 * Get threshold config for a specific resource (read-only)
 */
router.get('/thresholds/:resource', async (req, res) => {
    try {
        const config = await SystemConfig.findOne({ resource: req.params.resource });
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }
        res.json({ config });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
