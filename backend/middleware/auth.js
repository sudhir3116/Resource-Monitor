// Consolidated auth middleware exports
const authMiddleware = require('./authMiddleware');
const { authorizeRoles } = require('./roleMiddleware');

// Re-export with clean naming
module.exports = {
    protect: authMiddleware,
    authorize: authorizeRoles
};
