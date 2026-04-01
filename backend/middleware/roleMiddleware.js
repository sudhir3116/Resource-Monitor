const { ROLES } = require('../config/roles');

/**
 * Middleware to restrict access based on user role.
 * @param {...string} allowedRoles - List of roles permitted to access the route.
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ success: false, message: 'Access forbidden: No role assigned' });
        }

        if (!allowedRoles.some(r => (r || '').toLowerCase() === (req.user.role || '').toLowerCase())) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Role '${req.user.role}' is not authorized.`
            });
        }
        next();
    };
};

/**
 * String-based role check (case-insensitive) as requested by user prompt.
 */
const allowRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.some(r => r.toLowerCase() === (req.user.role || '').toLowerCase())) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Role unauthorized for this dashboard.`
            });
        }
        next();
    };
};

module.exports = { authorizeRoles, allowRoles };
