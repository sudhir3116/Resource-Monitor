const { authorizeRoles } = require('./roleMiddleware');
const { ROLES } = require('../config/roles');

// Only full Administrators can access admin management routes
// (user deletion, role assignment, usage summaries)
// Wardens, Deans and Principals use their own scoped dashboards.
module.exports = authorizeRoles(ROLES.ADMIN);
