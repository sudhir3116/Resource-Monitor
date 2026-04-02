const User = require('../models/User');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Block = require('../models/Block');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enforce: only ONE warden per block.
 * If role === 'warden' and blockId is set, ensure no other user already holds that block as warden.
 * Optionally pass excludeId to ignore the user being edited.
 */
async function enforceOneWardenPerBlock(blockId, role, excludeId = null) {
    if (role !== ROLES.WARDEN || !blockId) return; // Only applies to wardens with a block
    const query = { role: ROLES.WARDEN, block: blockId };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await User.findOne(query).lean();
    if (existing) {
        const block = await Block.findById(blockId).lean();
        throw new Error(`Block "${block?.name || blockId}" already has an assigned warden (${existing.name}). Remove the existing warden first.`);
    }
}

/**
 * Keep Block.warden field in sync when a warden is assigned/removed.
 */
async function syncBlockWarden(blockId, userId) {
    if (!blockId) return;
    await Block.findByIdAndUpdate(blockId, { warden: userId });
}

/**
 * Remove warden reference from a block when a warden is reassigned or role changes.
 */
async function clearBlockWarden(userId) {
    // Clear from any blocks where this user is the warden
    await Block.updateMany({ warden: userId }, { $unset: { warden: '' } });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST USERS
// ─────────────────────────────────────────────────────────────────────────────
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

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

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

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after' }).select('-password');

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
        const { getUsageSummary } = require('../services/usageService');
        const Resource = require('../models/Resource');
        const Complaint = require('../models/Complaint');

        const role = (req.user?.role || '').toLowerCase();
        const results = await Promise.allSettled([
            User.countDocuments(),
            Block.countDocuments(),
            Resource.countDocuments({ isActive: true }),
            getUsageSummary({ role: role }),
            Alert.countDocuments({ status: { $ne: 'Resolved' } }),
            Complaint.countDocuments({ status: { $ne: 'Resolved' } })
        ]);

        const userCount = results[0].status === 'fulfilled' ? results[0].value : 0;
        const blockCount = results[1].status === 'fulfilled' ? results[1].value : 0;
        const resourceCount = results[2].status === 'fulfilled' ? results[2].value : 0;
        const usageData = results[3].status === 'fulfilled' ? results[3].value : { summary: {}, grandTotal: 0 };
        const activeAlertsCount = results[4].status === 'fulfilled' ? results[4].value : 0;
        const unresolvedComplaintsCount = results[5].status === 'fulfilled' ? results[5].value : 0;

        // Dashboard models expect different field names (aliasing for compatibility)
        const responseData = {
            totalUsers: userCount,
            totalBlocks: blockCount,
            totalResources: resourceCount,
            totalAlerts: activeAlertsCount,
            activeCampusAlerts: activeAlertsCount, // Principal/GM Alias
            unresolvedComplaintsCount: unresolvedComplaintsCount, // Admin Alias
            grandTotal: usageData?.grandTotal || 0,
            usageSummary: usageData?.summary || {}, // Object mapping
            summary: usageData?.summary || {},      // Common Alias
            alertsCount: activeAlertsCount,
            criticalAlerts: [], // To be populated safely below
            recentComplaints: []
        };

        try {
            // Fix: Alert uses 'block', Complaint uses 'user' (NOT userId), and Complaint lacks 'block'
            responseData.criticalAlerts = await Alert.find({ status: { $ne: 'Resolved' } })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate({ path: 'block', select: 'name' })
                .setOptions({ strictPopulate: false })
                .lean();

            responseData.recentComplaints = await Complaint.find({ status: { $ne: 'resolved' } })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate({ path: 'user', select: 'name' })
                .lean();
        } catch (e) {
            console.warn('[AdminCtrl] Dashboard sub-fetch failed:', e.message);
        }

        return res.status(200).json({
            success: true,
            data: responseData,
            stats: responseData
        });
    } catch (err) {
        console.error('[AdminCtrl] getSystemUsageSummary error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getBlocks = async (req, res) => {
    try {
        const blocks = await Block.find()
            .sort({ name: 1 })
            .populate('warden', 'name email');
        res.json({ success: true, message: 'Blocks fetched', data: blocks });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch blocks', error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BLOCK
// ─────────────────────────────────────────────────────────────────────────────
exports.createBlock = async (req, res) => {
    try {
        const { name, type = 'Hostel', capacity = 0, monthly_budget = 0 } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Block name is required.' });
        }

        const existing = await Block.findOne({ name: name.trim() });
        if (existing) {
            return res.status(409).json({ success: false, message: `Block "${name}" already exists.` });
        }

        const block = await Block.create({ name: name.trim(), type, capacity, monthly_budget });

        await AuditLog.create({
            action: 'CREATE',
            resourceType: 'Block',
            resourceId: block._id,
            userId: req.user.id,
            description: `Created block: ${block.name}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: { after: block.toObject() }
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) io.emit('blocks:refresh');
        } catch (e) { /* non-fatal */ }

        res.status(201).json({ success: true, message: 'Block created successfully', data: block });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE BLOCK
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteBlock = async (req, res) => {
    try {
        const { id } = req.params;

        const block = await Block.findById(id);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found.' });
        }

        // Clear warden block assignment if any
        await User.updateMany({ block: id }, { $unset: { block: '' } });

        await Block.findByIdAndDelete(id);

        await AuditLog.create({
            action: 'DELETE',
            resourceType: 'Block',
            resourceId: id,
            userId: req.user.id,
            description: `Deleted block: ${block.name}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: { before: block.toObject() }
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) io.emit('blocks:refresh');
        } catch (e) { /* non-fatal */ }

        res.json({ success: true, message: `Block "${block.name}" deleted successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE BLOCK
// ─────────────────────────────────────────────────────────────────────────────
exports.updateBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const block = await Block.findById(id);
        if (!block) return res.status(404).json({ success: false, message: 'Block not found' });

        const { name, type, capacity, monthly_budget, status } = req.body;
        const updates = {};
        if (name && name.trim()) updates.name = name.trim();
        if (type) updates.type = type;
        if (capacity !== undefined) updates.capacity = Number(capacity) || 0;
        if (monthly_budget !== undefined) updates.monthly_budget = Number(monthly_budget) || 0;
        if (status) updates.status = status;

        const updated = await Block.findByIdAndUpdate(id, updates, { new: true }).populate('warden', 'name email');

        await AuditLog.create({
            action: 'UPDATE',
            resourceType: 'Block',
            resourceId: id,
            userId: req.user.id,
            description: `Updated block: ${updated.name}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: { before: block.toObject(), after: updated.toObject() }
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) io.emit('blocks:refresh');
        } catch (e) { /* non-fatal */ }

        res.json({ success: true, message: 'Block updated successfully', data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN WARDEN TO BLOCK
// ─────────────────────────────────────────────────────────────────────────────
exports.assignWardenToBlock = async (req, res) => {
    try {
        const { id: blockId } = req.params;
        const { wardenId } = req.body;

        const block = await Block.findById(blockId);
        if (!block) {
            return res.status(404).json({ success: false, message: 'Block not found.' });
        }

        // 1. Handle Unassignment
        if (!wardenId) {
            const prevWardenId = block.warden;
            block.warden = undefined;
            await block.save();
            if (prevWardenId) {
                await User.findByIdAndUpdate(prevWardenId, { $unset: { block: '' } });
            }
            res.json({ success: true, message: `Warden unassigned from block "${block.name}".` });
        } else {
            // 2. Handle Assignment / Replacement
            const warden = await User.findById(wardenId);
            if (!warden || warden.role !== ROLES.WARDEN) {
                return res.status(404).json({ success: false, message: 'Warden user not found or invalid role.' });
            }

            // Unassign THIS warden from any PREVIOUS block they were in
            await clearBlockWarden(wardenId);

            // Unassign the PREVIOUS warden of this target block (if any)
            if (block.warden && block.warden.toString() !== wardenId) {
                await User.findByIdAndUpdate(block.warden, { $unset: { block: '' } });
            }

            // Perform new assignment
            warden.block = blockId;
            await warden.save();

            block.warden = wardenId;
            await block.save();

            await AuditLog.create({
                action: 'UPDATE',
                resourceType: 'Block',
                resourceId: blockId,
                userId: req.user.id,
                description: `Assigned warden ${warden.email} to block "${block.name}"`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                changes: { after: { warden: wardenId } }
            });

            const updated = await Block.findById(blockId).populate('warden', 'name email');
            res.json({ success: true, message: `Warden "${warden.name}" assigned to block "${block.name}".`, data: updated });
        }

        // Always emit refresh
        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('blocks:refresh');
                io.emit('users:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE USER
// ─────────────────────────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {

    try {
        const { name, email, password, role = ROLES.STUDENT, block, room, status = 'active' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
        }

        // Validate role
        if (!Object.values(ROLES).includes(role)) {
            return res.status(400).json({ success: false, message: `Invalid role. Valid: ${Object.values(ROLES).join(', ')}` });
        }

        // Enforce one warden per block
        if (role === ROLES.WARDEN) {
            if (!block) {
                return res.status(400).json({ success: false, message: 'Block assignment is required for Warden role.' });
            }
            const blockExists = await Block.findById(block);
            if (!blockExists) {
                return res.status(404).json({ success: false, message: 'Assigned block not found.' });
            }
            await enforceOneWardenPerBlock(block, role);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            block: block || undefined,
            room: room || undefined,
            status,
            provider: 'local',
            createdBy: req.user.id,
        });

        // Sync block.warden if this is a warden
        if (role === ROLES.WARDEN && block) {
            await syncBlockWarden(block, user._id);
        }

        await AuditLog.create({
            action: 'CREATE',
            resourceType: 'User',
            resourceId: user._id,
            userId: req.user.id,
            description: `Created user: ${user.email} (${user.role})${user.block ? ` for ${user.block}` : ''}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: { after: { email: user.email, role: user.role } }
        });

        const safe = user.toObject();
        delete safe.password;

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        res.status(201).json({ success: true, message: 'User created successfully', data: safe });
    } catch (err) {
        res.status(err.message.includes('already has an assigned warden') ? 409 : 500)
            .json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE USER  (name, role, block, room, status)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot edit your own account through this endpoint. Use Profile page.' });
        }

        const existing = await User.findById(id);
        if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

        const { name, role, block, room, status } = req.body;
        const updates = {};

        if (name !== undefined) updates.name = name;
        if (status !== undefined) updates.status = status;
        if (room !== undefined) updates.room = room;

        // Role change logic
        const newRole = role !== undefined ? role : existing.role;
        if (newRole !== existing.role) {
            if (!Object.values(ROLES).includes(newRole)) {
                return res.status(400).json({ success: false, message: 'Invalid role.' });
            }
            // If changing FROM warden, clear block assignment in Block model
            if (existing.role === ROLES.WARDEN) {
                await clearBlockWarden(id);
            }
            updates.role = newRole;
        }

        // Block assignment logic
        const newBlock = block !== undefined ? (block === '' ? null : block) : existing.block?.toString();
        const blockChanged = newBlock !== (existing.block?.toString() || null);

        if (blockChanged || (newRole === ROLES.WARDEN && newBlock)) {
            // Enforce one warden per block (exclude current user)
            if (newRole === ROLES.WARDEN) {
                if (!newBlock) {
                    return res.status(400).json({ success: false, message: 'Block assignment is required for Warden role.' });
                }
                const blockExists = await Block.findById(newBlock);
                if (!blockExists) {
                    return res.status(404).json({ success: false, message: 'Assigned block not found.' });
                }
                await enforceOneWardenPerBlock(newBlock, newRole, id);
            } else if (newBlock) {
                await enforceOneWardenPerBlock(newBlock, newRole, id);
            }
        }

        if (blockChanged) {
            // Clear old block's warden ref if this user was a warden there
            if (existing.role === ROLES.WARDEN && existing.block) {
                await Block.findByIdAndUpdate(existing.block, { $unset: { warden: '' } });
            }
            updates.block = newBlock || null;
        }

        const updated = await User.findByIdAndUpdate(id, updates, { new: true })
            .select('-password')
            .populate('block', 'name');

        // Sync block.warden
        if (updated.role === ROLES.WARDEN && updated.block) {
            await syncBlockWarden(updated.block._id || updated.block, updated._id);
        }

        await AuditLog.create({
            action: 'UPDATE',
            resourceType: 'User',
            resourceId: id,
            userId: req.user.id,
            description: `Updated user: ${updated.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            changes: {
                before: { role: existing.role, block: existing.block, status: existing.status },
                after: { role: updated.role, block: updated.block, status: updated.status }
            }
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        res.json({ success: true, message: 'User updated successfully', data: updated });
    } catch (err) {
        res.status(err.message.includes('already has an assigned warden') ? 409 : 500)
            .json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        await AuditLog.create({
            action: 'UPDATE',
            resourceType: 'User',
            resourceId: id,
            userId: req.user.id,
            description: `Password reset for: ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        res.json({ success: true, message: `Password reset successfully for ${user.name}.` });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) io.emit('users:refresh');
        } catch (e) { /* non-fatal */ }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE STATUS  (active ↔ suspended)
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const newStatus = user.status === 'active' ? 'suspended' : 'active';
        user.status = newStatus;
        await user.save();

        await AuditLog.create({
            action: 'UPDATE',
            resourceType: 'User',
            resourceId: id,
            userId: req.user.id,
            description: `Status changed to "${newStatus}" for: ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');

                // Real-time Logout Enforcement
                if (newStatus === 'suspended') {
                    io.emit('user:suspended', { userId: id });
                }
            }
        } catch (e) { /* non-fatal */ }

        res.json({ success: true, message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`, data: { status: newStatus } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Bulk Operations ───────────────────────────────────────────────────────────

exports.bulkUpdateRole = async (req, res) => {
    try {
        const { userIds, role: newRole } = req.body;
        const currentUserId = req.user.id;

        const targetIds = userIds.filter(id => id !== currentUserId);
        const clearBlock = [ROLES.ADMIN, ROLES.GM, ROLES.DEAN].includes(newRole);

        const targetUsers = await User.find({ _id: { $in: targetIds } });
        const finalIds = targetUsers
            .filter(u => u.email !== 'admin@college.com')
            .map(u => u._id);

        const operations = finalIds.map(id => ({
            updateOne: {
                filter: { _id: id },
                update: {
                    $set: { role: newRole },
                    ...(clearBlock ? { $unset: { block: "" } } : {})
                }
            }
        }));

        // If moving out of WARDEN roles, clear block assignments in Block model
        if (newRole !== ROLES.WARDEN) {
            await Block.updateMany(
                { warden: { $in: finalIds } },
                { $unset: { warden: "" } }
            );
        }

        const result = await User.bulkWrite(operations);

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');
            }
        } catch (e) { /* non-fatal */ }

        res.json({
            success: true,
            message: `Role updated to ${newRole} for ${result.modifiedCount} users.`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.bulkUpdateStatus = async (req, res) => {
    try {
        const { userIds, status } = req.body;
        const currentUserId = req.user.id;

        const targetIds = userIds.filter(id => id !== currentUserId);

        const result = await User.updateMany(
            {
                _id: { $in: targetIds },
                email: { $ne: 'admin@college.com' }
            },
            { $set: { status } }
        );

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');

                // Real-time Logout Enforcement for Bulk Suspension
                if (status === 'suspended') {
                    io.emit('user:suspended', { userIds: targetIds });
                }
            }
        } catch (e) { /* non-fatal */ }

        res.json({
            success: true,
            message: `Status set to ${status} for ${result.modifiedCount} users.`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.bulkDelete = async (req, res) => {
    try {
        const { userIds, confirmation } = req.body;

        // 1. Validate confirmation
        if (confirmation !== 'DELETE') {
            return res.status(400).json({ success: false, message: 'Invalid confirmation. Type DELETE exactly.' });
        }

        // 2. Validate userIds
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No users selected' });
        }

        if (userIds.length > 100) {
            return res.status(400).json({ success: false, message: 'Cannot delete more than 100 users at once' });
        }

        const currentUserId = req.user.id;
        const targetIds = userIds.filter(id => id.toString() !== currentUserId.toString());

        if (targetIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }

        // Validate IDs are valid Mongo IDs
        const validIds = targetIds.filter(id => mongoose.Types.ObjectId.isValid(id));

        if (validIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid user IDs provided' });
        }

        // Find users to be deleted to check if any are wardens and for logging
        const usersToDelete = await User.find({
            _id: { $in: validIds },
            email: { $ne: 'admin@college.com' } // Absolute protection for main admin
        });

        const finalTargetIds = usersToDelete.map(u => u._id);
        const deletedEmails = usersToDelete.map(u => u.email);

        if (finalTargetIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No users could be deleted (protected accounts)' });
        }

        // Clear warden refs in blocks for any wardens being deleted
        const wardenIds = usersToDelete
            .filter(u => u.role === ROLES.WARDEN)
            .map(u => u._id);

        if (wardenIds.length > 0) {
            await Block.updateMany(
                { warden: { $in: wardenIds } },
                { $unset: { warden: "" } }
            );
        }

        const result = await User.deleteMany({ _id: { $in: finalTargetIds } });

        await AuditLog.create({
            action: 'BULK_DELETE',
            resourceType: 'User',
            userId: req.user.id,
            description: `Bulk deleted ${result.deletedCount} users: ${deletedEmails.join(', ')}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                io.emit('users:refresh');
                io.emit('dashboard:refresh');
                io.emit('blocks:refresh'); // Wardens might have been cleared from blocks

                // Real-time Logout Enforcement for Deleted Users
                io.emit('user:suspended', { userIds: finalTargetIds });
            }
        } catch (e) { /* non-fatal */ }

        res.json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} users.`,
            deletedCount: result.deletedCount,
            excluded: userIds.length - result.deletedCount
        });
    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ success: false, message: err.message || 'Bulk delete failed' });
    }
};

exports.bulkResetPassword = async (req, res) => {
    try {
        const { userIds, newPassword, forceChange } = req.body;
        const currentUserId = req.user.id;

        const targetIds = userIds.filter(id => id !== currentUserId);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const result = await User.updateMany(
            {
                _id: { $in: targetIds },
                email: { $ne: 'admin@college.com' } // Protect System Admin
            },
            {
                $set: {
                    password: hashedPassword,
                    ...(forceChange !== undefined ? { forcePasswordChange: forceChange } : {})
                }
            }
        );

        res.json({
            success: true,
            message: `Password reset for ${result.modifiedCount} users.`,
            modifiedCount: result.modifiedCount
        });

        try {
            const socketUtil = require('../utils/socket');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) io.emit('users:refresh');
        } catch (e) { /* non-fatal */ }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
