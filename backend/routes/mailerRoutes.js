const express = require('express')
const router = express.Router()
const mailerController = require('../controllers/mailerController')
const auth = require('../middleware/authMiddleware')

// POST /api/mailer/send-test  (authenticated)
router.post('/send-test', auth, mailerController.sendTest)

module.exports = router
