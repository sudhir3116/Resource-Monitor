const Resource = require('../models/ResourceConfig');
const Block = require('../models/Block');
const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../config/roles');

const ADMIN_ONLY = (req, res) => {
    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.GM) {
        res.status(403).json({ success: false, message: 'Access denied: Only Administrators or GMs can modify resource configuration.' });
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
 * Notify connected clients to refresh resource-driven UIs.
 * Non-fatal: if socket isn't initialized, we silently skip.
 */
const emitResourcesRefresh = async () => {
    try {
        const socketUtil = require('../utils/socket');
        const socketManager = require('../socket/socketManager');
        const io = socketUtil.getIO && socketUtil.getIO();
        if (!io) return;

        io.emit('resources:refresh');
        // Also target common admin rooms for reliability.
        socketManager.emitToRole(io, 'admin', 'resources:refresh', {});
        socketManager.emitToRole(io, 'gm', 'resources:refresh', {});
    } catch {
        // non-fatal
    }
};

/**
 * GET /api/config/thresholds
 * Get all resource configurations (Admin sees all; Warden read-only)
 */
exports.getThresholds = async (req, res) => {
    try {
        const role = req.user?.role?.toLowerCase();
        const filter = {};
        if (role !== 'admin' && role !== 'gm') {
            filter.isActive = true;
        }

        const configs = await Resource.find(filter)
            .sort({ name: 1 })
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
        const config = await Resource.findOne({ name: resource })
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
        const {
            name, resource, // support both
            unit,
            rate, costPerUnit, // support both
            dailyLimit, dailyThreshold, // support both
            monthlyLimit, monthlyThreshold, // support both
            emoji, icon, // support both
            color,
            isActive
        } = req.body;

        // Map inputs to schema fields
        const finalName = (name || resource || '').trim();
        const finalUnit = (unit || '').trim();
        const finalRate = rate !== undefined ? Number(rate) : (costPerUnit !== undefined ? Number(costPerUnit) : 0);
        const finalDaily = dailyLimit !== undefined ? Number(dailyLimit) : (dailyThreshold !== undefined ? Number(dailyThreshold) : 0);
        const finalMonthly = monthlyLimit !== undefined ? Number(monthlyLimit) : (monthlyThreshold !== undefined ? Number(monthlyThreshold) : 0);
        const finalEmoji = emoji || icon || '📊';
        const finalColor = color || '#3B82F6';

        // Validation
        if (!finalName || !finalUnit) {
            return res.status(400).json({ success: false, message: 'Resource name and unit are required' });
        }
        if (finalRate < 0) {
            return res.status(400).json({ success: false, message: 'Rate must be 0 or greater' });
        }
        if (finalDaily <= 0) {
            return res.status(400).json({ success: false, message: 'Daily limit must be greater than 0' });
        }
        if (finalMonthly <= 0) {
            return res.status(400).json({ success: false, message: 'Monthly limit must be greater than 0' });
        }
        if (finalDaily > finalMonthly) {
            return res.status(400).json({ success: false, message: 'Daily limit cannot exceed monthly limit' });
        }

        const existing = await Resource.findOne({ name: { $regex: new RegExp(`^${finalName}$`, 'i') } });
        if (existing) {
            return res.status(409).json({ success: false, message: `Configuration for '${finalName}' already exists` });
        }

        const userId = req.user.id || req.userId;
        const config = await Resource.create({
            name: finalName,
            unit: finalUnit,
            rate: finalRate,
            dailyLimit: finalDaily,
            monthlyLimit: finalMonthly,
            status: "active",
            isActive: isActive !== undefined ? isActive : true,
            icon: finalEmoji,
            color: finalColor,
            createdBy: userId,
            updatedBy: userId
        });


        await logConfigChange(req, 'CREATE', config._id,
            `Created resource config: ${resource} (${unit}, ₹${costPerUnit}/unit)`,
            null, config.toObject()
        );

        await emitResourcesRefresh();
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
        const {
            name, resource: newResourceName, // name change support
            unit,
            rate, costPerUnit,
            dailyLimit, dailyThreshold,
            monthlyLimit, monthlyThreshold,
            isActive,
            emoji, icon,
            color,
            alertsEnabled, spikeThreshold, severityThreshold
        } = req.body;

        const finalRate = rate !== undefined ? Number(rate) : (costPerUnit !== undefined ? Number(costPerUnit) : undefined);
        const finalDaily = dailyLimit !== undefined ? Number(dailyLimit) : (dailyThreshold !== undefined ? Number(dailyThreshold) : undefined);
        const finalMonthly = monthlyLimit !== undefined ? Number(monthlyLimit) : (monthlyThreshold !== undefined ? Number(monthlyThreshold) : undefined);

        // Validation
        if (finalRate !== undefined && (isNaN(finalRate) || finalRate < 0)) {
            return res.status(400).json({ success: false, message: 'Rate must be a number >= 0' });
        }
        if (finalDaily !== undefined && (isNaN(finalDaily) || finalDaily <= 0)) {
            return res.status(400).json({ success: false, message: 'Daily limit must be greater than 0' });
        }
        if (finalMonthly !== undefined && (isNaN(finalMonthly) || finalMonthly <= 0)) {
            return res.status(400).json({ success: false, message: 'Monthly limit must be greater than 0' });
        }

        const existing = await Resource.findOne({ resource });
        if (!existing) {
            return res.status(404).json({ success: false, message: `Configuration for '${resource}' not found` });
        }

        // Build update object
        const updateData = { updatedBy: req.user.id || req.userId };
        if (newResourceName || name) updateData.resource = (newResourceName || name).trim();
        if (unit !== undefined) updateData.unit = unit;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (alertsEnabled !== undefined) updateData.alertsEnabled = alertsEnabled;
        if (spikeThreshold !== undefined) updateData.spikeThreshold = Number(spikeThreshold);
        if (severityThreshold !== undefined) updateData.severityThreshold = severityThreshold;
        if (emoji !== undefined || icon !== undefined) updateData.icon = emoji || icon;
        if (color !== undefined) updateData.color = color;

        if (finalRate !== undefined) {
            updateData.costPerUnit = finalRate;
            updateData.rate = finalRate;           // legacy sync
        }
        if (finalDaily !== undefined) {
            updateData.dailyThreshold = finalDaily;
            updateData.dailyLimitPerPerson = finalDaily; // legacy sync
        }
        if (finalMonthly !== undefined) {
            updateData.monthlyThreshold = finalMonthly;
            updateData.monthlyLimitPerPerson = finalMonthly; // legacy sync
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

        const updated = await Resource.findOneAndUpdate(
            { name: resource },
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

        await emitResourcesRefresh();
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

        const existing = await Resource.findById(id);
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

        const updated = await Resource.findByIdAndUpdate(
            id, { $set: updateData }, { returnDocument: 'after', runValidators: false }
        ).populate('updatedBy', 'name email');

        await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
            `Updated config for ${updated.name} by ID`,
            existing.toObject(), updated.toObject()
        );

        await emitResourcesRefresh();
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
        const { configs } = req.body; // Array of { resource, costPerUnit, dailyThreshold, monthlyThreshold, unit, isActive, icon, color }
        if (!Array.isArray(configs) || configs.length === 0) {
            return res.status(400).json({ success: false, message: 'configs array is required' });
        }

        const results = [];
        const errors = [];

        for (const cfg of configs) {
            try {
                const { resource, costPerUnit, dailyThreshold, monthlyThreshold, unit, isActive, alertsEnabled, icon, color } = cfg;
                if (!resource) { errors.push({ resource: '?', error: 'resource name missing' }); continue; }
                if (costPerUnit !== undefined && costPerUnit < 0) { errors.push({ resource, error: 'costPerUnit cannot be negative' }); continue; }
                if (dailyThreshold !== undefined && dailyThreshold <= 0) { errors.push({ resource, error: 'dailyThreshold must be > 0' }); continue; }
                if (monthlyThreshold !== undefined && monthlyThreshold <= 0) { errors.push({ resource, error: 'monthlyThreshold must be > 0' }); continue; }

                const updated = await Resource.findOneAndUpdate(
                    { name: resource }, { $set: updateData }, { returnDocument: 'after', upsert: false }
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

        await emitResourcesRefresh();
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

        const config = await Resource.findOne({ name: resource });
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
        const updated = await Resource.findOneAndUpdate(
            { name: resource },
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

        await emitResourcesRefresh();
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

        const config = await Resource.findOne({ name: resource });
        if (!config) return res.status(404).json({ success: false, message: `Config for '${resource}' not found` });

        const before = config.toObject();

        const updated = await Resource.findOneAndUpdate(
            { name: resource },
            { $unset: { [`blockOverrides.${blockId}`]: 1 }, $set: { updatedBy: req.user.id || req.userId } },
            { returnDocument: 'after' }
        );

        await logConfigChange(req, 'UPDATE_THRESHOLD', updated._id,
            `Removed block override for ${resource} on block ID ${blockId}`,
            before, updated.toObject()
        );

        await emitResourcesRefresh();
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
        const config = await Resource.findOneAndDelete({ name: resource });
        if (!config) {
            return res.status(404).json({ success: false, message: `Configuration for '${resource}' not found` });
        }

        await logConfigChange(req, 'DELETE', config._id,
            `Deleted resource config: ${resource}`,
            config.toObject(), null
        );

        await emitResourcesRefresh();
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
