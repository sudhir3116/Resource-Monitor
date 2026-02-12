const { OAuth2Client } = require('google-auth-library')
const User = require('../models/User')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const googleLogin = async (req, res) => {
  try {
    const { id_token } = req.body
    if (!id_token) return res.status(400).json({ message: 'id_token required' })

    const ticket = await client.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    const { sub: googleId, email, name, picture } = payload

    // find or create user by email (prevents duplicate accounts)
    let user = await User.findOne({ email })
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-12)
      const hashed = await bcrypt.hash(randomPassword, 10)
      user = await User.create({ name: name || email.split('@')[0], email, password: hashed, googleId, provider: 'google', avatar: picture })
    } else {
      // ensure provider/googleId are set
      let changed = false
      if (!user.googleId && googleId) { user.googleId = googleId; changed = true }
      if (user.provider !== 'google') { user.provider = 'google'; changed = true }
      if (picture && user.avatar !== picture) { user.avatar = picture; changed = true }
      if (changed) await user.save()
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' })
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email } })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

module.exports = { googleLogin }
