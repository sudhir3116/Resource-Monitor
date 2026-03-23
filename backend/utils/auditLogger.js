const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {String} params.action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {String} params.resourceType - Resource being modified
 * @param {String} params.resourceId - ID of the resource
 * @param {String} params.userId - ID of user performing action
 * @param {Object} params.changes - Before/after changes
 * @param {String} params.description - Human-readable description
 * @param {Object} params.req - Express request object (optional, for IP/UA)
 */
const createAuditLog = async (params) => {
    try {
        const logEntry = {
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            userId: params.userId,
            changes: params.changes,
            description: params.description,
            ipAddress: params.req?.ip || params.req?.connection?.remoteAddress,
            userAgent: params.req?.headers?.['user-agent']
        };

        await AuditLog.create(logEntry);
        console.log(`📝 Audit: ${params.action} ${params.resourceType} by user ${params.userId}`);
    } catch (error) {
        // Don't fail the main operation if audit logging fails
        console.error('Audit log error:', error.message);
    }
};

/**
 * Middleware to log API requests
 * Usage: Add to specific routes that need audit trailing
 */
const auditMiddleware = (action, resourceType) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.send;

        // Override send to capture response
        res.send = function (data) {
            // Only log successful operations (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                createAuditLog({
                    action,
                    resourceType,
                    resourceId: req.params.id || req.body?._id,
                    userId: req.user?.id,
                    description: `${action} ${resourceType}`,
                    req
                }).catch(err => console.error('Audit middleware error:', err));
            }

            // Call original send
            originalSend.call(this, data);
        };

        next();
    };
};

/**
 * Log usage creation/update/deletion
 */
const logUsageChange = async (action, userId, usage, oldUsage = null, req = null) => {
    const changes = {};
    if (oldUsage) {
        changes.before = {
            resource_type: oldUsage.resource_type,
            usage_value: oldUsage.usage_value,
            usage_date: oldUsage.usage_date
        };
    }
    if (usage) {
        changes.after = {
            resource_type: usage.resource_type,
            usage_value: usage.usage_value,
            usage_date: usage.usage_date
        };
    }

    await createAuditLog({
        action,
        resourceType: 'Usage',
        resourceId: usage?._id || oldUsage?._id,
        userId,
        changes,
        description: `${action} ${usage?.resource_type || oldUsage?.resource_type} usage record`,
        req
    });
};

/**
 * Log user changes (role updates, deletions)
 */
const logUserChange = async (action, adminId, user, oldData = null, req = null) => {
    const changes = {};
    if (oldData) {
        changes.before = { role: oldData.role, name: oldData.name };
    }
    if (user) {
        changes.after = { role: user.role, name: user.name };
    }

    await createAuditLog({
        action,
        resourceType: 'User',
        resourceId: user?._id || oldData?._id,
        userId: adminId,
        changes,
        description: `${action} user ${user?.name || oldData?.name}`,
        req
    });
};

/**
 * Log alert actions
 */
const logAlertAction = async (action, userId, alert, comment = null, req = null) => {
    await createAuditLog({
        action,
        resourceType: 'Alert',
        resourceId: alert._id,
        userId,
        changes: {
            before: { status: alert.status },
            after: { status: action === 'RESOLVE_ALERT' ? 'Resolved' : 'Reviewed', comment }
        },
        description: `${action} alert: ${alert.message}`,
        req
    });
};

/**
 * Log threshold configuration changes
 */
const logThresholdChange = async (action, userId, config, oldConfig = null, req = null) => {
    const changes = {};
    if (oldConfig) {
        changes.before = {
            dailyLimitPerPerson: oldConfig.dailyLimitPerPerson,
            monthlyLimitPerPerson: oldConfig.monthlyLimitPerPerson,
            rate: oldConfig.rate
        };
    }
    if (config) {
        changes.after = {
            dailyLimitPerPerson: config.dailyLimitPerPerson,
            monthlyLimitPerPerson: config.monthlyLimitPerPerson,
            rate: config.rate
        };
    }

    await createAuditLog({
        action,
        resourceType: 'SystemConfig',
        resourceId: config?._id || oldConfig?._id,
        userId,
        changes,
        description: `${action} threshold for ${config?.resource || oldConfig?.resource}`,
        req
    });
};

/**
 * Log authentication events
 */
const logAuthEvent = async (action, userId, req = null, description = '') => {
    await createAuditLog({
        action,
        resourceType: 'Auth',
        userId,
        description: description || action,
        req
    });
};

module.exports = {
    createAuditLog,
    auditMiddleware,
    logUsageChange,
    logUserChange,
    logAlertAction,
    logThresholdChange,
    logAuthEvent
};
