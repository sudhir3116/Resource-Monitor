/**
 * middleware/checkBlacklist.js
 * Applied AFTER verifyToken (authMiddleware).
 * Rejects requests that carry a token the user explicitly logged out with.
 * Works alongside the existing lastLogoutAt check in authMiddleware.js.
 */
const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/TokenBlacklist');

module.exports = async function checkBlacklist(req, res, next) {
    try {
        // Extract token from Authorization header or cookie (mirrors authMiddleware logic)
        let token = null;
        if (req.headers['authorization']?.startsWith('Bearer ')) {
            token = req.headers['authorization'].split(' ')[1];
        } else if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) return next(); // No token = authMiddleware already rejected or public route

        // Check if this specific token has been blacklisted
        const blacklisted = await TokenBlacklist.findOne({ token }).lean();
        if (blacklisted) {
            return res.status(401).json({ success: false, message: 'Token has been invalidated. Please log in again.' });
        }

        return next();
    } catch (err) {
        // Non-critical: if blacklist check fails, allow through (don't crash the server)
        console.error('[Blacklist] Check error (non-fatal):', err.message);
        return next();
    }
};
