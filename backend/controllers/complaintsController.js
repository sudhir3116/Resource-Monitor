const Complaint = require('../models/Complaint');
const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../config/roles');
const mongoose = require('mongoose');

const VALID_CATEGORIES = ['plumbing', 'electrical', 'internet', 'cleanliness', 'security', 'other'];
const ALL_STATUSES = ['open', 'under_review', 'in_progress', 'escalated', 'resolved'];

// Role permission sets
const CAN_RESOLVE = [ROLES.ADMIN, ROLES.WARDEN];
const CAN_REVIEW = [ROLES.ADMIN, ROLES.WARDEN];
const CAN_ESCALATE = [ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN];
const CAN_SEE_ALL = [ROLES.ADMIN, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL];

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

        if (userRole === ROLES.STUDENT) {
            filter.user = userId;
        }
        // Warden, Dean, Principal, Admin see all

        const { status, category, priority } = req.query;
        if (status) filter.status = status;
        if (category) filter.category = category;
        if (priority) filter.priority = priority;

        const complaints = await Complaint.find(filter)
            .populate('user', 'name email role')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email')
            .populate('history.performedBy', 'name email role')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: complaints.length, data: complaints });
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

        const complaint = await Complaint.create({
            title: title.trim(),
            description: description.trim(),
            category,
            priority: priority || 'medium',
            user: userId,
            history: [{
                action: 'created',
                performedBy: userId,
                toStatus: 'open',
                note: 'Complaint submitted'
            }]
        });

        const populated = await Complaint.findById(complaint._id)
            .populate('user', 'name email role');

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
            .populate('user', 'name email role')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email');

        await logAction(req, id, 'STATUS_CHANGED', `Complaint "${complaint.title}" marked Under Review by ${req.user.role}`);

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
            .populate('user', 'name email role')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email');

        await logAction(req, id, 'RESOLVE', `Complaint "${complaint.title}" resolved by ${req.user.role}`);

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
                error: `Access denied. Only Dean, Principal, and Admin can escalate complaints. Your role: '${req.user.role}'`
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
            .populate('user', 'name email role')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email');

        await logAction(req, id, 'ESCALATE', `Complaint "${complaint.title}" escalated by ${req.user.role}: ${reason}`);

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
            .populate('user', 'name email role')
            .populate('assignedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('escalatedBy', 'name email');

        res.json({ success: true, message: 'Status updated', data: updated });
    } catch (error) {
        console.error('Update complaint status error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ─── GET /api/complaints/stats ────────────────────────────────────────────────
const getComplaintStatistics = async (req, res) => {
    try {
        if (!CAN_SEE_ALL.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const [byStatus, byCategory, byPriority, recentCount] = await Promise.all([
            Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
            Complaint.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
            Complaint.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
        ]);

        const total = byStatus.reduce((acc, s) => acc + s.count, 0);

        res.json({ success: true, total, byStatus, byCategory, byPriority, recentCount });
    } catch (error) {
        console.error('Complaint stats error:', error);
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
    getComplaintStatistics
};
