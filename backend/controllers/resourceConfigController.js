const SystemConfig = require('../models/SystemConfig');

/**
 * GET /api/resource-config
 * Returns resource configurations from SystemConfig (the single source of truth):
 * - Admin: All resources (active and inactive)
 * - All other users: Only active resources (isActive !== false)
 */
exports.getAll = async (req, res) => {
    try {
        const role = req.user?.role?.toLowerCase();

        // Build filter based on role
        const filter = {};
        // Buyer requirement: inactive resources must not appear anywhere except Admin.
        if (role !== 'admin') {
            filter.isActive = true;
        }

        const systems = await SystemConfig.find(filter).sort({ resource: 1 }).lean();

        // Map SystemConfig fields to ResourceConfig shape for frontend compatibility
        const resources = systems.map(s => ({
            _id: s._id,
            name: s.resource,
            unit: s.unit || 'units',
            dailyLimit: s.dailyThreshold || s.dailyLimitPerPerson || 0,
            monthlyLimit: s.monthlyThreshold || s.monthlyLimitPerPerson || 0,
            costPerUnit: s.costPerUnit || s.rate || 0,
            icon: s.icon || '📊',
            color: s.color || '#64748b',
            isActive: s.isActive !== false
        }));

        return res.status(200).json({
            success: true,
            count: resources.length,
            data: resources,
            resources: resources
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/resource-config
 * Create a new resource configuration (admin only)
 * Proxies to SystemConfig
 */
exports.create = async (req, res) => {
    try {
        const { name, unit, dailyLimit, monthlyLimit, icon, color } = req.body;

        if (!name || !unit) {
            return res.status(400).json({ success: false, message: 'Name and unit are required' });
        }

        const existing = await SystemConfig.findOne({
            resource: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existing) {
            return res.status(409).json({ success: false, message: `Resource "${name}" already exists` });
        }

        const config = await SystemConfig.create({
            resource: name.trim(),
            unit: unit.trim(),
            dailyThreshold: dailyLimit || 100,
            monthlyThreshold: monthlyLimit || 3000,
            // Legacy sync
            dailyLimitPerPerson: dailyLimit || 100,
            monthlyLimitPerPerson: monthlyLimit || 3000,
            costPerUnit: 0,
            rate: 0,
            icon: icon || '📊',
            color: color || '#64748b',
            isActive: true,
            createdBy: req.userId || req.user?.id
        });

        return res.status(201).json({
            success: true,
            data: {
                _id: config._id,
                name: config.resource,
                unit: config.unit,
                dailyLimit: config.dailyThreshold,
                monthlyLimit: config.monthlyThreshold,
                isActive: config.isActive
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/resource-config/:id
 * Update a resource configuration (admin only)
 */
exports.update = async (req, res) => {
    try {
        const { name, unit, dailyLimit, monthlyLimit, icon, color, isActive } = req.body;

        const updateData = {};
        if (name) updateData.resource = name;
        if (unit) updateData.unit = unit;
        if (dailyLimit) { updateData.dailyThreshold = dailyLimit; updateData.dailyLimitPerPerson = dailyLimit; }
        if (monthlyLimit) { updateData.monthlyThreshold = monthlyLimit; updateData.monthlyLimitPerPerson = monthlyLimit; }
        if (icon) updateData.icon = icon;
        if (color) updateData.color = color;
        if (isActive !== undefined) updateData.isActive = isActive;
        updateData.updatedBy = req.userId || req.user?.id;

        const config = await SystemConfig.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!config) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                _id: config._id,
                name: config.resource,
                unit: config.unit,
                dailyLimit: config.dailyThreshold,
                monthlyLimit: config.monthlyThreshold,
                icon: config.icon,
                color: config.color,
                isActive: config.isActive
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/resource-config/:id
 * Soft delete: set isActive = false (admin only)
 */
exports.softDelete = async (req, res) => {
    try {
        const config = await SystemConfig.findByIdAndUpdate(
            req.params.id,
            { isActive: false, updatedBy: req.userId || req.user?.id },
            { new: true }
        );

        if (!config) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        return res.status(200).json({
            success: true,
            message: `${config.resource} deactivated`,
            data: { _id: config._id, name: config.resource, isActive: config.isActive }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
