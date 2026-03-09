const rateLimit = require('express-rate-limit');

// ── General API Rate Limiter ──────────────────────────────────────────────────
// 100 requests per 15 minutes on all /api routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
    skip: () => process.env.NODE_ENV === 'development',
});

// ── Auth-Specific Rate Limiter ────────────────────────────────────────────────
// Strict 5 requests per 15 minutes on /api/auth/login and /api/auth/register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
    skip: () => process.env.NODE_ENV === 'development',
});

module.exports = { apiLimiter, authLimiter };
