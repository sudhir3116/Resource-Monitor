const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const alerts = require('../controllers/alertsController')

router.use(auth)

router.post('/', alerts.createRule)
router.get('/', alerts.listRules)
router.put('/:id', alerts.updateRule)
router.delete('/:id', alerts.deleteRule)

router.get('/logs/all', alerts.listLogs)

module.exports = router
