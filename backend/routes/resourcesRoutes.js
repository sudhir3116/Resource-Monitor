const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// Single source of truth for resources (SystemConfig-backed)
const { getAll } = require('../controllers/resourceConfigController');

// All routes require authentication
router.use(auth);

// GET /api/resources
router.get('/', getAll);

module.exports = router;

