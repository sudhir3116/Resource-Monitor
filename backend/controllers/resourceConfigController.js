const ResourceConfig = require('../models/ResourceConfig');

/**
 * GET /api/resource-config
 * Returns resource configurations from ResourceConfig:
 * - Admin: All non-deleted resources (active + inactive)
 * - All other users: Only active + non-deleted resources
 */
const getAll = async (req, res) => {
    try {
        const role = (req.user?.role || '').toLowerCase();
        console.log('[ResourceConfig.getAll] role:', role);

        // Build filter based on role
        const filter = { isDeleted: { $ne: true } };
        // Buyer requirement: inactive resources must not appear anywhere except Admin.
        // Admin and GM can see inactive configurations; others see ONLY active.
        if (role !== 'admin' && role !== 'gm') {
            filter.isActive = true;
        }

        const resources = await ResourceConfig
            .find(filter)
            .sort({ name: 1 })
            .lean();

        console.log('[ResourceConfig.getAll] found:', resources.length);

        return res.status(200).json({
            success: true,
            count: resources.length,
            data: resources,
            resources: resources
        });
    } catch (err) {
        console.error('[ResourceConfig.getAll] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/resource-config
 * Create a new resource configuration (admin only)
 */
const create = async (req, res) => {
    try {
        const { name, unit, dailyLimit, monthlyLimit, icon, emoji, color, costPerUnit } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!unit?.trim()) {
            return res.status(400).json({ success: false, message: 'Unit is required' });
        }

        console.log('[ResourceConfig.create] payload:', req.body);

        const trimmedName = name.trim();

        // Check for existing resource (case-insensitive)
        const existing = await ResourceConfig.findOne({
            name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') }
        });

        if (existing) {
            // Deleted → restore
            if (existing.isDeleted) {
                const restored = await ResourceConfig.findByIdAndUpdate(
                    existing._id,
                    {
                        $set: {
                            isDeleted: false,
                            isActive: true,
                            deletedAt: null,
                            unit: unit.trim(),
                            dailyLimit: dailyLimit || 100,
                            monthlyLimit: monthlyLimit || 3000,
                            icon: emoji || icon || '📊',
                            color: color || '#64748b',
                            costPerUnit: costPerUnit || 0
                        }
                    },
                    { new: true }
                );
                console.log('[ResourceConfig.create] RESTORED:', restored._id);
                return res.status(200).json({
                    success: true,
                    message: `${trimmedName} restored`,
                    data: restored,
                    restored: true
                });
            }

            // Inactive → reactivate
            if (!existing.isActive) {
                const reactivated = await ResourceConfig.findByIdAndUpdate(
                    existing._id,
                    { $set: { isActive: true } },
                    { new: true }
                );
                console.log('[ResourceConfig.create] REACTIVATED:', reactivated._id);
                return res.status(200).json({
                    success: true,
                    message: `${trimmedName} reactivated`,
                    data: reactivated,
                    reactivated: true
                });
            }

            // Active → conflict
            return res.status(409).json({
                success: false,
                message: `"${trimmedName}" already exists`
            });
        }

        // Create new
        const resource = await ResourceConfig.create({
            name: trimmedName,
            unit: unit.trim(),
            dailyLimit: dailyLimit || 100,
            monthlyLimit: monthlyLimit || 3000,
            icon: emoji || icon || '📊',
            color: color || '#64748b',
            costPerUnit: costPerUnit || 0,
            isActive: true,
            isDeleted: false
        });

        console.log('[ResourceConfig.create] CREATED:', resource._id);

        return res.status(201).json({
            success: true,
            message: `${trimmedName} created successfully`,
            data: resource
        });
    } catch (err) {
        console.error('[ResourceConfig.create] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PUT /api/resource-config/:id
 * Update a resource configuration (admin only)
 */
const update = async (req, res) => {
    try {
        const resource = await ResourceConfig.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }
        if (resource.isDeleted) {
            return res.status(400).json({ success: false, message: 'Cannot update deleted resource' });
        }

        const { name, unit, dailyLimit, monthlyLimit, icon, color, costPerUnit } = req.body;

        const updates = {};
        if (name != null) updates.name = name.trim();
        if (unit != null) updates.unit = unit.trim();
        if (dailyLimit != null) updates.dailyLimit = dailyLimit;
        if (monthlyLimit != null) updates.monthlyLimit = monthlyLimit;
        if (icon != null) updates.icon = icon;
        if (color != null) updates.color = color;
        if (costPerUnit != null) updates.costPerUnit = costPerUnit;

        const updated = await ResourceConfig.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        console.log('[ResourceConfig.update] UPDATED:', updated._id);

        return res.status(200).json({
            success: true,
            message: 'Resource updated',
            data: updated
        });
    } catch (err) {
        console.error('[ResourceConfig.update] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PATCH /api/resource-config/:id/toggle
 * Toggle resource active/inactive status (admin only)
 */
const toggle = async (req, res) => {
    try {
        const resource = await ResourceConfig.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }
        if (resource.isDeleted) {
            return res.status(400).json({ success: false, message: 'Cannot toggle deleted resource' });
        }

        const updated = await ResourceConfig.findByIdAndUpdate(
            resource._id,
            { $set: { isActive: !resource.isActive } },
            { new: true }
        );

        console.log('[ResourceConfig.toggle]', resource.name, '→', updated.isActive ? 'ACTIVE' : 'INACTIVE');

        return res.status(200).json({
            success: true,
            message: updated.isActive
                ? `${resource.name} activated`
                : `${resource.name} deactivated`,
            data: updated
        });
    } catch (err) {
        console.error('[ResourceConfig.toggle] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/resource-config/:id
 * Soft delete: set isDeleted = true (admin only)
 */
const softDelete = async (req, res) => {
    try {
        const resource = await ResourceConfig.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }
        if (resource.isDeleted) {
            return res.status(400).json({ success: false, message: 'Already deleted' });
        }

        const deleted = await ResourceConfig.findByIdAndUpdate(
            resource._id,
            {
                $set: {
                    isDeleted: true,
                    isActive: false,
                    deletedAt: new Date()
                }
            },
            { new: true }
        );

        console.log('[ResourceConfig.softDelete] DELETED:', resource.name);

        return res.status(200).json({
            success: true,
            message: `${resource.name} deleted`,
            data: deleted
        });
    } catch (err) {
        console.error('[ResourceConfig.softDelete] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * PATCH /api/resource-config/:id/restore
 * Restore a deleted resource (admin only)
 */
const restore = async (req, res) => {
    try {
        const resource = await ResourceConfig.findById(req.params.id);

        if (!resource || !resource.isDeleted) {
            return res.status(404).json({ success: false, message: 'Deleted resource not found' });
        }

        const restored = await ResourceConfig.findByIdAndUpdate(
            resource._id,
            {
                $set: {
                    isDeleted: false,
                    isActive: true,
                    deletedAt: null
                }
            },
            { new: true }
        );

        console.log('[ResourceConfig.restore] RESTORED:', resource.name);

        return res.status(200).json({
            success: true,
            message: `${resource.name} restored`,
            data: restored
        });
    } catch (err) {
        console.error('[ResourceConfig.restore] error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// Export all
module.exports = {
    getAll,
    create,
    update,
    toggle,
    softDelete,
    restore
};
