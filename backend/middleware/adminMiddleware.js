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

    // 1. Admin gets pass-through for everything
    if (isAdmin) return next();

    // 2. Executive Role Logic (Read-only for Admin module)
    if (isExecutive) {
        if (req.method === 'GET') {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: `Dean/Principal roles are restricted to read-only access (GET) in the Administrative module.`
        });
    }

    // 3. GM Role Logic (Limited Control)
    if (isGM) {
        const method = req.method.toUpperCase();
        const url = req.originalUrl;

        // GM CANNOT: Delete any data (Users, Blocks, Resources)
        if (method === 'DELETE') {
            return res.status(403).json({ success: false, message: 'GM role does not have permission for destructive actions (DELETE).' });
        }

        // GM CANNOT: Change user roles (Security rule)
        if (url.includes('/users/bulk/role')) {
            return res.status(403).json({ success: false, message: 'GM cannot modify administrative user roles.' });
        }

        // GM CANNOT: Create new resources or blocks
        if ((url.includes('/resources') || url.includes('/blocks')) && method === 'POST') {
            return res.status(403).json({ success: false, message: 'GM cannot create new core system modules (Resources/Blocks).' });
        }

        // GM CANNOT: Modify system config keys
        if (url.includes('/config') && method !== 'GET') {
            return res.status(403).json({ success: false, message: 'GM cannot modify core system configurations.' });
        }

        // Allow Monitoring (GET) and Moderate Control (PUT/PATCH for edits)
        if (['GET', 'PUT', 'PATCH'].includes(method)) {
            return next();
        }
    }

    // Default: Reject anything else (Warden, Student, etc.) 
    return res.status(403).json({
        success: false,
        message: `Security Access Denied. Role '${role}' is not authorized to manage the Administrative module.`
    });
};
