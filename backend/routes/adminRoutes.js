const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const configController = require('../controllers/configController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.use(authMiddleware);
router.use(adminMiddleware);

// User management
router.get('/users', adminController.listUsers);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/role', adminController.updateUserRole);
router.get('/usage/summary', adminController.getSystemUsageSummary);

// Threshold configuration (admin only)
router.get('/config/thresholds', configController.getAllThresholds);
router.get('/config/thresholds/:resource', configController.getThresholdByResource);
router.post('/config/thresholds', configController.createThreshold);
router.put('/config/thresholds/:resource', configController.updateThreshold);
router.delete('/config/thresholds/:resource', configController.deleteThreshold);
router.patch('/config/thresholds/:resource/toggle', configController.toggleAlerts);

module.exports = router;
