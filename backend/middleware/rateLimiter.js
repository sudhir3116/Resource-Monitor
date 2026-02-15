const rateLimit = require('express-rate-limit');

// Determine if we are in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Authentication Rate Limiter
 * Applies strict limits to login, register, and password reset endpoints.
 * 
 * Production: 5 attempts per 15 minutes
 * Development: Unlimited (or very high limit to prevent blocking)
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDevelopment ? 1000 : 5, // 1000 requests in dev, 5 in prod
    message: {
        message: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Optionally skip for specific trusted IPs or conditions if needed
        // For now, we rely on NODE_ENV check above
        if (isDevelopment) return true; // Skip entirely in development if preferred
        return false;
    }
});

module.exports = authLimiter;
