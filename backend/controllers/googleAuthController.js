const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User = require('../models/User')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
require('dotenv').config()

const configurePassport = () => {
  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id)
      done(null, user)
    } catch (err) {
      done(err, null)
    }
  })

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:4000/api/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          let user = await User.findOne({ email: profile.emails[0].value })

          if (user) {
            // Update existing user with googleId if missing
            if (!user.googleId) {
              user.googleId = profile.id
              if (!user.avatar) user.avatar = profile.photos[0].value
              if (user.provider !== 'google') user.provider = 'google'
              await user.save()
            }
            return done(null, user)
          } else {
            // Create new user
            const randomPassword = Math.random().toString(36).slice(-12)
            const hashed = await bcrypt.hash(randomPassword, 10)

            const newUser = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              password: hashed,
              googleId: profile.id,
              provider: 'google',
              avatar: profile.photos[0].value
            })
            return done(null, newUser)
          }
        } catch (err) {
          console.error('Google Strategy Error:', err)
          return done(err, null)
        }
      }
    )
  )
}

// Callback Controller to handle redirection after successful auth
const googleCallback = (req, res) => {
  // If we reach here, passport has already authenticated the user and added req.user
  if (!req.user) {
    return res.redirect('http://localhost:5173/login?error=GoogleAuthFailed')
  }

  // Generate JWT as before
  const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '1d' })

  // Redirect to frontend with token
  // Ideally, use a secure cookie or pass via URL fragment/query param
  res.redirect(`http://localhost:5173/login?token=${token}`)
}

module.exports = { configurePassport, googleCallback }
