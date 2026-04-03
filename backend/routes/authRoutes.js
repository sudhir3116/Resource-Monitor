const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const {
    register,
    login,
    googleLogin,
    logout,
    refresh,
    forgotPassword,
    resetPassword,
    verifyToken,
    GENERATE_TOKENS,
    SET_COOKIES
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Standard Auth
router.get('/me', authMiddleware, verifyToken);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot', forgotPassword);
router.post('/reset/:token', resetPassword);

// Google OAuth - Modern approach (Google Identity Services)
// Route: POST /api/auth/google
// Frontend sends ID token, backend verifies it
router.post('/google', authLimiter, googleLogin);

// Google OAuth - Legacy redirect flow (kept for backward compatibility)
// Route: GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Route: GET /api/auth/google/callback
router.get(
    '/google/callback',
    (req, res, next) => {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        passport.authenticate('google', {
            session: false,
            failureRedirect: `${frontendUrl}/login?error=failed`
        })(req, res, next);
    },
    (req, res) => {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Enforce suspension even in legacy flow
        if (req.user && req.user.status === 'suspended') {
            return res.redirect(`${frontendUrl}/login?error=suspended`);
        }

        // Generate Tokens using shared logic
        const { accessToken, refreshToken } = GENERATE_TOKENS(req.user);
        SET_COOKIES(res, accessToken, refreshToken);

        // Redirect to frontend dashboard
        res.redirect(`${frontendUrl}/dashboard`);
    }
);

router.get("/test", (req, res) => {
    res.json({ message: "Auth route working" });
});

module.exports = router;