const SystemConfig = require('../models/SystemConfig');

/**
 * GET /api/admin/config/thresholds
 * Get all resource threshold configurations
 */
exports.getAllThresholds = async (req, res) => {
    try {
        const configs = await SystemConfig.find().sort({ resource: 1 });
        res.json({ configs });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * GET /api/admin/config/thresholds/:resource
 * Get threshold config for a specific resource
 */
exports.getThresholdByResource = async (req, res) => {
    try {
        const config = await SystemConfig.findOne({ resource: req.params.resource });
        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }
        res.json({ config });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /api/admin/config/thresholds
 * Create a new resource threshold configuration
 */
exports.createThreshold = async (req, res) => {
    try {
        const {
            resource,
            dailyLimitPerPerson,
            dailyLimitPerBlock,
            monthlyLimitPerPerson,
            monthlyLimitPerBlock,
            unit,
            rate,
            severityThreshold,
            alertLevel,
            spikeThreshold,
            alertsEnabled
        } = req.body;

        // Check if config already exists
        const existing = await SystemConfig.findOne({ resource });
        if (existing) {
            return res.status(409).json({ message: 'Configuration for this resource already exists. Use update instead.' });
        }

        const config = await SystemConfig.create({
            resource,
            dailyLimitPerPerson,
            dailyLimitPerBlock,
            monthlyLimitPerPerson,
            monthlyLimitPerBlock,
            unit,
            rate,
            severityThreshold,
            alertLevel,
            spikeThreshold,
            alertsEnabled
        });

        res.status(201).json({ config, message: 'Threshold configuration created successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * PUT /api/admin/config/thresholds/:resource
 * Update threshold configuration for a resource
 */
exports.updateThreshold = async (req, res) => {
    try {
        const config = await SystemConfig.findOneAndUpdate(
            { resource: req.params.resource },
            req.body,
            { new: true, runValidators: true }
        );

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        res.json({ config, message: 'Threshold configuration updated successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * DELETE /api/admin/config/thresholds/:resource
 * Delete threshold configuration for a resource
 */
exports.deleteThreshold = async (req, res) => {
    try {
        const config = await SystemConfig.findOneAndDelete({ resource: req.params.resource });

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        res.json({ message: 'Threshold configuration deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * PATCH /api/admin/config/thresholds/:resource/toggle
 * Toggle alerts on/off for a resource
 */
exports.toggleAlerts = async (req, res) => {
    try {
        const config = await SystemConfig.findOne({ resource: req.params.resource });

        if (!config) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        config.alertsEnabled = !config.alertsEnabled;
        await config.save();

        res.json({
            config,
            message: `Alerts ${config.alertsEnabled ? 'enabled' : 'disabled'} for ${req.params.resource}`
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
