const SystemConfig = require('../models/SystemConfig');
const { ROLES } = require('../config/roles');

/**
 * @desc    Get all resource threshold configurations
 * @route   GET /api/config/thresholds
 * @access  Private
 */
exports.getThresholds = async (req, res) => {
    try {
        const configs = await SystemConfig.find({})
            .sort({ resource: 1 })
            .populate('updatedBy', 'name email');

        res.json({
            success: true,
            message: 'Thresholds fetched successfully',
            data: configs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch thresholds',
            error: error.message
        });
    }
};

/**
 * @desc    Get threshold for specific resource
 * @route   GET /api/config/thresholds/:resource
 * @access  Private
 */
exports.getResourceThreshold = async (req, res) => {
    try {
        const { resource } = req.params;

        const config = await SystemConfig.findOne({ resource })
            .populate('updatedBy', 'name email');

        if (!config) {
            return res.status(404).json({
                success: false,
                message: `Threshold configuration for ${resource} not found`
            });
        }

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch resource threshold',
            error: error.message
        });
    }
};

/**
 * @desc    Update threshold configuration for a resource
 * @route   PUT /api/config/thresholds/:resource
 * @access  Private (Admin only)
 */
exports.updateThreshold = async (req, res) => {
    try {
        if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Only administrators can update thresholds'
            });
        }

        const { resource } = req.params;
        const updateData = req.body;

        // Validation
        if (updateData.dailyLimitPerPerson && updateData.dailyLimitPerPerson <= 0) {
            return res.status(400).json({ success: false, message: 'Daily limit must be positive' });
        }
        if (updateData.rate && updateData.rate < 0) {
            return res.status(400).json({ success: false, message: 'Rate cannot be negative' });
        }

        if (updateData.resource && updateData.resource !== resource) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change resource name. Create a new config instead.'
            });
        }

        const config = await SystemConfig.findOneAndUpdate(
            { resource },
            {
                ...updateData,
                updatedBy: req.user.id,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!config) {
            return res.status(404).json({
                success: false,
                message: `Configuration for ${resource} not found`
            });
        }

        res.json({
            success: true,
            message: `Threshold for ${resource} updated successfully`,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update threshold',
            error: error.message
        });
    }
};

/**
 * @desc    Create new threshold configuration
 * @route   POST /api/config/thresholds
 * @access  Private (Admin only)
 */
exports.createThreshold = async (req, res) => {
    try {
        if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Only administrators can create thresholds'
            });
        }

        const { resource, dailyLimitPerPerson, unit, rate } = req.body;

        // Validation
        if (!resource || !dailyLimitPerPerson || !unit || rate === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields: resource, dailyLimitPerPerson, unit, rate' });
        }
        if (dailyLimitPerPerson <= 0) return res.status(400).json({ success: false, message: 'Daily limit must be positive' });
        if (rate < 0) return res.status(400).json({ success: false, message: 'Rate cannot be negative' });


        const existing = await SystemConfig.findOne({ resource });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Configuration for ${resource} already exists. Use update instead.`
            });
        }

        const configData = {
            ...req.body,
            createdBy: req.user.id,
            updatedBy: req.user.id
        };

        const config = await SystemConfig.create(configData);

        res.status(201).json({
            success: true,
            message: 'Threshold configuration created successfully',
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create threshold',
            error: error.message
        });
    }
};

/**
 * @desc    Delete threshold configuration
 * @route   DELETE /api/config/thresholds/:resource
 * @access  Private (Admin only)
 */
exports.deleteThreshold = async (req, res) => {
    try {
        if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Only administrators can delete thresholds'
            });
        }

        const { resource } = req.params;

        const config = await SystemConfig.findOneAndDelete({ resource });

        if (!config) {
            return res.status(404).json({
                success: false,
                message: `Configuration for ${resource} not found`
            });
        }

        res.json({
            success: true,
            message: `Threshold for ${resource} deleted successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete threshold',
            error: error.message
        });
    }
};

module.exports = exports;
