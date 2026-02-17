const User = require('../models/User');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Block = require('../models/Block');
const AuditLog = require('../models/AuditLog');

exports.listUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .populate('block', 'name')
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            message: 'Users fetched successfully',
            data: users
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        // Prevent deleting self
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Audit Log
        await AuditLog.create({
            action: 'DELETE',
            resourceType: 'User',
            resourceId: req.params.id,
            userId: req.user.id,
            description: `Deleted user: ${user.email} (${user.role})`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: { before: user.toObject() }
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete user', error: err.message });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const { ROLES } = require('../config/roles');
        const validRoles = Object.values(ROLES);

        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role. Valid roles: ' + validRoles.join(', ') });
        }

        const oldUser = await User.findById(req.params.id);
        if (!oldUser) return res.status(404).json({ success: false, message: 'User not found' });

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');

        // Audit Log
        await AuditLog.create({
            action: 'UPDATE',
            resourceType: 'User',
            resourceId: user._id,
            userId: req.user.id,
            description: `Updated role for ${user.email} from ${oldUser.role} to ${role}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: {
                before: { role: oldUser.role },
                after: { role: user.role }
            }
        });

        res.json({ success: true, message: 'User role updated', data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update user role', error: err.message });
    }
};

exports.getSystemUsageSummary = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalUsage = await Usage.countDocuments();
        const totalAlerts = await Alert.countDocuments();

        const [resourceStats, hostelStats] = await Promise.all([
            Usage.aggregate([
                { $group: { _id: '$resource_type', total: { $sum: '$usage_value' } } }
            ]),
            Usage.aggregate([
                { $group: { _id: '$category', total: { $sum: '$usage_value' } } }
            ])
        ]);

        const resourceTotals = {};
        resourceStats.forEach(stat => {
            resourceTotals[stat._id] = stat.total;
        });

        const hostelTotals = {};
        hostelStats.forEach(stat => {
            if (stat._id) hostelTotals[stat._id] = stat.total;
        });

        res.json({
            success: true,
            message: 'System summary fetched',
            data: {
                totalUsers,
                totalUsage,
                totalAlerts,
                resourceTotals,
                hostelTotals
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch summary', error: err.message });
    }
};

exports.getBlocks = async (req, res) => {
    try {
        const blocks = await Block.find().sort({ name: 1 });
        res.json({ success: true, message: 'Blocks fetched', data: blocks });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch blocks', error: err.message });
    }
};
