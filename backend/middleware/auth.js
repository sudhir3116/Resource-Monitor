const jwt = require('jsonwebtoken')
const User = require('../models/User')
require('dotenv').config()

module.exports = async function (req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization']
    if (!authHeader) return res.status(401).json({ message: 'No token provided' })

    const parts = authHeader.split(' ')
    if (parts.length !== 2) return res.status(401).json({ message: 'Token error' })

    const scheme = parts[0]
    const token = parts[1]
    if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ message: 'Token malformatted' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Token invalid' })

    // Attach both id and user object safely. Controllers can use req.userId or req.user
    req.userId = decoded.id
    // set req.user to the decoded id (explicit)
    req.user = decoded.id
    // also attach full user object as req.userObj for convenience (optional)
    try {
      const userObj = await User.findById(decoded.id).select('-password')
      if (userObj) req.userObj = userObj
    } catch (e) {
      // ignore user attach errors, continue with req.userId
    }

    return next()
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' })
  }
}
