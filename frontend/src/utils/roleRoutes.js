/**
 * Role-based route mapping and utilities
 * Centralized configuration for role-to-dashboard routing
 */

export const ROLE_ROUTE_MAP = {
  admin: '/admin/dashboard',
  warden: '/warden/dashboard',
  dean: '/dean/dashboard',
  principal: '/principal/dashboard',
  student: '/student/dashboard'
};

export const ROLE_PREFIXES = {
  admin: '/admin',
  warden: '/warden',
  dean: '/dean',
  principal: '/principal',
  student: '/student'
};

/**
 * Get the appropriate dashboard route for a user role
 * @param {string} role - User's role
 * @returns {string} Dashboard route path
 */
export const getDashboardRoute = (role) => {
  if (!role) return '/login';
  return ROLE_ROUTE_MAP[role] || '/dashboard';
};

/**
 * Check if a user has access to a specific route
 * @param {string} role - User's role
 * @param {string} routePath - Path to check
 * @returns {boolean}
 */
export const hasRouteAccess = (role, routePath) => {
  // Public routes - accessible to all
  const publicRoutes = ['/announcements', '/profile', '/profile-new'];
  if (publicRoutes.includes(routePath)) return true;

  // Role-specific access
  const roleAccessMap = {
    admin: ['/admin', '/users', '/blocks', '/resource-config', '/audit-logs', '/database-viewer', '/reports', '/alerts', '/usage', '/analytics'],
    warden: ['/warden', '/usage', '/alerts', '/complaints', '/warden/daily-report', '/announcements'],
    dean: ['/dean', '/analytics', '/reports', '/alerts', '/announcements', '/profile'],
    principal: ['/principal', '/analytics', '/reports', '/announcements', '/profile'],
    student: ['/student', '/complaints', '/announcements', '/profile']
  };

  const allowedPaths = roleAccessMap[role] || [];
  return allowedPaths.some(path => routePath.startsWith(path));
};

/**
 * Get allowed navigation items for a role
 * @param {string} role - User's role
 * @returns {Array} Array of navigation items
 */
export const getNormalizedRole = (role) => {
  const validRoles = ['admin', 'warden', 'dean', 'principal', 'student'];
  return validRoles.includes(role) ? role : 'student';
};
