const nodemailer = require('nodemailer')
require('dotenv').config()

let transporter = null
function getTransporter(){
  if (transporter) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL } = process.env
  if (!SMTP_HOST || !SMTP_PORT) {
    console.warn('Mailer not configured - emails will be logged to console')
    return null
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  })
  return transporter
}

async function sendMail({ to, subject, text, html }){
  const t = getTransporter()
  const from = process.env.FROM_EMAIL || 'no-reply@example.com'
  if (!t) {
    console.log('--- Email (dev) ---')
    console.log('From:', from)
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('Text:', text)
    if (html) console.log('HTML:', html)
    console.log('-------------------')
    return
  }

  try {
    await t.sendMail({ from, to, subject, text, html })
  } catch (err) {
    console.error('Error sending mail', err)
  }
}

module.exports = { sendMail }
