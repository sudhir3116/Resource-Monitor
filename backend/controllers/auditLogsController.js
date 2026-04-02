const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../config/roles');

/**
 * @desc    Get audit logs with filters
 * @route   GET /api/audit-logs?action=&resourceType=&userId=&limit=50
 * @access  Private (Admin, Dean, Principal only)
 */
exports.getAuditLogs = async (req, res) => {
    try {
        // Only admins, deans, principals, and GMs can view audit logs
        if (![ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Audit logs are restricted to authorized personnel.'
            });
        }

        const { action, resourceType, userId, startDate, endDate, limit = 100 } = req.query;

        let filter = {};

        if (action) filter.action = action;
        if (resourceType) filter.resourceType = resourceType;
        if (userId) filter.userId = userId;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const logs = await AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('userId', 'name email role')
            .lean();

        // Summary stats
        const totalLogs = await AuditLog.countDocuments(filter);
        const actionStats = await AuditLog.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            logs,
            stats: {
                total: totalLogs,
                returned: logs.length,
                byAction: actionStats
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Get audit logs for a specific resource
 * @route   GET /api/audit-logs/resource/:resourceType/:resourceId
 * @access  Private (Admin, Dean, Principal)
 */
exports.getResourceAuditHistory = async (req, res) => {
    try {
        if (![ROLES.ADMIN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const { resourceType, resourceId } = req.params;

        const logs = await AuditLog.find({
            resourceType,
            resourceId
        })
            .sort({ createdAt: -1 })
            .populate('userId', 'name email')
            .lean();

        res.json({
            success: true,
            resourceType,
            resourceId,
            history: logs
        });
    } catch (error) {
        console.error('Get resource audit history error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Get audit statistics
 * @route   GET /api/audit-logs/stats?days=30
 * @access  Private (Admin only)
 */
exports.getAuditStats = async (req, res) => {
    try {
        // For stats, let's keep it restricted to Admin and GM (Managers)
        if (![ROLES.ADMIN, ROLES.GM].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Manager access only.'
            });
        }

        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Total actions
        const totalActions = await AuditLog.countDocuments({
            createdAt: { $gte: startDate }
        });

        // By action type
        const byAction = await AuditLog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // By resource type
        const byResource = await AuditLog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$resourceType',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // By user (top 10 most active)
        const byUser = await AuditLog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Populate user names
        const User = require('../models/User');
        const userIds = byUser.map(u => u._id);
        const users = await User.find({ _id: { $in: userIds } }, 'name email');
        const userMap = {};
        users.forEach(u => userMap[u._id] = { name: u.name, email: u.email });
        byUser.forEach(u => u.user = userMap[u._id]);

        // Daily trend
        const dailyTrend = await AuditLog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            period: `Last ${days} days`,
            stats: {
                totalActions,
                byAction,
                byResource,
                topUsers: byUser,
                dailyTrend
            }
        });
    } catch (error) {
        console.error('Get audit stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * @desc    Check for duplicate usage entries
 * @route   POST /api/audit-logs/check-duplicate
 * @access  Private
 */
exports.checkDuplicate = async (req, res) => {
    try {
        const { resource_type, usage_value, usage_date, blockId } = req.body;

        if (!resource_type || !usage_value || !usage_date) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const Usage = require('../models/Usage');

        // Check for similar entries within 1 hour window
        const checkDate = new Date(usage_date);
        const hourBefore = new Date(checkDate.getTime() - 60 * 60 * 1000);
        const hourAfter = new Date(checkDate.getTime() + 60 * 60 * 1000);

        const filter = {
            resource_type,
            usage_value: {
                $gte: usage_value * 0.95, // Within 5% of value
                $lte: usage_value * 1.05
            },
            usage_date: {
                $gte: hourBefore,
                $lte: hourAfter
            }
        };

        if (blockId) filter.blockId = blockId;
        // Exclude soft-deleted records
        filter.deleted = { $ne: true };

        const duplicates = await Usage.find(filter)
            .populate('createdBy', 'name email')
            .populate('blockId', 'name')
            .limit(5);

        const isDuplicate = duplicates.length > 0;

        res.json({
            success: true,
            isDuplicate,
            duplicates: duplicates.map(d => ({
                id: d._id,
                resource_type: d.resource_type,
                usage_value: d.usage_value,
                usage_date: d.usage_date,
                block: d.blockId?.name,
                createdBy: d.createdBy?.name,
                createdAt: d.createdAt
            })),
            message: isDuplicate ?
                `Found ${duplicates.length} similar ${duplicates.length === 1 ? 'entry' : 'entries'}. Please verify before creating.` :
                'No duplicates found.'
        });
    } catch (error) {
        console.error('Check duplicate error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = exports;
