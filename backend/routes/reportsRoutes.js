const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const reports = require('../controllers/reportsController')

const { authorizeRoles } = require('../middleware/roleMiddleware');

router.use(auth);
// Restrict report endpoints to officials
router.use(authorizeRoles('admin', 'warden', 'dean', 'principal'));

router.get('/usages/csv', reports.exportUsagesCSV)

module.exports = router
