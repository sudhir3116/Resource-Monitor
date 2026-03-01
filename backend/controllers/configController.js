const SystemConfig = require('../models/SystemConfig');
const AuditLog = require('../models/AuditLog');
const Block = require('../models/Block');
const { ROLES } = require('../config/roles');

const ADMIN_ONLY = (req, res) => {
    if (req.user.role !== ROLES.ADMIN) {
        res.status(403).json({ success: false, message: 'Access denied: Only Administrators can modify resource configuration.' });
        return false;
    }
    return true;
};

const logConfigChange = async (req, action, resourceId, description, before, after) => {
    try {
        await AuditLog.create({
            action,
            resourceType: 'SystemConfig',
            resourceId,
            userId: req.user.id || req.userId,
            changes: { before, after },
            description,
            ipAddress: req.ip || req.connection?.remoteAddress
        });
    } catch (e) {
        console.error('Config audit log error:', e.message);
    }
};

/**
 * GET /api/config/thresholds
 * Get all resource configurations (Admin sees all; Warden read-only)
 */
exports.getThresholds = async (req, res) => {
    try {
        const configs = await SystemConfig.find({})
            .sort({ resource: 1 })
            .populate('updatedBy', 'name email')
            .populate('createdBy', 'name email');

        res.json({ success: true, data: configs });
    } catch (error) {
        console.error('getThresholds error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch configurations' });
    }
};

/**
 * GET /api/config/thresholds/:resource
 * Get specific resource configuration
 */
exports.getResourceThreshold = async (req, res) => {
    try {
        const { resource } = req.params;
        const config = await SystemConfig.findOne({ resource })
            .populate('updatedBy', 'name email');

        if (!config) {
            return res.status(404).json({ success: false, message: `Configuration for '${resource}' not found` });
        }
        res.json({ success: true, data: config });
    } catch (error) {
        console.error('getResourceThreshold error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch configuration' });
    }
};

/**
 * POST /api/config/thresholds
 * Create new resource configuration (Admin only)
 */
exports.createThreshold = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { resource, unit, costPerUnit, dailyThreshold, monthlyThreshold, isActive } = req.body;

        // Validation
        if (!resource || !unit) {
            return res.status(400).json({ success: false, message: 'resource and unit are required' });
        }
        if (costPerUnit === undefined || costPerUnit < 0) {
            return res.status(400).json({ success: false, message: 'costPerUnit must be 0 or greater' });
        }
        if (!dailyThreshold || dailyThreshold <= 0) {
            return res.status(400).json({ success: false, message: 'dailyThreshold must be greater than 0' });
        }
        if (!monthlyThreshold || monthlyThreshold <= 0) {
            return res.status(400).json({ success: false, message: 'monthlyThreshold must be greater than 0' });
        }
        if (dailyThreshold > monthlyThreshold) {
            return res.status(400).json({ success: false, message: 'Daily threshold cannot exceed monthly threshold' });
        }

        const existing = await SystemConfig.findOne({ resource });
        if (existing) {
            return res.status(409).json({ success: false, message: `Configuration for '${resource}' already exists. Use update instead.` });
        }

        const userId = req.user.id || req.userId;
        const config = await SystemConfig.create({
            resource, unit, costPerUnit, dailyThreshold, monthlyThreshold,
            isActive: isActive !== undefined ? isActive : true,
            // Legacy sync
            rate: costPerUnit,
            dailyLimitPerPerson: dailyThreshold,
            monthlyLimitPerPerson: monthlyThreshold,
            alertsEnabled: true,
            createdBy: userId,
            updatedBy: userId
        });

        await logConfigChange(req, 'CREATE', config._id,
            `Created resource config: ${resource} (${unit}, ₹${costPerUnit}/unit)`,
            null, config.toObject()
        );

        res.status(201).json({ success: true, message: `Configuration for '${resource}' created successfully`, data: config });
    } catch (error) {
        console.error('createThreshold error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: Object.values(error.errors).map(e => e.message).join('. ') });
        }
        res.status(500).json({ success: false, message: 'Failed to create configuration' });
    }
};

/**
 * PUT/PATCH /api/config/thresholds/:resource
 * Update resource configuration (Admin only)
 */
exports.updateThreshold = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { resource } = req.params;

        // Coerce to numbers — JSON body always sends correct types but be defensive
        const costPerUnit = req.body.costPerUnit !== undefined ? Number(req.body.costPerUnit) : undefined;
        const dailyThreshold = req.body.dailyThreshold !== undefined ? Number(req.body.dailyThreshold) : undefined;
        const monthlyThreshold = req.body.monthlyThreshold !== undefined ? Number(req.body.monthlyThreshold) : undefined;
        const { unit, isActive, alertsEnabled, spikeThreshold, severityThreshold } = req.body;

        console.log(`[configController] updateThreshold: resource=${resource}`, {
            costPerUnit, dailyThreshold, monthlyThreshold, unit, isActive
        });

        // Validation
        if (costPerUnit !== undefined && (isNaN(costPerUnit) || costPerUnit < 0)) {
            return res.status(400).json({ success: false, message: 'costPerUnit must be a number >= 0' });
        }
        if (dailyThreshold !== undefined && (isNaN(dailyThreshold) || dailyThreshold <= 0)) {
            return res.status(400).json({ success: false, message: 'dailyThreshold must be greater than 0' });
        }
        if (monthlyThreshold !== undefined && (isNaN(monthlyThreshold) || monthlyThreshold <= 0)) {
            return res.status(400).json({ success: false, message: 'monthlyThreshold must be greater than 0' });
        }

        const existing = await SystemConfig.findOne({ resource });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: `Configuration for '${resource}' not found`
            });
        }

        // Build update object — explicitly sync legacy fields too
        const updateData = { updatedBy: req.user.id || req.userId };
        if (unit !== undefined) updateData.unit = unit;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (alertsEnabled !== undefined) updateData.alertsEnabled = alertsEnabled;
        if (spikeThreshold !== undefined) updateData.spikeThreshold = Number(spikeThreshold);
        if (severityThreshold !== undefined) updateData.severityThreshold = severityThreshold;

        if (costPerUnit !== undefined) {
            updateData.costPerUnit = costPerUnit;
            updateData.rate = costPerUnit;           // legacy sync
        }
        if (dailyThreshold !== undefined) {
            updateData.dailyThreshold = dailyThreshold;
            updateData.dailyLimitPerPerson = dailyThreshold; // legacy sync
        }
        if (monthlyThreshold !== undefined) {
            updateData.monthlyThreshold = monthlyThreshold;
            updateData.monthlyLimitPerPerson = monthlyThreshold; // legacy sync
        }

        // Cross-field validation on effective values
        const effectiveDaily = dailyThreshold ?? existing.dailyThreshold;
        const effectiveMonthly = monthlyThreshold ?? existing.monthlyThreshold;
        if (effectiveDaily > effectiveMonthly) {
            return res.status(400).json({
                success: false,
                message: 'Daily threshold cannot exceed monthly threshold'
            });
        }

        const updated = await SystemConfig.findOneAndUpdate(
            { resource },
            { $set: updateData },
            { returnDocument: 'after', runValidators: false }  // validators off to avoid partial-doc issues
        ).populate('updatedBy', 'name email');

        if (!updated) {
            console.error(`[configController] updateThreshold: document not found after update for resource=${resource}`);
            return res.status(404).json({ success: false, message: `Configuration for '${resource}' not found after update` });
        }

        console.log(`[configController] updateThreshold: saved OK for ${resource}`, {
            costPerUnit: updated.costPerUnit,
            dailyThreshold: updated.dailyThreshold,
            monthlyThreshold: updated.monthlyThreshold
        });

        await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
            `Updated config for ${resource}: ${Object.keys(updateData).filter(k => k !== 'updatedBy').join(', ')} changed`,
            existing.toObject(), updated.toObject()
        );

        res.json({
            success: true,
            message: `Configuration for '${resource}' updated successfully`,
            data: updated
        });
    } catch (error) {
        console.error('[configController] updateThreshold FAILED — full error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors).map(e => e.message).join('. ')
            });
        }
        res.status(500).json({ success: false, message: 'Failed to update configuration. Check server logs.' });
    }
};

/**
 * PUT /api/config/thresholds/by-id/:id
 * Update resource configuration by MongoDB _id (Admin only)
 */
exports.updateThresholdById = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { id } = req.params;
        const costPerUnit = req.body.costPerUnit !== undefined ? Number(req.body.costPerUnit) : undefined;
        const dailyThreshold = req.body.dailyThreshold !== undefined ? Number(req.body.dailyThreshold) : undefined;
        const monthlyThreshold = req.body.monthlyThreshold !== undefined ? Number(req.body.monthlyThreshold) : undefined;
        const { unit, isActive, alertsEnabled } = req.body;

        if (costPerUnit !== undefined && (isNaN(costPerUnit) || costPerUnit < 0))
            return res.status(400).json({ success: false, message: 'costPerUnit must be >= 0' });
        if (dailyThreshold !== undefined && (isNaN(dailyThreshold) || dailyThreshold <= 0))
            return res.status(400).json({ success: false, message: 'dailyThreshold must be > 0' });
        if (monthlyThreshold !== undefined && (isNaN(monthlyThreshold) || monthlyThreshold <= 0))
            return res.status(400).json({ success: false, message: 'monthlyThreshold must be > 0' });

        const existing = await SystemConfig.findById(id);
        if (!existing)
            return res.status(404).json({ success: false, message: 'Configuration not found' });

        const updateData = { updatedBy: req.user.id || req.userId };
        if (unit !== undefined) updateData.unit = unit;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (alertsEnabled !== undefined) updateData.alertsEnabled = alertsEnabled;
        if (costPerUnit !== undefined) { updateData.costPerUnit = costPerUnit; updateData.rate = costPerUnit; }
        if (dailyThreshold !== undefined) { updateData.dailyThreshold = dailyThreshold; updateData.dailyLimitPerPerson = dailyThreshold; }
        if (monthlyThreshold !== undefined) { updateData.monthlyThreshold = monthlyThreshold; updateData.monthlyLimitPerPerson = monthlyThreshold; }

        const effectiveDaily = dailyThreshold ?? existing.dailyThreshold;
        const effectiveMonthly = monthlyThreshold ?? existing.monthlyThreshold;
        if (effectiveDaily > effectiveMonthly)
            return res.status(400).json({ success: false, message: 'Daily threshold cannot exceed monthly threshold' });

        const updated = await SystemConfig.findByIdAndUpdate(
            id, { $set: updateData }, { returnDocument: 'after', runValidators: false }
        ).populate('updatedBy', 'name email');

        await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
            `Updated config for ${updated.resource} by ID`,
            existing.toObject(), updated.toObject()
        );

        res.json({ success: true, message: `Configuration updated successfully`, data: updated });
    } catch (error) {
        console.error('[configController] updateThresholdById FAILED:', error);
        res.status(500).json({ success: false, message: 'Failed to update configuration. Check server logs.' });
    }
};

/**
 * POST /api/config/thresholds/bulk-update
 * Bulk update multiple resources at once (Admin only)
 */
exports.bulkUpdateThresholds = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { configs } = req.body; // Array of { resource, costPerUnit, dailyThreshold, monthlyThreshold, unit, isActive }
        if (!Array.isArray(configs) || configs.length === 0) {
            return res.status(400).json({ success: false, message: 'configs array is required' });
        }

        const results = [];
        const errors = [];

        for (const cfg of configs) {
            try {
                const { resource, costPerUnit, dailyThreshold, monthlyThreshold, unit, isActive, alertsEnabled } = cfg;
                if (!resource) { errors.push({ resource: '?', error: 'resource name missing' }); continue; }
                if (costPerUnit !== undefined && costPerUnit < 0) { errors.push({ resource, error: 'costPerUnit cannot be negative' }); continue; }
                if (dailyThreshold !== undefined && dailyThreshold <= 0) { errors.push({ resource, error: 'dailyThreshold must be > 0' }); continue; }
                if (monthlyThreshold !== undefined && monthlyThreshold <= 0) { errors.push({ resource, error: 'monthlyThreshold must be > 0' }); continue; }

                const existing = await SystemConfig.findOne({ resource });
                const updateData = { updatedBy: req.user.id || req.userId };
                if (unit !== undefined) updateData.unit = unit;
                if (isActive !== undefined) updateData.isActive = isActive;
                if (alertsEnabled !== undefined) updateData.alertsEnabled = alertsEnabled;
                if (costPerUnit !== undefined) { updateData.costPerUnit = costPerUnit; updateData.rate = costPerUnit; }
                if (dailyThreshold !== undefined) { updateData.dailyThreshold = dailyThreshold; updateData.dailyLimitPerPerson = dailyThreshold; }
                if (monthlyThreshold !== undefined) { updateData.monthlyThreshold = monthlyThreshold; updateData.monthlyLimitPerPerson = monthlyThreshold; }

                const updated = await SystemConfig.findOneAndUpdate(
                    { resource }, { $set: updateData }, { returnDocument: 'after', upsert: false }
                );

                if (!updated) { errors.push({ resource, error: 'Config not found' }); continue; }

                await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
                    `Bulk update: ${resource} configuration updated`,
                    existing?.toObject(), updated.toObject()
                );
                results.push(updated);
            } catch (err) {
                errors.push({ resource: cfg.resource || '?', error: err.message });
            }
        }

        res.json({ success: true, message: `Updated ${results.length} configuration(s)`, data: results, errors });
    } catch (error) {
        console.error('bulkUpdateThresholds error:', error);
        res.status(500).json({ success: false, message: 'Failed to bulk update configurations' });
    }
};

/**
 * PUT /api/config/thresholds/:resource/block-override/:blockId
 * Set or update a block-level threshold override (Admin only)
 */
exports.setBlockOverride = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { resource, blockId } = req.params;
        const { dailyThreshold, monthlyThreshold } = req.body;

        if (dailyThreshold !== undefined && dailyThreshold < 0) {
            return res.status(400).json({ success: false, message: 'dailyThreshold cannot be negative' });
        }
        if (monthlyThreshold !== undefined && monthlyThreshold < 0) {
            return res.status(400).json({ success: false, message: 'monthlyThreshold cannot be negative' });
        }

        const config = await SystemConfig.findOne({ resource });
        if (!config) {
            return res.status(404).json({ success: false, message: `Config for '${resource}' not found` });
        }

        // Verify block exists
        const block = await Block.findById(blockId);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found' });
        }

        // Build override
        const override = {
            blockName: block.name,
            dailyThreshold: dailyThreshold !== undefined ? dailyThreshold : config.blockOverrides?.get(blockId)?.dailyThreshold,
            monthlyThreshold: monthlyThreshold !== undefined ? monthlyThreshold : config.blockOverrides?.get(blockId)?.monthlyThreshold,
        };

        const before = config.toObject();

        // Use $set with dot notation for Map field
        const updated = await SystemConfig.findOneAndUpdate(
            { resource },
            {
                $set: {
                    [`blockOverrides.${blockId}`]: override,
                    updatedBy: req.user.id || req.userId
                }
            },
            { returnDocument: 'after' }
        ).populate('updatedBy', 'name email');

        await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
            `Set block override for ${resource} on block '${block.name}': daily=${override.dailyThreshold}, monthly=${override.monthlyThreshold}`,
            before, updated.toObject()
        );

        res.json({ success: true, message: `Block override set for '${block.name}'`, data: updated });
    } catch (error) {
        console.error('setBlockOverride error:', error);
        res.status(500).json({ success: false, message: 'Failed to set block override' });
    }
};

/**
 * DELETE /api/config/thresholds/:resource/block-override/:blockId
 * Remove block-level override (Admin only)
 */
exports.removeBlockOverride = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { resource, blockId } = req.params;

        const config = await SystemConfig.findOne({ resource });
        if (!config) return res.status(404).json({ success: false, message: `Config for '${resource}' not found` });

        const before = config.toObject();

        const updated = await SystemConfig.findOneAndUpdate(
            { resource },
            { $unset: { [`blockOverrides.${blockId}`]: 1 }, $set: { updatedBy: req.user.id || req.userId } },
            { returnDocument: 'after' }
        );

        await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
            `Removed block override for ${resource} on block ID ${blockId}`,
            before, updated.toObject()
        );

        res.json({ success: true, message: 'Block override removed', data: updated });
    } catch (error) {
        console.error('removeBlockOverride error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove block override' });
    }
};

/**
 * DELETE /api/config/thresholds/:resource
 * Delete a resource config entirely (Admin only)
 */
exports.deleteThreshold = async (req, res) => {
    if (!ADMIN_ONLY(req, res)) return;

    try {
        const { resource } = req.params;
        const config = await SystemConfig.findOneAndDelete({ resource });
        if (!config) {
            return res.status(404).json({ success: false, message: `Configuration for '${resource}' not found` });
        }

        await logConfigChange(req, 'DELETE', config._id,
            `Deleted resource config: ${resource}`,
            config.toObject(), null
        );

        res.json({ success: true, message: `Configuration for '${resource}' deleted` });
    } catch (error) {
        console.error('deleteThreshold error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete configuration' });
    }
};

/**
 * GET /api/config/blocks
 * Get all blocks (for block override UI) — Admin/Warden
 */
exports.getBlocks = async (req, res) => {
    try {
        const blocks = await Block.find({}).select('name type status').sort({ name: 1 });
        res.json({ success: true, data: blocks });
    } catch (error) {
        console.error('getBlocks error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch blocks' });
    }
};

module.exports = exports;
