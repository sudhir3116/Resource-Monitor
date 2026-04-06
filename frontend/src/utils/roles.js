export const ROLES = {
    STUDENT: 'student',
    ADMIN: 'admin',
    WARDEN: 'warden',
    DEAN: 'dean',
    PRINCIPAL: 'principal',
    GM: 'gm'
};

export const hasAccess = (userRole, allowedRoles) => {
    if (!userRole) return false;
    return allowedRoles.includes(userRole);
};

export const isAdmin = (role) => role === ROLES.ADMIN;
export const isPrincipal = (role) => role === ROLES.PRINCIPAL;
export const isDean = (role) => role === ROLES.DEAN;
export const isWarden = (role) => role === ROLES.WARDEN;
export const isStudent = (role) => role === ROLES.STUDENT;
export const isGM = (role) => role === ROLES.GM;
