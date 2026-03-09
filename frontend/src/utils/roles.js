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
