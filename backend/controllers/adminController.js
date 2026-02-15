const User = require('../models/User');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');

exports.listUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const { ROLES } = require('../config/roles');
        const validRoles = Object.values(ROLES);

        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Valid roles: ' + validRoles.join(', ') });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
            totalUsers,
            totalUsage,
            totalAlerts,
            resourceTotals,
            hostelTotals
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
