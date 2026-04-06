const { ROLES } = require('../config/roles');

/**
 * Enhanced Admin Middleware with role-based restriction.
 * Admin = Full control
 * GM = Limited control (no deletions, no role changes, no resource creation)
 */
module.exports = (req, res, next) => {
    if (!req.user || !req.user.role) {
        return res.status(403).json({ success: false, message: 'Access forbidden: No role assigned' });
    }

    const role = (req.user.role || '').toLowerCase();
    const isAdmin = role === ROLES.ADMIN;
    const isGM = role === ROLES.GM;
    const isExecutive = [ROLES.DEAN, ROLES.PRINCIPAL].includes(role);

    console.log('[AdminMiddleware] Debug:', { role, isAdmin, isGM, method: req.method, url: req.originalUrl });

    // 1. Admin gets pass-through for everything
    if (isAdmin) return next();

    // 2. GM Role Logic (Limited control - allow GET, POST, PUT, PATCH but no DELETE)
    if (isGM) {
        if (req.method === 'DELETE') {
            return res.status(403).json({
                success: false,
                message: `Security Access Denied. General Managers cannot perform deletions.`
            });
        }
        return next();
    }

    // 3. Executive Role Logic (Read-only for Admin module)
    if (isExecutive) {
        if (req.method === 'GET') {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: `Dean/Principal roles are restricted to read-only access (GET) in the Administrative module.`
        });
    }

    // Default: Reject anything else (Warden, Student, etc.) 
    return res.status(403).json({
        success: false,
        message: `Security Access Denied. Role '${role}' is not authorized to manage the Administrative module.`
    });
};
