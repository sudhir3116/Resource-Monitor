const jwt = require('jsonwebtoken')
const User = require('../models/User')
require('dotenv').config()

module.exports = async function (req, res, next) {
  try {
    let token = null;

    // Check cookie first (HTTP-only)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    // Fallback to Header (Legacy / Testing)
    else if (req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Token invalid' });

    // Validate server instance to enforce logout on restart
    const { SERVER_INSTANCE_ID } = require('../config/runtime');
    if (decoded.instanceId !== SERVER_INSTANCE_ID) {
      return res.status(401).json({ message: 'Session expired (server restart)' });
    }

    // Attach decoded token (id and role) to req.user
    req.user = decoded
    req.userId = decoded.id
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
