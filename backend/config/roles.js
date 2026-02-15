const ROLES = {
    STUDENT: 'student',
    ADMIN: 'admin',
    WARDEN: 'warden',
    DEAN: 'dean',
    PRINCIPAL: 'principal'
};

const ACCESS_LEVELS = {
    [ROLES.STUDENT]: { read: ['own'], write: ['own'] },
    [ROLES.WARDEN]: { read: ['hostel'], write: ['hostel'] },
    [ROLES.ADMIN]: { read: ['all'], write: ['all'] },
    [ROLES.DEAN]: { read: ['campus'], write: ['none'] },
    [ROLES.PRINCIPAL]: { read: ['all'], write: ['none'] } // Read-only full overview
};

module.exports = {
    ROLES,
    ACCESS_LEVELS
};
