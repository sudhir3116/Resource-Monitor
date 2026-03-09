/**
 * controllers/userManagementController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * User Management - Admin operations for managing users across the system
 * ─────────────────────────────────────────────────────────────────────────────
 */

const User = require('../models/User');
const Block = require('../models/Block');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');
const { parsePagination } = require('../utils/queryBuilder');

/**
 * @desc    Get all users with pagination and filtering
 * @route   GET /api/users?page=&limit=&role=&status=&search=&blockId=
 * @access  Private (Admin only)
 */
exports.getUsers = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can view users' });
    }

    const { page = 1, limit = 50, role, status, search, blockId } = req.query;
    const { skip, limit: pageLimit } = parsePagination({ page, limit });

    let filter = {};
    
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (blockId && mongoose.Types.ObjectId.isValid(blockId)) {
      filter.block = new mongoose.Types.ObjectId(blockId);
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('name email role status department block phoneNumber createdAt lastLogin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate('block', 'name')
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      users,
      pagination: { page: parseInt(page), limit: pageLimit, total },
      pages: Math.ceil(total / pageLimit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single user details
 * @route   GET /api/users/:id
 * @access  Private (Admin only or self)
 */
exports.getUser = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('block', 'name type')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Authorization: Admin or self
    if (req.user?.role !== ROLES.ADMIN && req.user?.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create new user (Admin only)
 * @route   POST /api/users
 * @access  Private (Admin only)
 */
exports.createUser = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can create users' });
    }

    const { name, email, password, role = 'student', blockId, department, phoneNumber, status = 'active' } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Check existing email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    // If wardens are being assigned blocks
    let finalBlockId = null;
    if (blockId && mongoose.Types.ObjectId.isValid(blockId)) {
      const block = await Block.findById(blockId);
      if (!block) {
        return res.status(400).json({ success: false, message: 'Block not found' });
      }
      finalBlockId = blockId;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      block: finalBlockId,
      department: department || null,
      phoneNumber: phoneNumber || null,
      status,
      createdBy: req.user.id,
      provider: 'local'
    });

    // Audit log
    await AuditLog.create({
      action: 'CREATE',
      resourceType: 'User',
      resourceId: user._id,
      userId: req.user.id,
      description: `Created user: ${name} (${role})`
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        block: user.block,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update user details
 * @route   PATCH /api/users/:id
 * @access  Private (Admin only or self for certain fields)
 */
exports.updateUser = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Authorization: Admin or self (limited fields)
    const isAdmin = req.user?.role === ROLES.ADMIN;
    const isSelf = req.user?.id === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email, phoneNumber, department, blockId, role, status, password } = req.body;
    const updates = {};

    // Admin can change anything, self can change limited fields
    if (isAdmin) {
      if (name) updates.name = name;
      if (email && email.toLowerCase() !== user.email) {
        const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(409).json({ success: false, message: 'Email already in use' });
        }
        updates.email = email.toLowerCase();
      }
      if (phoneNumber) updates.phoneNumber = phoneNumber;
      if (department) updates.department = department;
      if (role && Object.values(ROLES).includes(role)) updates.role = role;
      if (status && ['active', 'pending', 'suspended', 'graduated'].includes(status)) updates.status = status;
      
      if (blockId && mongoose.Types.ObjectId.isValid(blockId)) {
        const block = await Block.findById(blockId);
        if (!block) {
          return res.status(400).json({ success: false, message: 'Block not found' });
        }
        updates.block = blockId;
      }
    } else {
      // Self: only allow limited field updates
      if (name) updates.name = name;
      if (phoneNumber) updates.phoneNumber = phoneNumber;
      if (department) updates.department = department;
    }

    // Handle password change (admin only)
    if (password && isAdmin) {
      updates.password = await bcrypt.hash(password, 12);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
      .select('-password')
      .populate('block', 'name');

    // Audit log
    await AuditLog.create({
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id,
      userId: req.user.id,
      description: `Updated user: ${user.name}`
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updated
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete/Suspend a user
 * @route   DELETE /api/users/:id
 * @access  Private (Admin only)
 */
exports.deleteUser = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can delete users' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent self-deletion
    if (req.user.id === req.params.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    // Soft delete - mark as suspended
    await User.findByIdAndUpdate(req.params.id, { status: 'suspended' }, { new: true });

    // Audit log
    await AuditLog.create({
      action: 'DELETE',
      resourceType: 'User',
      resourceId: user._id,
      userId: req.user.id,
      description: `Suspended/deleted user: ${user.name}`
    });

    res.json({
      success: true,
      message: 'User suspended/deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Assign user to block
 * @route   PUT /api/users/:id/assign-block
 * @access  Private (Admin only)
 */
exports.assignUserToBlock = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can assign users to blocks' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const { blockId } = req.body;
    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      return res.status(400).json({ success: false, message: 'Valid blockId is required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const block = await Block.findById(blockId);
    if (!block) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    // Check capacity for non-warden roles
    if (user.role !== ROLES.WARDEN && block.capacity > 0) {
      const occupied = await User.countDocuments({
        block: blockId,
        status: 'active',
        _id: { $ne: req.params.id }
      });
      
      if (occupied >= block.capacity) {
        return res.status(400).json({
          success: false,
          message: `Block is at full capacity (${block.capacity})`
        });
      }
    }

    const updated = await User.findByIdAndUpdate(req.params.id, { block: blockId }, { new: true })
      .populate('block', 'name');

    // Audit log
    await AuditLog.create({
      action: 'UPDATE',
      resourceType: 'User',
      resourceId: user._id,
      userId: req.user.id,
      description: `Assigned user ${user.name} to block ${block.name}`
    });

    res.json({
      success: true,
      message: 'User assigned to block successfully',
      user: updated
    });
  } catch (error) {
    console.error('Assign user to block error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get user statistics for dashboard
 * @route   GET /api/users/stats
 * @access  Private (Admin only)
 */
exports.getUserStats = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can view user stats' });
    }

    const [total, byRole, byStatus, byBlock] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      User.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { block: { $exists: true, $ne: null } } },
        { $group: { _id: '$block', count: { $sum: 1 } } },
        { $lookup: { from: 'blocks', localField: '_id', foreignField: '_id', as: 'block' } },
        { $unwind: { path: '$block', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, blockId: '$_id', blockName: '$block.name', count: 1 } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        total,
        byRole: byRole.map(r => ({ role: r._id, count: r.count })),
        byStatus: byStatus.map(s => ({ status: s._id, count: s.count })),
        byBlock: byBlock.map(b => ({ blockId: b.blockId, blockName: b.blockName, count: b.count }))
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUsers: exports.getUsers,
  getUser: exports.getUser,
  createUser: exports.createUser,
  updateUser: exports.updateUser,
  deleteUser: exports.deleteUser,
  assignUserToBlock: exports.assignUserToBlock,
  getUserStats: exports.getUserStats
};
