/**
 * permissions.js
 * ─────────────────────────────────────────────────────────────────
 * Role-based permission checks for the entire application
 * Ensures consistent access control across all components
 * ─────────────────────────────────────────────────────────────────
 */

const ROLES = {
    ADMIN: 'admin',
    GM: 'gm',
    DEAN: 'dean',
    PRINCIPAL: 'principal',
    WARDEN: 'warden',
    STUDENT: 'student'
};

/**
 * Determines if user can view a section
 */
export const canView = (userRole, section) => {
    if (!userRole) return false;

    const permissions = {
        admin: ['all'],
        gm: ['dashboard', 'usage', 'analytics', 'complaints', 'alerts', 'reports', 'audit-logs', 'notices', 'resource-config'],
        dean: ['dashboard', 'analytics', 'alerts', 'reports', 'audit-logs', 'notices', 'complaints'],
        principal: ['dashboard', 'analytics', 'reports', 'notices'],
        warden: ['dashboard', 'usage', 'alerts', 'complaints', 'notices', 'daily-report'],
        student: ['dashboard', 'complaints', 'notices']
    };

    const allowed = permissions[userRole] || [];
    return allowed.includes('all') || allowed.includes(section);
};

/**
 * Determines if user can edit/create resources
 */
export const canEdit = (userRole, resource) => {
    if (!userRole) return false;

    const canModify = {
        admin: ['all'],
        gm: ['complaints', 'alerts'],
        dean: [],
        principal: [],
        warden: ['usage', 'complaints', 'alerts'],
        student: ['complaints']
    };

    const allowed = canModify[userRole] || [];
    return allowed.includes('all') || allowed.includes(resource);
};

/**
 * Determines if user can delete resources
 */
export const canDelete = (userRole, resource) => {
    if (!userRole) return false;

    const canDel = {
        admin: ['all'],
        gm: [],
        dean: [],
        principal: [],
        warden: [],
        student: []
    };

    const allowed = canDel[userRole] || [];
    return allowed.includes('all') || allowed.includes(resource);
};

/**
 * Determines if user is read-only executive
 */
export const isReadOnlyExecutive = (userRole) => {
    return [ROLES.DEAN, ROLES.PRINCIPAL].includes(userRole);
};

/**
 * Determines if user is admin equivalent (should see all data)
 */
export const isAdminEquivalent = (userRole) => {
    return [ROLES.ADMIN, ROLES.GM].includes(userRole);
};

/**
 * Determines if user can manage users
 */
export const canManageUsers = (userRole) => {
    return userRole === ROLES.ADMIN;
};

/**
 * Determines if user can manage blocks
 */
export const canManageBlocks = (userRole) => {
    return userRole === ROLES.ADMIN;
};

/**
 * Determines if user can manage resources/config
 */
export const canManageResources = (userRole) => {
    return [ROLES.ADMIN, ROLES.GM].includes(userRole);
};

/**
 * Determines if user can access database viewer
 */
export const canAccessDatabase = (userRole) => {
    return userRole === ROLES.ADMIN;
};

/**
 * Determine display name for role
 */
export const getRoleDisplayName = (role) => {
    const names = {
        admin: 'Administrator',
        gm: 'General Manager',
        dean: 'Dean',
        principal: 'Principal',
        warden: 'Warden',
        student: 'Student'
    };
    return names[role] || 'Unknown';
};

/**
 * Get all role options (for user management, etc)
 */
export const getAllRoles = () => {
    return Object.values(ROLES);
};

export default {
    canView,
    canEdit,
    canDelete,
    isReadOnlyExecutive,
    isAdminEquivalent,
    canManageUsers,
    canManageBlocks,
    canManageResources,
    canAccessDatabase,
    getRoleDisplayName,
    getAllRoles,
    ROLES
};
