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
const authLimiter = require('../middleware/rateLimiter');

// Standard Auth
router.get('/me', authMiddleware, verifyToken);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot', authLimiter, forgotPassword);
router.post('/reset/:token', authLimiter, resetPassword);

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
    passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/login?error=failed' }),
    (req, res) => {
        // Generate Tokens using shared logic
        const { accessToken, refreshToken } = GENERATE_TOKENS(req.user);
        SET_COOKIES(res, accessToken, refreshToken);

        // Redirect to frontend dashboard
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/dashboard`);
    }
);

router.get("/test", (req, res) => {
    res.json({ message: "Auth route working" });
});

module.exports = router;