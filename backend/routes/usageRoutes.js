const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const usage = require('../controllers/usageController')

router.use(auth)

router.post('/', usage.createUsage)
router.get('/', usage.getUsages)
router.get('/:id', usage.getUsage)
router.put('/:id', usage.updateUsage)
router.delete('/:id', usage.deleteUsage)

module.exports = router
