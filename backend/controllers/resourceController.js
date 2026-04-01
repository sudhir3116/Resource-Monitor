const Resource = require('../models/Resource');

/**
 * GET /api/resource-config (alias for /api/resources)
 * Returns resource configurations (active and inactive) for Admin
 * Non-admins see only active resources.
 */
exports.getAll = async (req, res) => {
    try {
        const role = (req.user?.role || '').toLowerCase();
        const filter = {};

        // Admin and GM can see inactive resources; others see only active.
        if (role !== 'admin' && role !== 'gm') {
            filter.status = "active";
        }

        const resources = await Resource.find(filter).sort({ name: 1 });

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
 * POST /api/resources
 */
exports.create = async (req, res) => {
    try {
        const { name, unit, rate, dailyLimit, monthlyLimit, icon, color } = req.body;

        if (!name || !unit) {
            return res.status(400).json({ message: "Name and unit are required" });
        }

        const normalizedName = name.trim();
        // Case-insensitive duplicate check (Requirement Part 6)
        const existing = await Resource.findOne({
            name: { $regex: new RegExp(`^${normalizedName}$`, "i") }
        });

        if (existing) {
            return res.status(400).json({ message: "Resource already exists" });
        }

        const resource = await Resource.create({
            name: normalizedName,
            unit: unit.trim(),
            rate: Number(rate) || 0,
            dailyLimit: Number(dailyLimit) || 0,
            monthlyLimit: Number(monthlyLimit) || 0,
            status: "active",
            icon: icon || '📊',
            color: color || '#64748b',
            createdBy: req.userId || req.user?.id
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('resources:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        return res.status(201).json({
            success: true,
            message: 'Resource created successfully',
            data: resource
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Update logic
 */
exports.update = async (req, res) => {
    try {
        const { name, unit, rate, dailyLimit, monthlyLimit, icon, color, status } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (unit) updateData.unit = unit;
        if (rate !== undefined) updateData.rate = Number(rate);
        if (dailyLimit !== undefined) updateData.dailyLimit = Number(dailyLimit);
        if (monthlyLimit !== undefined) updateData.monthlyLimit = Number(monthlyLimit);
        if (icon) updateData.icon = icon;
        if (color) updateData.color = color;
        if (status) updateData.status = status;

        if (status) {
            updateData.isActive = (status === "active");
        }

        updateData.updatedBy = req.userId || req.user?.id;

        const resource = await Resource.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('resources:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        return res.status(200).json({
            success: true,
            data: resource
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Toggle Resource Status
 */
exports.toggleResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ message: "Resource not found" });
        }

        // Toggle logic (Requirement Part 1)
        resource.status = resource.status === "active" ? "inactive" : "active";
        resource.isActive = (resource.status === "active");

        await resource.save();

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('resources:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        return res.json(resource);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Hard Delete Resource
 */
exports.deleteResource = async (req, res) => {
    try {
        // existence check first (Requirement Part 2)
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ message: "Resource not found" });
        }

        // deleteOne (Requirement Part 2)
        await Resource.deleteOne({ _id: req.params.id });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('resources:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        return res.json({ message: "Deleted successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
