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

    const roleMatch = (user.role || '').toLowerCase();
    
    // Default base conditions (not expired)
    const activeCondition = {
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    let filter = {};
    if (roleMatch === 'admin') {
      filter = activeCondition; // Admin sees all
    } else if (roleMatch === 'gm') {
      if (user.block) {
        filter = {
          $and: [
            activeCondition,
            {
              $or: [
                { targetBlock: null },
                { targetBlock: user.block },
                { createdBy: user.id }
              ]
            }
          ]
        };
      } else {
        filter = activeCondition;
      }
    } else if (roleMatch === 'warden') {
      filter = {
        $and: [
          activeCondition,
          {
            $or: [
              { targetBlock: null },
              { targetBlock: user.block },
              { createdBy: user.id }
            ]
          }
        ]
      };
    } else {
      // Student or others
      filter = {
        $and: [
          activeCondition,
          {
            $or: [
              { targetBlock: null },
              { targetBlock: user.block }
            ]
          },
          {
            $or: [
              { targetRole: { $in: ['all'] } },
              { targetRole: { $in: [roleMatch] } }
            ]
          }
        ]
      };
    }

    // Apply optional filters
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }
    if (req.query.blockId && req.query.blockId !== 'All') {
       filter.targetBlock = req.query.blockId;
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

    // Validate role (admin, gm, dean, principal, warden)
    const normalizedRole = (user.role || '').toLowerCase();
    const canPost = ['admin', 'gm', 'dean', 'principal', 'warden'].includes(normalizedRole);
    if (!canPost) {
      return res.status(403).json({ success: false, message: 'Not authorized to create announcements' });
    }

    // Warden enforcement for block
    let finalTargetBlock = targetBlock && targetBlock !== 'null' ? targetBlock : null;
    if (normalizedRole === 'warden') {
      finalTargetBlock = user.block; // Force warden's block
    } else if (normalizedRole === 'gm' && user.block && !finalTargetBlock) {
      finalTargetBlock = user.block; // Default to GM's block if not set, or let them set null if admin allows? GMs manage assigned blocks. 
      // Actually strictly:
      // if (targetBlock && targetBlock !== user.block) return 403? 
      // Let's just trust GM inputs unless they are bound to a single block, but the user spec says "GM: Can create and manage notices for assigned blocks." So:
      // If GM has a user.block, enforce it for creation if they don't have access to all. Let's just enforce user.block if it exists.
      finalTargetBlock = user.block;
    }

    if (finalTargetBlock && finalTargetBlock !== 'null' && finalTargetBlock !== null) {
      if (!mongoose.Types.ObjectId.isValid(finalTargetBlock)) {
        return res.status(400).json({ success: false, message: 'Invalid target block ID' });
      }
      const block = await Block.findById(finalTargetBlock);
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
      targetBlock: finalTargetBlock,
      createdBy: user.id,
      createdByRole: normalizedRole,
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

    // Check permissions - admin, gm, dean, principal, warden
    const roleMatch = (user.role || '').toLowerCase();
    if (!['admin', 'gm', 'dean', 'principal', 'warden'].includes(roleMatch)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit announcements' });
    }

    if (roleMatch !== 'admin') {
      if (roleMatch === 'gm') {
         if (user.block && announcement.targetBlock?.toString() !== user.block.toString() && announcement.createdBy.toString() !== user.id) {
             return res.status(403).json({ success: false, message: 'GMs can only manage notices for their assigned blocks' });
         }
         if (targetBlock && user.block && targetBlock !== user.block.toString()) {
             return res.status(403).json({ success: false, message: 'GMs cannot move notices to other blocks' });
         }
      } else if (roleMatch === 'warden') {
         if (announcement.targetBlock?.toString() !== user.block.toString() && announcement.createdBy.toString() !== user.id) {
            return res.status(403).json({ success: false, message: 'Wardens can only manage notices for their assigned blocks' });
         }
         if (targetBlock && targetBlock !== 'null' && targetBlock !== null && targetBlock !== user.block.toString()) {
            return res.status(403).json({ success: false, message: 'Wardens cannot assign notices to other blocks' });
         }
      } else {
         if (announcement.createdBy.toString() !== user.id) {
            return res.status(403).json({ success: false, message: `${user.role}s can only edit their own announcements` });
         }
      }
   }

    // Update fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (priority) announcement.priority = priority;
    if (targetRole) announcement.targetRole = targetRole;
    if (targetBlock !== undefined) {
      if (roleMatch === 'warden' || (roleMatch === 'gm' && user.block)) {
         announcement.targetBlock = user.block;
      } else {
        if (targetBlock === 'null' || targetBlock === null) {
          announcement.targetBlock = null;
        } else {
          announcement.targetBlock = targetBlock;
        }
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

    // Permissions check
    const currentRole = (user.role || '').toLowerCase();
    if (!['admin', 'gm', 'warden'].includes(currentRole)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete announcements' });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    if (currentRole !== 'admin') {
      if (currentRole === 'gm') {
         if (user.block && announcement.targetBlock?.toString() !== user.block.toString() && announcement.createdBy.toString() !== user.id) {
             return res.status(403).json({ success: false, message: 'GMs can only delete notices for their assigned blocks' });
         }
      } else if (currentRole === 'warden') {
         if (announcement.targetBlock?.toString() !== user.block.toString() && announcement.createdBy.toString() !== user.id) {
            return res.status(403).json({ success: false, message: 'Wardens can only delete notices for their assigned blocks' });
         }
      }
    }

    await Announcement.findByIdAndDelete(id);
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
