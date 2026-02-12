const express = require('express')
const router = express.Router()
const usageController = require('../controllers/usageController')
const protect = require('../middleware/auth')

router.use(protect) // All routes protected

router.get('/stats', usageController.getDashboardStats) // NEW: Dashboard Stats
router.post('/', usageController.createUsage)
router.get('/', usageController.getUsages)
router.get('/:id', usageController.getUsage)
router.patch('/:id', usageController.updateUsage)
router.delete('/:id', usageController.deleteUsage)

module.exports = router

