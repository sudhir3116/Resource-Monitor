const ResourceConfig = require('../models/ResourceConfig');

/**
 * GET /api/resource-config
 * Returns resource configurations:
 * - Admin: All resources (active and inactive)
 * - All other users: Only active resources (isActive !== false)
 */
exports.getAll = async (req, res) => {
    try {
        const role = req.user?.role?.toLowerCase();
        
        // Build filter based on role
        const filter = {};
        if (role !== 'admin') {
            // Non-admin users see only active resources (explicit true filter)
            filter.isActive = true;
        }
        // Admin sees all resources (no filter applied)
        
        const resources = await ResourceConfig.find(filter).sort({ name: 1 }).lean();
        return res.status(200).json({
            success: true,
            count: resources.length,
            data: resources,
            resources: resources  // dual key for backwards compatibility
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/resource-config
 * Create a new resource configuration (admin only)
 */
exports.create = async (req, res) => {
    try {
        const { name, unit, dailyLimit, monthlyLimit, icon, color } = req.body;

        if (!name || !unit) {
            return res.status(400).json({
                success: false,
                message: 'Name and unit are required'
            });
        }

        const existing = await ResourceConfig.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Resource "${name}" already exists`
            });
        }

        const resource = await ResourceConfig.create({
            name: name.trim(),
            unit: unit.trim(),
            dailyLimit: dailyLimit || 100,
            monthlyLimit: monthlyLimit || 3000,
            icon: icon || '📊',
            color: color || '#64748b',
            isActive: true
        });

        return res.status(201).json({ success: true, data: resource });
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

        const resource = await ResourceConfig.findByIdAndUpdate(
            req.params.id,
            { $set: { name, unit, dailyLimit, monthlyLimit, icon, color, isActive } },
            { new: true, runValidators: true }
        );

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        return res.status(200).json({ success: true, data: resource });
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
        const resource = await ResourceConfig.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        return res.status(200).json({
            success: true,
            message: `${resource.name} deactivated`,
            data: resource
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
