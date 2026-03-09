/**
 * controllers/blockController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Block Management - CRUD operations for hostel blocks
 * Admin only manages blocks, Wardens are assigned to blocks
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Block = require('../models/Block');
const User = require('../models/User');
const Usage = require('../models/Usage');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');
const { parsePagination } = require('../utils/queryBuilder');

/**
 * @desc    Get all blocks with pagination and filtering
 * @route   GET /api/blocks?page=&limit=&status=&search=
 * @access  Private (Admin, GM, Dean, Principal, Warden)
 */
exports.getBlocks = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const { skip, limit: pageLimit } = parsePagination({ page, limit });

    let filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    const [blocks, total] = await Promise.all([
      Block.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate('warden', 'name email phoneNumber')
        .lean(),
      Block.countDocuments(filter)
    ]);

    res.json({
      success: true,
      blocks,
      pagination: { page: parseInt(page), limit: pageLimit, total },
      pages: Math.ceil(total / pageLimit)
    });
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single block details
 * @route   GET /api/blocks/:id
 * @access  Private
 */
exports.getBlock = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid block ID' });
    }

    const block = await Block.findById(req.params.id)
      .populate('warden', 'name email phoneNumber role department')
      .lean();

    if (!block) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    // Get block statistics
    const usageCount = await Usage.countDocuments({
      blockId: block._id,
      deleted: { $ne: true },
      usage_date: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
    });

    const studentCount = await User.countDocuments({
      block: block._id,
      status: 'active'
    });

    res.json({
      success: true,
      block: {
        ...block,
        stats: { usageCount, studentCount }
      }
    });
  } catch (error) {
    console.error('Get block error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Create new block
 * @route   POST /api/blocks
 * @access  Private (Admin only)
 */
exports.createBlock = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can create blocks' });
    }

    const { name, type = 'Hostel', capacity = 0, departments = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Block name is required' });
    }

    // Check for duplicate
    const existing = await Block.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Block with this name already exists' });
    }

    const block = await Block.create({
      name: name.trim(),
      type,
      capacity: Math.max(0, parseInt(capacity) || 0),
      departments: departments || [],
      status: 'Active'
    });

    // Audit log
    await AuditLog.create({
      action: 'CREATE',
      resourceType: 'Block',
      resourceId: block._id,
      userId: req.user.id,
      description: `Created block: ${name}`
    });

    res.status(201).json({
      success: true,
      message: 'Block created successfully',
      block
    });
  } catch (error) {
    console.error('Create block error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update block details
 * @route   PATCH /api/blocks/:id
 * @access  Private (Admin only)
 */
exports.updateBlock = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can update blocks' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid block ID' });
    }

    const block = await Block.findById(req.params.id);
    if (!block) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    const { name, type, capacity, status, departments, warden } = req.body;

    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (type && ['Hostel', 'Academic', 'Administrative', 'Service'].includes(type)) updates.type = type;
    if (capacity !== undefined) updates.capacity = Math.max(0, parseInt(capacity) || 0);
    if (status && ['Active', 'Maintenance', 'Closed'].includes(status)) updates.status = status;
    if (departments && Array.isArray(departments)) updates.departments = departments;

    // Handle warden assignment (validation done separately)
    if (warden) {
      if (!mongoose.Types.ObjectId.isValid(warden)) {
        return res.status(400).json({ success: false, message: 'Invalid warden ID' });
      }
      const wardenUser = await User.findById(warden);
      if (!wardenUser || wardenUser.role !== ROLES.WARDEN) {
        return res.status(400).json({ success: false, message: 'User must be a Warden' });
      }
      updates.warden = warden;
    }

    const updated = await Block.findByIdAndUpdate(req.params.id, updates, { new: true });

    // Audit log
    await AuditLog.create({
      action: 'UPDATE',
      resourceType: 'Block',
      resourceId: block._id,
      userId: req.user.id,
      description: `Updated block: ${block.name}`,
      changes: { before: block.toObject(), after: updated.toObject() }
    });

    res.json({
      success: true,
      message: 'Block updated successfully',
      block: updated
    });
  } catch (error) {
    console.error('Update block error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete/Deactivate a block
 * @route   DELETE /api/blocks/:id
 * @access  Private (Admin only)
 */
exports.deleteBlock = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can delete blocks' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid block ID' });
    }

    const block = await Block.findById(req.params.id);
    if (!block) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    // Check if warden is assigned — unassign first
    if (block.warden) {
      await User.findByIdAndUpdate(block.warden, {
        block: null
      });
    }

    await Block.findByIdAndDelete(req.params.id);

    // Audit log
    await AuditLog.create({
      action: 'DELETE',
      resourceType: 'Block',
      resourceId: block._id,
      userId: req.user.id,
      description: `Deleted block: ${block.name}`
    });

    res.json({
      success: true,
      message: 'Block deleted successfully'
    });
  } catch (error) {
    console.error('Delete block error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Assign warden to block
 * @route   PUT /api/blocks/:id/assign-warden
 * @access  Private (Admin only)
 */
exports.assignWarden = async (req, res) => {
  try {
    if (req.user?.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can assign wardens' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid block ID' });
    }

    const { wardenId } = req.body;
    if (!wardenId || !mongoose.Types.ObjectId.isValid(wardenId)) {
      return res.status(400).json({ success: false, message: 'Valid wardenId is required' });
    }

    const block = await Block.findById(req.params.id);
    if (!block) {
      return res.status(404).json({ success: false, message: 'Block not found' });
    }

    const warden = await User.findById(wardenId);
    if (!warden || warden.role !== ROLES.WARDEN) {
      return res.status(400).json({ success: false, message: 'User must be a Warden' });
    }

    // Update block
    block.warden = wardenId;
    await block.save();

    // Update warden's block assignment
    await User.findByIdAndUpdate(wardenId, { block: req.params.id });

    // Audit log
    await AuditLog.create({
      action: 'UPDATE',
      resourceType: 'Block',
      resourceId: block._id,
      userId: req.user.id,
      description: `Assigned warden ${warden.name} to block ${block.name}`
    });

    res.json({
      success: true,
      message: `Warden assigned to block successfully`,
      block: await Block.findById(req.params.id).populate('warden', 'name email')
    });
  } catch (error) {
    console.error('Assign warden error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBlocks: exports.getBlocks,
  getBlock: exports.getBlock,
  createBlock: exports.createBlock,
  updateBlock: exports.updateBlock,
  deleteBlock: exports.deleteBlock,
  assignWarden: exports.assignWarden
};
