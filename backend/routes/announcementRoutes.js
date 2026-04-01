const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const { body } = require('express-validator');
const runValidations = require('../middleware/validate');

// All routes require authentication
router.use(protect);

// Get announcements visible to current user
router.get(
  '/',
  announcementController.getAnnouncements
);

// Get single announcement
router.get(
  '/:id',
  announcementController.getAnnouncement
);

// Create announcement (Admin and GM only)
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL),
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 2000 }).withMessage('Content cannot exceed 2000 characters'),
    body('type').optional().isIn(['GENERAL', 'MAINTENANCE', 'EMERGENCY', 'RESOURCE', 'EVENT']).withMessage('Invalid type'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority')
  ],
  runValidations,
  announcementController.createAnnouncement
);

// Update announcement (creator or admin)
router.put(
  '/:id',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL),
  announcementController.updateAnnouncement
);

// Delete announcement
router.delete(
  '/:id',
  authorizeRoles(ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL),
  announcementController.deleteAnnouncement
);

module.exports = router;
