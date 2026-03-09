/**
 * serverRoleAuth.js
 * Server-side role-based authorization utilities
 * Ensures data consistency with frontend role-based routing
 */

const { ROLES } = require('../config/roles');

/**
 * Get allowed operations for a role
 */
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    canViewAllData: true,
    canManageUsers: true,
    canManageBlocks: true,
    canManageResources: true,
    canCreateAlerts: true,
    canEditAlerts: true,
    canDeleteAlerts: true,
    canViewAuditLogs: true,
    canViewReports: true,
  },
  [ROLES.GM]: {
    canViewAllData: true,
    canManageUsers: false,
    canManageBlocks: false,
    canManageResources: false,
    canCreateAlerts: true,
    canEditAlerts: true,
    canDeleteAlerts: false,
    canViewAuditLogs: true,
    canViewReports: true,
  },
  [ROLES.WARDEN]: {
    canViewAllData: false, // Only own block
    canManageUsers: false,
    canManageBlocks: false,
    canManageResources: false,
    canCreateAlerts: true,
    canEditAlerts: true,
    canDeleteAlerts: false,
    canViewAuditLogs: false,
    canViewReports: false,
  },
  [ROLES.DEAN]: {
    canViewAllData: true,
    canManageUsers: false,
    canManageBlocks: false,
    canManageResources: false,
    canCreateAlerts: false,
    canEditAlerts: false,
    canDeleteAlerts: false,
    canViewAuditLogs: true,
    canViewReports: true,
  },
  [ROLES.STUDENT]: {
    canViewAllData: false, // Only own data
    canManageUsers: false,
    canManageBlocks: false,
    canManageResources: false,
    canCreateAlerts: false,
    canEditAlerts: false,
    canDeleteAlerts: false,
    canViewAuditLogs: false,
    canViewReports: false,
  },
};

/**
 * Get permissions for a user role
 * @param {string} role - User role
 * @returns {Object} Permission object
 */
exports.getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLES.STUDENT];
};

/**
 * Check if user has specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission key
 * @returns {boolean}
 */
exports.hasPermission = (role, permission) => {
  const permissions = exports.getPermissions(role);
  return permissions[permission] === true;
};

/**
 * Get data scope for a role
 * Determines what data a user can access
 * @param {string} role - User role
 * @param {Object} user - User object with block field
 * @returns {Object} Filter object for MongoDB queries
 */
exports.getDataScope = (role, user) => {
  if (!role) return { _id: null }; // No data for unknown role

  switch (role) {
    case ROLES.ADMIN:
    case ROLES.GM:
    case ROLES.DEAN:
      // Full access to all data
      return {};

    case ROLES.WARDEN:
      // Only own block data
      if (!user?.block) {
        return { blockId: null }; // Empty result if no block assigned
      }
      return { blockId: user.block };

    case ROLES.STUDENT:
      // Only own data
      if (!user?._id) {
        return { userId: null };
      }
      return { userId: user._id };

    default:
      return { _id: null };
  }
};

/**
 * Verify user can access data based on role and block
 * @param {Object} user - User object
 * @param {string|ObjectId} blockId - Block ID to check against
 * @returns {boolean}
 */
exports.canAccessBlock = (user, blockId) => {
  if (!user) return false;

  // Admins and GMs can access all blocks
  if (user.role === ROLES.ADMIN || user.role === ROLES.GM) {
    return true;
  }

  // Wardens can access only their assigned block
  if (user.role === ROLES.WARDEN) {
    const userBlockId = user.block?.toString?.() || user.block;
    const targetBlockId = blockId?.toString?.() || blockId;
    return userBlockId === targetBlockId;
  }

  // Dean can't be restricted by block
  if (user.role === ROLES.DEAN) {
    return true;
  }

  return false;
};

/**
 * Get cache prefix for role-based queries
 * Different roles get different cached results
 * @param {string} role - User role
 * @param {string} query - Query string
 * @returns {string} Cache key
 */
exports.getCacheKey = (role, query, blockId = null) => {
  if (role === ROLES.WARDEN && blockId) {
    return `${role}_${blockId}_${query}`;
  }
  return `${role}_${query}`;
};

/**
 * Log role-based data access for audit trail
 * @param {Object} user - User object
 * @param {string} action - Action performed
 * @param {string} resource - Resource accessed
 * @param {boolean} allowed - Whether access was allowed
 * @returns {Object} Audit log entry
 */
exports.createAuditEntry = (user, action, resource, allowed) => {
  return {
    userId: user?._id,
    userRole: user?.role,
    userBlock: user?.block,
    action,
    resource,
    allowed,
    timestamp: new Date(),
    ip: user?.ip || 'unknown'
  };
};
