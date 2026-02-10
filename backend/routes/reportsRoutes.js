const express = require('express')
const router = express.Router()
const auth = require('../middleware/auth')
const reports = require('../controllers/reportsController')

router.use(auth)

router.get('/usages/csv', reports.exportUsagesCSV)

module.exports = router
