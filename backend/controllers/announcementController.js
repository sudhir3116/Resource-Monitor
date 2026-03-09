const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Block = require('../models/Block');
const mongoose = require('mongoose');

/**
 * GET /api/announcements
 * Returns announcements visible to current user based on role and block
 */
exports.getAnnouncements = async (req, res) => {
  try {
    const { type, priority, limit = 20, page = 1 } = req.query;
    const user = req.user;

    // Build filter - announcements visible to this user
    // Check: targetRole contains 'all' OR contains user's role
    // Check: targetBlock is null (for all blocks) OR matches user's block
    const filter = {
      $and: [
        {
          $or: [
            { targetRole: { $in: ['all'] } },      // 'all' is an element in the array
            { targetRole: { $in: [user.role] } }  // user.role is an element in the array
          ]
        },
        {
          $or: [
            { targetBlock: null },              // Announcement for all blocks
            { targetBlock: user.block }         // Announcement for user's specific block
          ]
        },
        {
          $or: [
            { expiresAt: null },                // No expiration date
            { expiresAt: { $gt: new Date() } } // Expiration date in the future
          ]
        }
      ]
    };

    // Apply optional filters
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }

    // Query announcements
    const skip = (page - 1) * limit;
    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'name email')
      .populate('targetBlock', 'name')
      .sort({ pinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Announcement.countDocuments(filter);

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/announcements/:id
 * Returns single announcement details
 */
exports.getAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'name email')
      .populate('targetBlock', 'name');

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.json({ success: true, data: announcement });
  } catch (err) {
    console.error('Error fetching announcement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/announcements
 * Create new announcement (Admin/GM only)
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const user = req.user;
    const { title, content, type, priority, targetRole, targetBlock, expiresAt, pinned, attachmentUrl } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    // Validate role (only admin and gm)
    if (user.role !== 'admin' && user.role !== 'gm') {
      return res.status(403).json({ success: false, message: 'Only admin and GM can create announcements' });
    }

    // Validate targetBlock if provided
    if (targetBlock && targetBlock !== 'null' && targetBlock !== null) {
      if (!mongoose.Types.ObjectId.isValid(targetBlock)) {
        return res.status(400).json({ success: false, message: 'Invalid target block ID' });
      }
      const block = await Block.findById(targetBlock);
      if (!block) {
        return res.status(404).json({ success: false, message: 'Target block not found' });
      }
    }

    // Create announcement
    const announcement = new Announcement({
      title,
      content,
      type: type || 'GENERAL',
      priority: priority || 'MEDIUM',
      targetRole: targetRole || ['all'],
      targetBlock: targetBlock && targetBlock !== 'null' ? targetBlock : null,
      createdBy: user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      pinned: pinned || false,
      attachmentUrl: attachmentUrl || null
    });

    await announcement.save();
    await announcement.populate('createdBy', 'name email');
    await announcement.populate('targetBlock', 'name');

    // Emit socket event for real-time update
    try {
      const socketUtil = require('../utils/socket');
      const io = socketUtil.getIO && socketUtil.getIO();
      if (io) {
        io.emit('announcement:created', announcement.toObject());
      }
    } catch (e) { /* non-fatal */ }

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (err) {
    console.error('Error creating announcement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/announcements/:id
 * Update announcement (creator or admin)
 */
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { title, content, type, priority, targetRole, targetBlock, expiresAt, pinned } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Check permissions - only admin and gm can update
    if (user.role !== 'admin' && user.role !== 'gm') {
      return res.status(403).json({ success: false, message: 'Only admin and GM can edit announcements' });
    }

    // Update fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (priority) announcement.priority = priority;
    if (targetRole) announcement.targetRole = targetRole;
    if (targetBlock) {
      if (targetBlock === 'null' || targetBlock === null) {
        announcement.targetBlock = null;
      } else {
        announcement.targetBlock = targetBlock;
      }
    }
    if (expiresAt !== undefined) {
      announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    if (pinned !== undefined) announcement.pinned = pinned;

    await announcement.save();
    await announcement.populate('createdBy', 'name email');
    await announcement.populate('targetBlock', 'name');

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement
    });
  } catch (err) {
    console.error('Error updating announcement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/announcements/:id
 * Delete announcement (admin only)
 */
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement ID' });
    }

    // Only admin can delete
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can delete announcements' });
    }

    const announcement = await Announcement.findByIdAndDelete(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting announcement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
