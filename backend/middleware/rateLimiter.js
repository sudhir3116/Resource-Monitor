const rateLimit = require('express-rate-limit');

// ── General API Rate Limiter ──────────────────────────────────────────────────
// Higher limit for dashboards with many components
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
    skip: () => process.env.NODE_ENV === 'development',
});

// Strict 100 requests per 15 minutes on /api/auth/login and /api/auth/register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
    skip: () => process.env.NODE_ENV === 'development',
});

module.exports = { apiLimiter, authLimiter };
