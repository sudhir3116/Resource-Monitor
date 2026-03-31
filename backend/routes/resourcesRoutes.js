const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// GET /api/resources
const { getAll, create, update, toggleResource, deleteResource } = require('../controllers/resourceController');
const admin = require('../middleware/adminMiddleware');

// All routes require authentication
router.use(auth);

// GET /api/resources
router.get('/', getAll);

// Administrative routes (Mutation)
router.post('/', admin, create);
router.put('/:id', admin, update);
router.patch('/:id/toggle', admin, toggleResource);
router.delete('/:id', admin, deleteResource);

module.exports = router;

