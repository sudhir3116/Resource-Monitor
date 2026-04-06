const { authorizeRoles } = require('./roleMiddleware');
const { ROLES } = require('../config/roles');

module.exports = authorizeRoles(ROLES.WARDEN, ROLES.ADMIN, ROLES.GM);
