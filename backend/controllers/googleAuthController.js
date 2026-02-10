const { OAuth2Client } = require('google-auth-library')
const User = require('../models/User')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const googleLogin = async (req, res) => {
  try {
    const { id_token } = req.body
    if (!id_token) return res.status(400).json({ message: 'id_token required' })

    const ticket = await client.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    const { sub: googleId, email, name } = payload

    // find or create user
    let user = await User.findOne({ email })
    if (!user) {
      user = await User.create({ name: name || email.split('@')[0], email, password: Math.random().toString(36) })
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' })
    return res.json({ token })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

module.exports = { googleLogin }
