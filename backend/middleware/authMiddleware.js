const jwt = require('jsonwebtoken')
const User = require('../models/User')
require('dotenv').config()

module.exports = async function (req, res, next) {
  try {
    let token = null;

    // Check Header first (SessionStorage isolation priority)
    if (req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    // Fallback to cookie (Legacy / Refresh flows)
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return res.status(401).json({ message: 'Token invalid' });

    // Validate server instance to enforce logout on restart
    const { SERVER_INSTANCE_ID } = require('../config/runtime');
    if (decoded.instanceId !== SERVER_INSTANCE_ID) {
      return res.status(401).json({ message: 'Session expired (server restart)' });
    }

    // Attach decoded token
    req.user = { id: decoded.id, role: decoded.role }
    req.userId = decoded.id

    // Fetch full user object from DB for fresh role 
    try {
      const userObj = await User.findById(decoded.id).select('-password').populate('block', 'name location')
      if (userObj) {
        // Enforce account suspension
        if (userObj.status === 'suspended') {
          return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact the administrator.' });
        }

        req.userObj = userObj
        req.user.role = userObj.role  // Guarantee role is fresh from DB
        req.user.block = userObj.block // Attach block (ObjectId or populated doc)
        req.user.name = userObj.name

        // Invalidate tokens issued before user's last logout
        if (userObj.lastLogoutAt && decoded.iat) {
          const tokenIssuedAt = decoded.iat; // seconds since epoch
          const lastLogoutAtSec = Math.floor(new Date(userObj.lastLogoutAt).getTime() / 1000);
          if (tokenIssuedAt <= lastLogoutAtSec) {
            return res.status(401).json({ message: 'Token invalid (user logged out)' });
          }
        }
      }
    } catch (e) {
      // ignore user attach errors, continue with req.userId
    }

    // ── Area 1: Token Blacklist Check ──────────────────────────────────────
    try {
      const TokenBlacklist = require('../models/TokenBlacklist');
      const blacklisted = await TokenBlacklist.findOne({ token }).lean();
      if (blacklisted) {
        return res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
      }
    } catch (e) {
      // fail open if db check fails temporarily
      console.error('[Blacklist] DB error:', e.message);
    }

    return next()
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' })
  }
}
