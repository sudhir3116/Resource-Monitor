const mailer = require('../utils/mailer')

exports.sendTest = async (req, res) => {
  try {
    const user = req.user
    if (!user || !user.email) return res.status(400).json({ message: 'User email not available' })

    const to = user.email
    const subject = 'Test alert email — Sustainable Resource Monitor'
    const text = `Hello ${user.name || ''},\n\nThis is a test alert email from Sustainable Resource Monitor.\n\nIf you received this, email is configured for your account.`

    await mailer.sendMail({ to, subject, text })
    return res.json({ message: 'Test email queued/sent (check logs or inbox based on config)' })
  } catch (err) {
    console.error('Mailer test error', err)
    return res.status(500).json({ message: err.message })
  }
}
