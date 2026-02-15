const { authorizeRoles } = require('./roleMiddleware');
const { ROLES } = require('../config/roles');

// Authorize all administrative roles
module.exports = authorizeRoles(
    ROLES.ADMIN,
    ROLES.WARDEN,
    ROLES.DEAN,
    ROLES.PRINCIPAL
);
