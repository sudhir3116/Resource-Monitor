const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const {
    getAll,
    create,
    update,
    toggle,
    softDelete,
    restore
} = require('../controllers/resourceConfigController');

// All routes require authentication
router.use(auth);

// GET /api/resource-config — all authenticated users can view
router.get('/', getAll);

// POST /api/resource-config — admin only
router.post('/', authorizeRoles(ROLES.ADMIN), create);

// PUT /api/resource-config/:id — admin and GM only
router.put('/:id', authorizeRoles(ROLES.ADMIN, ROLES.GM), update);

// PATCH /api/resource-config/:id/toggle — admin and GM only
router.patch('/:id/toggle', authorizeRoles(ROLES.ADMIN, ROLES.GM), toggle);

// DELETE /api/resource-config/:id — admin only (soft delete)
router.delete('/:id', authorizeRoles(ROLES.ADMIN), softDelete);

// PATCH /api/resource-config/:id/restore — admin only
router.patch('/:id/restore', authorizeRoles(ROLES.ADMIN), restore);

module.exports = router;
