const jwt = require('jsonwebtoken')
require('dotenv').config()

module.exports = function (req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization']
  if (!authHeader) return res.status(401).json({ message: 'No token provided' })

  const parts = authHeader.split(' ')
  if (parts.length !== 2) return res.status(401).json({ message: 'Token error' })

  const scheme = parts[0]
  const token = parts[1]
  if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ message: 'Token malformatted' })

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token invalid' })
    req.userId = decoded.id
    next()
  })
}
