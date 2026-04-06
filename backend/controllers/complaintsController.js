const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../config/roles');
const mongoose = require('mongoose');
const { parsePagination } = require('../utils/queryBuilder');

const VALID_CATEGORIES = ['plumbing', 'electrical', 'internet', 'cleanliness', 'security', 'other'];
const ALL_STATUSES = ['open', 'under_review', 'in_progress', 'escalated', 'resolved'];

// ─── Status Transition Rules (State Machine) ──────────────────────────────────
// Defines valid transitions from each status
const VALID_TRANSITIONS = {
    'open': ['under_review', 'in_progress', 'escalated', 'resolved'],
    'under_review': ['in_progress', 'escalated', 'resolved', 'open'],
    'in_progress': ['escalated', 'resolved', 'open'],
    'escalated': ['resolved', 'in_progress', 'open'],
    'resolved': []  // Terminal state: cannot transition out
};

// Role permission sets
const CAN_RESOLVE = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM];
const CAN_REVIEW = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM];
const CAN_ESCALATE = [ROLES.ADMIN, ROLES.GM];
const CAN_SEE_ALL = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL];

/**
 * Notify connected clients that complaint lists/stats must refresh.
 * Non-fatal: skips if socket isn't initialized.
 */
const emitComplaintsRefresh = async () => {
    try {
        const socketUtil = require('../utils/socket');
        const socketManager = require('../socket/socketManager');
        const io = socketUtil.getIO && socketUtil.getIO();
        if (!io) return;

        io.emit('complaints:refresh');
        io.emit('dashboard:refresh');
        io.emit('usage:refresh');
        socketManager.emitToRole(io, 'admin', 'complaints:refresh', {});
        socketManager.emitToRole(io, 'gm', 'complaints:refresh', {});
    } catch {
        // non-fatal
    }
};

const logAction = async (req, complaintId, action, desc) => {
    try {
        const mappedAction = (action === 'RESOLVE') ? 'RESOLVE_COMPLAINT' :
            (action === 'ESCALATE') ? 'ESCALATE_COMPLAINT' :
                (action === 'COMMENT') ? 'COMMENT_COMPLAINT' : 'UPDATE';

        await AuditLog.create({
            action: mappedAction,
            resourceType: 'Complaint',
            resourceId: complaintId,
            userId: req.user.id || req.userId,
            description: desc,
            ipAddress: req.ip
        });
    } catch { }
};

// ─── GET /api/complaints ──────────────────────────────────────────────────────
const getComplaints = async (req, res) => {
    try {
        let filter = {};
        const userRole = req.user.role;
        const userId = req.user.id || req.userId;
        const { page = 1, limit = 20, status, category, priority, block } = req.query;
        const { skip, limit: pageLimit } = parsePagination({ page, limit });

        const blockId = req.user.block?._id || req.user.block;
        console.log("[DEBUG] Complaint Fetch - User Role:", userRole);
        console.log("[DEBUG] Complaint Fetch - User Block ID:", blockId);

        if (userRole === ROLES.STUDENT) {
            filter.user = userId;
        } else if (userRole === ROLES.WARDEN) {
            if (blockId) {
                filter.blockId = blockId;
            } else {
                filter._id = null; // Warden without a block sees nothing
            }
        } else if (['admin', 'principal', 'dean', 'gm'].includes(userRole)) {
            // Officials see all, or filter by block if provided in query
            if (block) {
                filter.blockId = block;
            }
        }

        console.log("[DEBUG] Final Applied Filter:", filter);

        if (status) filter.status = status;
        if (category) filter.category = category;
        if (priority) filter.priority = priority;

        const [complaints, total] = await Promise.all([
            Complaint.find(filter)
                .populate({
                    path: 'user',
                    select: 'name email role block',
                    populate: { path: 'block', select: 'name' }
                })
                .populate('assignedTo', 'name email')
                .populate('resolvedBy', 'name email')
                .populate('escalatedBy', 'name email')
                .populate('history.performedBy', 'name email role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageLimit)
                .lean(),
            Complaint.countDocuments(filter)
        ]);

        res.json({
            success: true,
            count: complaints.length,
            data: complaints,
            pagination: {
                page: parseInt(page),
                limit: pageLimit,
                total,
                pages: Math.ceil(total / pageLimit)
            }
        });
    } catch (error) {
        console.error('Get complaints error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── POST /api/complaints ─────────────────────────────────────────────────────
const createComplaint = async (req, res) => {
    try {
        const { title, description, category, priority } = req.body;
        const userId = req.user.id || req.userId;

        if (!title?.trim()) return res.status(400).json({ success: false, error: 'Title is required' });
        if (!description?.trim()) return res.status(400).json({ success: false, error: 'Description is required' });
        if (description.trim().length < 10) return res.status(400).json({ success: false, error: 'Description must be at least 10 characters' });
        if (!category) return res.status(400).json({ success: false, error: 'Category is required' });
        if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });

        const blockId = req.user.block?._id || req.user.block;
        if (!blockId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Cannot file complaint: No block assigned to your profile.' });
        }

        const complaint = await Complaint.create({
            title: title.trim(),
            description: description.trim(),
            category,
            priority: priority || 'medium',
            user: userId,
            blockId: blockId,
            history: [{
                action: 'created',
                performedBy: userId,
                toStatus: 'open',
                note: 'Complaint submitted'
            }]
        });

        const populated = await Complaint.findById(complaint._id)
            .populate({
                path: 'user',
                select: 'name email role block',
                populate: { path: 'block', select: 'name' }
            })
            .populate('history.performedBy', 'name email role');

        try {
            const socketUtil = require('../utils/socket');
            const socketManager = require('../socket/socketManager');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                socketManager.emitToRole(io, 'admin', 'dashboard:complaint_added', { complaintId: complaint._id });
                socketManager.emitToRole(io, 'gm', 'dashboard:complaint_added', { complaintId: complaint._id });
                socketManager.emitToRole(io, 'warden', 'dashboard:complaint_added', { complaintId: complaint._id });
            }
        } catch (e) { /* non-fatal */ }

        await emitComplaintsRefresh();
        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        console.error('Create complaint error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: Object.values(error.errors).map(e => e.message).join('. ') });
        }
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── PUT /api/complaints/:id/review ──────────────────────────────────────────
const reviewComplaint = async (req, res) => {
    try {
        if (!CAN_REVIEW.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Access denied. Only Wardens and Admins can mark complaints under review.' });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid complaint ID' });

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });
        if (complaint.status === 'resolved') return res.status(400).json({ success: false, error: 'Cannot review an already resolved complaint' });

        const userId = req.user.id || req.userId;
        const fromStatus = complaint.status;

        const updated = await Complaint.findByIdAndUpdate(id, {
            status: 'under_review',
            assignedTo: userId,
            $push: {
                history: {
                    action: 'status_changed',
                    performedBy: userId,
                    fromStatus,
                    toStatus: 'under_review',
                    note: req.body.note || 'Marked as Under Review'
                }
            }
        }, { returnDocument: 'after' })
            .populate({
                path: 'user',
                select: 'name email role block',
                populate: { path: 'block', select: 'name' }
            })
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email')
            .populate('history.performedBy', 'name email role');

        await logAction(req, id, 'STATUS_CHANGED', `Complaint "${complaint.title}" marked Under Review by ${req.user.role}`);

        try {
            const socketUtil = require('../utils/socket');
            const socketManager = require('../socket/socketManager');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                socketManager.emitToUser(io, complaint.user.toString(), 'complaint:updated', { complaintId: id, status: 'under_review' });
            }
        } catch (e) { /* non-fatal */ }

        await emitComplaintsRefresh();
        res.json({ success: true, message: 'Complaint marked as Under Review', data: updated });
    } catch (error) {
        console.error('Review complaint error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── PUT /api/complaints/:id/resolve ─────────────────────────────────────────
const resolveComplaint = async (req, res) => {
    try {
        if (!CAN_RESOLVE.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Only Wardens and Admins can resolve complaints. Your role: '${req.user.role}'`
            });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid complaint ID' });

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });
        if (complaint.status === 'resolved') return res.status(400).json({ success: false, error: 'Complaint is already resolved' });

        const resolverId = req.user.id || req.userId;
        const fromStatus = complaint.status;
        const resolutionNote = req.body.resolutionNote || req.body.note || 'Resolved';

        const updated = await Complaint.findByIdAndUpdate(id, {
            status: 'resolved',
            assignedTo: resolverId,
            resolvedBy: resolverId,
            resolvedAt: new Date(),
            resolutionNote,
            $push: {
                history: {
                    action: 'resolved',
                    performedBy: resolverId,
                    fromStatus,
                    toStatus: 'resolved',
                    note: resolutionNote
                }
            }
        }, { returnDocument: 'after', runValidators: true })
            .populate({
                path: 'user',
                select: 'name email role block',
                populate: { path: 'block', select: 'name' }
            })
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email')
            .populate('history.performedBy', 'name email role');

        await logAction(req, id, 'RESOLVE', `Complaint "${complaint.title}" resolved by ${req.user.role}`);

        try {
            const socketUtil = require('../utils/socket');
            const socketManager = require('../socket/socketManager');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                socketManager.emitToUser(io, complaint.user.toString(), 'complaint:updated', { complaintId: id, status: 'resolved' });
            }
        } catch (e) { /* non-fatal */ }

        await emitComplaintsRefresh();
        res.json({ success: true, message: 'Complaint resolved successfully', data: updated });
    } catch (error) {
        console.error('Resolve complaint error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── PUT /api/complaints/:id/escalate ────────────────────────────────────────
const escalateComplaint = async (req, res) => {
    try {
        if (!CAN_ESCALATE.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Only Admin/GM can escalate complaints. Your role: '${req.user.role}'`
            });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid complaint ID' });

        const { reason } = req.body;
        if (!reason?.trim()) return res.status(400).json({ success: false, error: 'Escalation reason is required' });

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });
        if (complaint.status === 'resolved') return res.status(400).json({ success: false, error: 'Cannot escalate a resolved complaint' });
        if (complaint.status === 'escalated') return res.status(400).json({ success: false, error: 'Complaint is already escalated' });

        const escalatorId = req.user.id || req.userId;
        const fromStatus = complaint.status;

        const updated = await Complaint.findByIdAndUpdate(id, {
            status: 'escalated',
            escalatedBy: escalatorId,
            escalatedAt: new Date(),
            escalationReason: reason.trim(),
            $push: {
                history: {
                    action: 'escalated',
                    performedBy: escalatorId,
                    fromStatus,
                    toStatus: 'escalated',
                    note: reason.trim()
                }
            }
        }, { returnDocument: 'after' })
            .populate({
                path: 'user',
                select: 'name email role block',
                populate: { path: 'block', select: 'name' }
            })
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email')
            .populate('history.performedBy', 'name email role');

        await logAction(req, id, 'ESCALATE', `Complaint "${complaint.title}" escalated by ${req.user.role}: ${reason}`);

        try {
            const socketUtil = require('../utils/socket');
            const socketManager = require('../socket/socketManager');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                socketManager.emitToUser(io, complaint.user.toString(), 'complaint:updated', { complaintId: id, status: 'escalated' });
            }
        } catch (e) { /* non-fatal */ }

        await emitComplaintsRefresh();
        res.json({ success: true, message: 'Complaint escalated', data: updated });
    } catch (error) {
        console.error('Escalate complaint error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── PUT /api/complaints/:id/status ──────────────────────────────────────────
const updateComplaintStatus = async (req, res) => {
    try {
        if (![...CAN_RESOLVE, ...CAN_ESCALATE].includes(req.user.role)) {
            return res.status(403).json({ success: false, error: `Access denied.` });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid complaint ID' });

        const { status } = req.body;
        if (!status || !ALL_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${ALL_STATUSES.join(', ')}` });
        }

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, error: 'Complaint not found' });

        // Validate status transition (state machine)
        const validTransitions = VALID_TRANSITIONS[complaint.status] || [];
        if (!validTransitions.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot transition from '${complaint.status}' to '${status}'. Valid transitions: ${validTransitions.join(', ')}`
            });
        }

        const userId = req.user.id || req.userId;
        const fromStatus = complaint.status;
        const updateData = {
            status,
            assignedTo: userId,
            $push: {
                history: {
                    action: 'status_changed',
                    performedBy: userId,
                    fromStatus,
                    toStatus: status,
                    note: req.body.note || `Status changed to ${status}`
                }
            }
        };

        if (status === 'resolved') {
            updateData.resolvedBy = userId;
            updateData.resolvedAt = new Date();
            updateData.resolutionNote = req.body.note || 'Resolved';
        }

        const updated = await Complaint.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true })
            .populate({
                path: 'user',
                select: 'name email role block',
                populate: { path: 'block', select: 'name' }
            })
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email');

        try {
            const socketUtil = require('../utils/socket');
            const socketManager = require('../socket/socketManager');
            const io = socketUtil.getIO && socketUtil.getIO();
            if (io) {
                socketManager.emitToUser(io, complaint.user.toString(), 'complaint:updated', { complaintId: id, status });
            }
        } catch (e) { /* non-fatal */ }

        await emitComplaintsRefresh();
        res.json({ success: true, message: 'Status updated', data: updated });
    } catch (error) {
        console.error('Update complaint status error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── GET /api/complaints/stats ────────────────────────────────────────────────
const getComplaintStatistics = async (req, res) => {
    try {
        let filter = {};
        const { block } = req.query;

        const blockId = req.user.block?._id || req.user.block;

        if (req.user.role === ROLES.WARDEN) {
            if (blockId) {
                filter.blockId = blockId;
            } else {
                filter._id = null;
            }
        } else if (['admin', 'gm', 'dean', 'principal'].includes(req.user.role)) {
            if (block) {
                filter.blockId = block;
            }
        }

        const [byStatus, byCategory, byPriority, recentCount] = await Promise.all([
            Complaint.aggregate([
                { $match: filter },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Complaint.aggregate([
                { $match: filter },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]),
            Complaint.aggregate([
                { $match: filter },
                { $group: { _id: '$priority', count: { $sum: 1 } } }
            ]),
            Complaint.countDocuments({ ...filter, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
        ]);

        const total = byStatus.reduce((acc, s) => acc + s.count, 0);

        res.json({ success: true, total, byStatus, byCategory, byPriority, recentCount });
    } catch (error) {
        console.error('Complaint stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── DELETE /api/complaints/:id (Admin only) ───────────────────────────────────
const deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: 'Invalid complaint ID' });
        }

        const complaint = await Complaint.findByIdAndDelete(id);

        if (!complaint) {
            return res.status(404).json({ success: false, error: 'Complaint not found' });
        }

        // Emit refresh signal to all connected clients
        try {
            await emitComplaintsRefresh();
        } catch (e) { /* non-fatal */ }

        return res.status(200).json({
            success: true,
            message: 'Complaint deleted successfully',
            data: complaint
        });
    } catch (error) {
        console.error('Delete complaint error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

module.exports = {
    getComplaints,
    createComplaint,
    reviewComplaint,
    resolveComplaint,
    escalateComplaint,
    updateComplaintStatus,
    getComplaintStatistics,
    deleteComplaint
};
