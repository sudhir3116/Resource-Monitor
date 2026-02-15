const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const {
    register,
    login,
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

// Google Auth Routes
// Route: GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Route: GET /api/auth/google/callback
router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/login?error=failed' }),
    (req, res) => {
        // Generate Tokens using shared logic (includes SERVER_INSTANCE_ID)
        const { accessToken, refreshToken } = GENERATE_TOKENS(req.user);

        // Set Cookies (includes sameSite: 'lax')
        SET_COOKIES(res, accessToken, refreshToken);

        // Redirect to frontend dashboard directly (using env)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/dashboard`);
    }
);

router.get("/test", (req, res) => {
    res.json({ message: "Auth route working" });
});

module.exports = router;