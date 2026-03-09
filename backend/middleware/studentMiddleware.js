const { authorizeRoles } = require('./roleMiddleware');
const { ROLES } = require('../config/roles');

module.exports = authorizeRoles(ROLES.STUDENT, ROLES.WARDEN, ROLES.ADMIN);
