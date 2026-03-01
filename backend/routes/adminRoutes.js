const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const configController = require('../controllers/configController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { param, body } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');

router.use(authMiddleware);
router.use(adminMiddleware);

// User management
router.get('/users', adminController.listUsers);
router.get('/blocks', adminController.getBlocks);
router.delete('/users/:id', [param('id').isMongoId().withMessage('Invalid id')], runValidations, auditMiddleware('DELETE', 'User'), adminController.deleteUser);
router.patch('/users/:id/role', [param('id').isMongoId().withMessage('Invalid id'), body('role').notEmpty().withMessage('role is required')], runValidations, auditMiddleware('UPDATE', 'User'), adminController.updateUserRole);
router.get('/usage/summary', adminController.getSystemUsageSummary);

// Threshold configuration (admin only)
router.get('/config/thresholds', configController.getThresholds);
router.get('/config/thresholds/:resource', configController.getResourceThreshold);
router.post('/config/thresholds', [body('resource').notEmpty().withMessage('resource is required')], runValidations, auditMiddleware('CREATE', 'SystemConfig'), configController.createThreshold);
router.put('/config/thresholds/:resource', [param('resource').notEmpty().withMessage('resource required')], runValidations, auditMiddleware('UPDATE', 'SystemConfig'), configController.updateThreshold);
router.delete('/config/thresholds/:resource', [param('resource').notEmpty().withMessage('resource required')], runValidations, auditMiddleware('DELETE', 'SystemConfig'), configController.deleteThreshold);

module.exports = router;
