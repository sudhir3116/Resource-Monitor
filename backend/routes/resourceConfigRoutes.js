const express = require('express');
const router = express.Router();
const { getAll, create, update, toggleResource, deleteResource } = require('../controllers/resourceController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /api/resource-config
router.get('/', getAll);

// Administrative routes (Mutation) - require Admin or GM role
router.use(adminMiddleware);

router.post('/', create);
router.put('/:id', update);
router.patch('/:id/toggle', toggleResource);
router.delete('/:id', deleteResource);

module.exports = router;
