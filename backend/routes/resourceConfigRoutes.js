const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const {
    getAll,
    create,
    update,
    softDelete
} = require('../controllers/resourceConfigController');

// All routes require authentication
router.use(auth);

// GET /api/resource-config — all authenticated users can view
router.get('/', getAll);

// POST /api/resource-config — admin only
router.post('/', authorizeRoles(ROLES.ADMIN), create);

// PUT /api/resource-config/:id — admin only
router.put('/:id', authorizeRoles(ROLES.ADMIN), update);

// DELETE /api/resource-config/:id — admin only (soft delete)
router.delete('/:id', authorizeRoles(ROLES.ADMIN), softDelete);

module.exports = router;
