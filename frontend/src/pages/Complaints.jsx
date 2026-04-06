import React, { useEffect, useState, useContext, useCallback } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import { useToast } from '../context/ToastContext';
import { getSocket } from '../utils/socket';
import timeAgo from '../utils/timeAgo';
import {
    MessageSquare, Plus, CheckCircle, Clock, AlertCircle,
    ArrowUpCircle, Eye, RefreshCw, X, ChevronDown, ChevronUp,
    History, Trash2
} from 'lucide-react';
import { logger } from '../utils/logger';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    open: { label: 'Open', variant: 'warning', icon: <Clock size={13} /> },
    under_review: { label: 'Under Review', variant: 'primary', icon: <Eye size={13} /> },
    in_progress: { label: 'In Progress', variant: 'primary', icon: <RefreshCw size={13} /> },
    escalated: { label: 'Escalated', variant: 'danger', icon: <ArrowUpCircle size={13} /> },
    resolved: { label: 'Resolved', variant: 'success', icon: <CheckCircle size={13} /> },
};

const CATEGORY_LABELS = {
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    internet: 'Internet',
    cleanliness: 'Cleanliness',
    security: 'Security',
    other: 'Other',
};

// ─── Escalation Modal ─────────────────────────────────────────────────────────
function EscalateModal({ isOpen, onClose, complaint, onEscalate }) {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const { addToast } = useToast();

    const handleSubmit = async () => {
        if (!reason.trim()) { setError('Escalation reason is required'); return; }
        setSaving(true);
        try {
            await onEscalate(complaint._id, reason.trim());
            onClose();
            setReason('');
        } catch (e) {
            // Backend returns { success: false, error: '...' } — read .error before .message
            setError(e.response?.data?.error || e.message || 'Failed to escalate');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <ArrowUpCircle size={18} className="text-red-500" />
                        Escalate Complaint
                    </h3>
                    <button onClick={onClose}><X size={18} style={{ color: 'var(--text-secondary)' }} /></button>
                </div>
                {complaint && (
                    <p className="text-sm mb-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        "{complaint.title}"
                    </p>
                )}
                <div className="mb-4">
                    <label className="form-label">Escalation Reason <span className="text-red-500">*</span></label>
                    <textarea
                        className={`form-input resize-none ${error ? 'border-red-500' : ''}`}
                        rows={3}
                        placeholder="Explain why this complaint needs escalation…"
                        value={reason}
                        onChange={e => { setReason(e.target.value); setError(''); }}
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="danger" onClick={handleSubmit} disabled={saving}>
                        {saving ? <RefreshCw size={14} className="animate-spin mr-1" /> : <ArrowUpCircle size={14} className="mr-1" />}
                        {saving ? 'Escalating…' : 'Escalate'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Complaint Row ────────────────────────────────────────────────────────────
function ComplaintRow({ complaint, user, onReview, onResolve, onEscalate, actioningIds }) {
    const [showHistory, setShowHistory] = useState(false);
    const sc = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;
    const isActioning = actioningIds.has(complaint._id);
    const isResolved = complaint.status === 'resolved';
    const isEscalated = complaint.status === 'escalated';

    const canResolve = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM].includes(user?.role) && !isResolved;
    const canReview = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM].includes(user?.role) && complaint.status === 'open';
    const canEscalate = [ROLES.ADMIN, ROLES.GM].includes(user?.role) && !isResolved && !isEscalated;

    return (
        <div className="rounded-lg border p-4 transition-all" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant={sc.variant} className="flex items-center gap-1">
                            {sc.icon} {sc.label}
                        </Badge>
                        <Badge variant="default">{CATEGORY_LABELS[complaint.category] || complaint.category}</Badge>
                        {complaint.priority === 'high' && <Badge variant="danger">High Priority</Badge>}
                    </div>
                    <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{complaint.title}</p>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{complaint.description}</p>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>By {complaint.user?.name || 'Unknown'} ({complaint.user?.role} - {complaint.user?.block?.name || 'Global'})</span>
                        <span>{timeAgo(complaint.createdAt)}</span>
                        {complaint.assignedTo && <span>Assigned: {complaint.assignedTo.name}</span>}
                        {isResolved && complaint.resolvedBy && (
                            <span className="text-green-600 dark:text-green-400">
                                Resolved by {complaint.resolvedBy.name}
                            </span>
                        )}
                        {isEscalated && complaint.escalatedBy && (
                            <span className="text-red-600 dark:text-red-400">
                                Escalated by {complaint.escalatedBy.name}: {complaint.escalationReason}
                            </span>
                        )}
                    </div>

                    {/* History toggle */}
                    {complaint.history?.length > 0 && (
                        <button
                            className="mt-2 flex items-center gap-1 text-xs transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            onClick={() => setShowHistory(v => !v)}
                        >
                            <History size={12} />
                            {showHistory ? 'Hide' : 'Show'} history ({complaint.history.length})
                            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                    {showHistory && complaint.history?.length > 0 && (
                        <div className="mt-2 space-y-1.5 pl-3 border-l-2" style={{ borderColor: 'var(--border)' }}>
                            {complaint.history.map((h, i) => (
                                <div key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                        {h.performedBy?.name || 'System'}
                                    </span>
                                    {' '}{h.action.replace('_', ' ')}
                                    {h.toStatus && ` → ${STATUS_CONFIG[h.toStatus]?.label || h.toStatus}`}
                                    {h.note && `: ${h.note}`}
                                    &nbsp;·&nbsp;{new Date(h.timestamp).toLocaleString()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                    {canReview && (
                        <Button size="sm" variant="secondary" disabled={isActioning}
                            onClick={() => onReview(complaint._id)}>
                            {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <Eye size={13} className="mr-1" />}
                            Review
                        </Button>
                    )}
                    {canResolve && (
                        <Button size="sm" variant="primary" disabled={isActioning}
                            onClick={() => onResolve(complaint)}>
                            {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <CheckCircle size={13} className="mr-1" />}
                            Resolve
                        </Button>
                    )}
                    {canEscalate && (
                        <Button size="sm" variant="danger" disabled={isActioning}
                            onClick={() => onEscalate(complaint)}>
                            <ArrowUpCircle size={13} className="mr-1" /> Escalate
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Complaint Detail Modal ──────────────────────────────────────────────
function ComplaintDetailModal({ isOpen, onClose, complaint, user, onReview, onResolve, onEscalate, onDeleteClick, actioningIds }) {
    const [showHistory, setShowHistory] = useState(false);
    const sc = complaint ? (STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open) : STATUS_CONFIG.open;
    const isActioning = complaint ? actioningIds.has(complaint._id) : false;

    const isResolved = complaint?.status === 'resolved';
    const isEscalated = complaint?.status === 'escalated';

    const canResolve = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM].includes(user?.role) && complaint && !isResolved;
    const canReview = [ROLES.ADMIN, ROLES.WARDEN, ROLES.GM].includes(user?.role) && complaint && complaint.status === 'open';
    const canEscalate = [ROLES.ADMIN, ROLES.GM].includes(user?.role) && complaint && !isResolved && !isEscalated;
    const canDelete = [ROLES.ADMIN].includes(user?.role) && complaint;

    useEffect(() => {
        if (isOpen) {
            console.log('ComplaintDetailModal opened with:', { canDelete, userRole: user?.role, complaintId: complaint?._id });
        }
        if (isOpen) setShowHistory(false);
    }, [isOpen]);

    if (!isOpen || !complaint) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
            <div className="relative w-full max-w-3xl rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            {sc.icon} {sc.label}
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{complaint.title}</p>
                    </div>
                    <button onClick={onClose} type="button" className="shrink-0">
                        <X size={18} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="default">{CATEGORY_LABELS[complaint.category] || complaint.category}</Badge>
                    {complaint.priority === 'high' && <Badge variant="danger">High Priority</Badge>}
                    {complaint.assignedTo && <Badge variant="secondary">Assigned</Badge>}
                </div>

                <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{complaint.description}</p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>By {complaint.user?.name || 'Unknown'} ({complaint.user?.role} - {complaint.user?.block?.name || 'Global'})</span>
                    <span>{timeAgo(complaint.createdAt)}</span>
                    {complaint.assignedTo && <span>Assigned: {complaint.assignedTo.name}</span>}
                    {isResolved && complaint.resolvedBy && (
                        <span className="text-green-600 dark:text-green-400">
                            Resolved by {complaint.resolvedBy.name}
                        </span>
                    )}
                    {isEscalated && complaint.escalatedBy && (
                        <span className="text-red-600 dark:text-red-400">
                            Escalated by {complaint.escalatedBy.name}: {complaint.escalationReason}
                        </span>
                    )}
                </div>

                {/* History */}
                {complaint.history?.length > 0 && (
                    <div className="mt-4">
                        <button
                            className="mt-2 flex items-center gap-1 text-xs transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            onClick={() => setShowHistory(v => !v)}
                            type="button"
                        >
                            <History size={12} />
                            {showHistory ? 'Hide' : 'Show'} history ({complaint.history.length})
                            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {showHistory && (
                            <div className="mt-2 space-y-1.5 pl-3 border-l-2" style={{ borderColor: 'var(--border)' }}>
                                {complaint.history.map((h, i) => (
                                    <div key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {h.performedBy?.name || 'System'}
                                        </span>
                                        {' '}{h.action.replace('_', ' ')}
                                        {h.toStatus && ` → ${STATUS_CONFIG[h.toStatus]?.label || h.toStatus}`}
                                        {h.note && `: ${h.note}`}
                                        &nbsp;·&nbsp;{new Date(h.timestamp).toLocaleString()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 justify-end mt-5">
                    {canReview && (
                        <Button size="sm" variant="secondary" disabled={isActioning} onClick={() => onReview(complaint._id)}>
                            {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <Eye size={13} className="mr-1" />}
                            Review
                        </Button>
                    )}
                    {canResolve && (
                        <Button size="sm" variant="primary" disabled={isActioning} onClick={() => onResolve(complaint)}>
                            {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <CheckCircle size={13} className="mr-1" />}
                            Resolve
                        </Button>
                    )}
                    {canEscalate && (
                        <Button size="sm" variant="danger" disabled={isActioning} onClick={() => onEscalate(complaint)}>
                            <ArrowUpCircle size={13} className="mr-1" /> Escalate
                        </Button>
                    )}
                    {canDelete && (
                        <Button size="sm" variant="danger" disabled={isActioning} onClick={() => {
                            console.log('Delete button clicked, calling onDeleteClick with complaint:', complaint);
                            onDeleteClick(complaint);
                        }}>
                            <Trash2 size={13} className="mr-1" /> Delete
                        </Button>
                    )}
                    <Button size="sm" variant="secondary" disabled={isActioning} onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Complaints() {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();

    const [complaints, setComplaints] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actioningIds, setActioningIds] = useState(new Set());

    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [blockFilter, setBlockFilter] = useState('all');

    // Submission form
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', description: '', category: 'plumbing', priority: 'medium' });
    const [formErrors, setFormErrors] = useState({});
    const [submitLoading, setSubmitLoading] = useState(false);

    // Resolve modal
    const [resolveTarget, setResolveTarget] = useState(null);
    const [resolveLoading, setResolveLoading] = useState(false);

    // Escalate modal
    const [escalateTarget, setEscalateTarget] = useState(null);

    // Delete modal
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const canSubmit = true; // All roles can submit
    const isAdminOrWarden = ['admin', 'warden'].includes(user?.role);
    const isAdmin = user?.role === 'admin';
    const isGM = user?.role === 'gm';
    const isDean = user?.role === 'dean';
    const isPrincipal = user?.role === 'principal';
    const isExecutiveReadOnly = isDean || isPrincipal;
    const canSeeStats = ['admin', 'warden', 'gm', 'dean', 'principal'].includes(user?.role);

    const setActioning = (id, val) => setActioningIds(prev => {
        const s = new Set(prev); val ? s.add(id) : s.delete(id); return s;
    });

    const [detailTarget, setDetailTarget] = useState(null);

    const fetchComplaints = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (categoryFilter !== 'all') params.category = categoryFilter;
            if (blockFilter !== 'all') params.block = blockFilter;

            const res = await api.get('/api/complaints', { params });
            setComplaints(res.data.data || res.data.complaints || []);
        } catch (err) {
            addToast('Failed to load complaints', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, statusFilter, categoryFilter, blockFilter]);

    const fetchBlocks = useCallback(async () => {
        if (!['admin', 'gm', 'dean', 'principal'].includes(user?.role)) return;
        try {
            const res = await api.get('/api/blocks');
            setBlocks(res.data.data || res.data.blocks || []);
        } catch (err) {
            logger.error('Failed to load blocks for filter:', err);
        }
    }, [user?.role]);

    useEffect(() => {
        fetchComplaints();
        fetchBlocks();

        const socket = getSocket();
        if (socket) {
            socket.on('complaints:refresh', fetchComplaints);
            socket.on('complaint:updated', fetchComplaints); // backward compat
        }

        return () => {
            if (socket) {
                socket.off('complaints:refresh', fetchComplaints);
                socket.off('complaint:updated', fetchComplaints);
            }
        };
    }, [fetchComplaints]);

    // ── Form logic ──────────────────────────────────────────────────────────
    const validateForm = () => {
        const e = {};
        if (!formData.title.trim()) e.title = 'Title is required';
        else if (formData.title.length < 3) e.title = 'Title must be at least 3 characters';
        if (!formData.description.trim()) e.description = 'Description is required';
        else if (formData.description.length < 10) e.description = 'Description must be at least 10 characters';
        setFormErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSubmitLoading(true);
        try {
            await api.post('/api/complaints', formData);
            await fetchComplaints();
            addToast('Complaint submitted successfully', 'success');
            setShowForm(false);
            setFormData({ title: '', description: '', category: 'plumbing', priority: 'medium' });
            setFormErrors({});
        } catch (err) {
            // Backend returns { success: false, error: '...' } — read .error before .message
            addToast(err.response?.data?.error || err.message || 'Failed to submit complaint', 'error');
        } finally {
            setSubmitLoading(false);
        }
    };

    // ── Review ──────────────────────────────────────────────────────────────
    const handleReview = async (id) => {
        setActioning(id, true);
        try {
            await api.put(`/api/complaints/${id}/review`, { note: 'Marked under review' });
            await fetchComplaints();
            addToast('Complaint marked as Under Review', 'success');
        } catch (err) {
            addToast(err.response?.data?.error || err.message || 'Failed to update', 'error');
        } finally {
            setActioning(id, false);
        }
    };

    // ── Resolve ─────────────────────────────────────────────────────────────
    const handleResolve = async () => {
        if (!resolveTarget) return;
        setResolveLoading(true);
        try {
            await api.put(`/api/complaints/${resolveTarget._id}/resolve`, {
                resolutionNote: `Resolved by ${user?.name}`
            });
            await fetchComplaints();
            addToast('Complaint resolved', 'success');
            setResolveTarget(null);
            setDetailTarget(null); // Close detail if open
        } catch (err) {
            addToast(err.response?.data?.error || err.message || 'Failed to resolve', 'error');
        } finally {
            setResolveLoading(false);
        }
    };

    // ── Escalate ────────────────────────────────────────────────────────────
    const handleEscalate = async (id, reason) => {
        setActioning(id, true);
        try {
            await api.put(`/api/complaints/${id}/escalate`, { reason });
            await fetchComplaints();
            addToast('Complaint escalated', 'success');
            setEscalateTarget(null);
            setDetailTarget(null); // Close detail if open
        } catch (err) {
            addToast(err.response?.data?.error || err.message || 'Failed to escalate', 'error');
            throw err;
        } finally {
            setActioning(id, false);
        }
    };

    // ── Delete ──────────────────────────────────────────────────────────────
    const handleDeleteComplaint = async () => {
        const target = deleteTarget;
        if (!target) return;

        setDeleteLoading(true);
        try {
            await api.delete(`/api/complaints/${target._id}`);
            await fetchComplaints();
            addToast('Complaint permanent removal successful', 'success');

            // UI cleanup
            setDeleteTarget(null);
            setDetailTarget(null);
        } catch (err) {
            logger.error('Delete complaint error:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Operation failed';
            addToast(`Delete failed: ${msg}`, 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    // ── Filtered list ───────────────────────────────────────────────────────
    const filtered = complaints.filter(c => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
        return true;
    });

    // Stats
    const stats = {
        open: complaints.filter(c => c.status === 'open').length,
        under_review: complaints.filter(c => c.status === 'under_review').length,
        escalated: complaints.filter(c => c.status === 'escalated').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div />

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchComplaints}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>
                    {(user?.role === 'admin' || user?.role === 'warden' || user?.role === 'student' || user?.role === 'gm') && (
                        <Button variant="primary" onClick={() => setShowForm(v => !v)}>
                            {showForm ? <X size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
                            {showForm ? 'Cancel' : 'New Complaint'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats row */}
            {canSeeStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Open" value={stats.open} color="amber" />
                    <StatCard label="Under Review" value={stats.under_review} color="blue" />
                    <StatCard label="Escalated" value={stats.escalated} color="red" />
                    <StatCard label="Resolved" value={stats.resolved} color="green" />
                </div>
            )}

            {/* Submission form */}
            {showForm && (
                <Card title="Submit New Complaint">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="form-label">Title <span className="text-red-500">*</span></label>
                            <input
                                className={`form-input ${formErrors.title ? 'border-red-500' : ''}`}
                                placeholder="Brief title of the issue"
                                value={formData.title}
                                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                            />
                            {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="form-label">Category <span className="text-red-500">*</span></label>
                                <select className="form-input"
                                    value={formData.category}
                                    onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}>
                                    {Object.entries(CATEGORY_LABELS).map(([val, lbl]) => (
                                        <option key={val} value={val}>{lbl}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Priority</label>
                                <select className="form-input"
                                    value={formData.priority}
                                    onChange={e => setFormData(p => ({ ...p, priority: e.target.value }))}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Description <span className="text-red-500">*</span></label>
                            <textarea
                                className={`form-input resize-none ${formErrors.description ? 'border-red-500' : ''}`}
                                rows={4}
                                placeholder="Describe the issue in detail (at least 10 characters)"
                                value={formData.description}
                                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                            />
                            {formErrors.description && <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>}
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit" variant="primary" disabled={submitLoading}>
                                {submitLoading ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
                                {submitLoading ? 'Submitting…' : 'Submit Complaint'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select className="input text-sm py-1.5 px-3" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 160 }}>
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <option key={val} value={val}>{cfg.label}</option>
                    ))}
                </select>
                <select className="input text-sm py-1.5 px-3" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ minWidth: 160 }}>
                    <option value="all">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                    ))}
                </select>

                {(isAdmin || isGM || isExecutiveReadOnly) && blocks.length > 0 && (
                    <select
                        className="input text-sm py-1.5 px-3"
                        value={blockFilter}
                        onChange={e => setBlockFilter(e.target.value)}
                        style={{ minWidth: 160 }}
                    >
                        <option value="all">All Blocks</option>
                        {blocks.map(b => (
                            <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Complaints List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={<MessageSquare size={32} />}
                    title="No complaints found"
                    description="No complaints match the current filters."
                />
            ) : (isAdmin || isGM || isExecutiveReadOnly) ? (
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Title</th>
                                <th>Block</th>
                                <th>Category</th>
                                <th>Priority</th>
                                <th>Assigned</th>
                                <th>Submitted</th>
                                <th className="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(complaint => {
                                const sc = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.open;
                                return (
                                    <tr key={complaint._id} className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10" onClick={() => setDetailTarget(complaint)}>
                                        <td>
                                            <Badge variant={sc.variant} className="flex items-center gap-1">
                                                {sc.icon} {sc.label}
                                            </Badge>
                                        </td>
                                        <td className="max-w-md">
                                            <div className="font-medium truncate">{complaint.title}</div>
                                        </td>
                                        <td>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {complaint.user?.block?.name || 'Global'}
                                            </Badge>
                                        </td>
                                        <td>
                                            {CATEGORY_LABELS[complaint.category] || complaint.category}
                                        </td>
                                        <td>
                                            {complaint.priority === 'high' ? <Badge variant="danger">High</Badge> : <Badge variant="default">Normal</Badge>}
                                        </td>
                                        <td>{complaint.assignedTo?.name || '-'}</td>
                                        <td className="text-xs text-slate-500">{timeAgo(complaint.createdAt)}</td>
                                        <td className="text-right whitespace-nowrap">
                                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setDetailTarget(complaint); }}>
                                                View Details
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(complaint => (
                        <ComplaintRow
                            key={complaint._id}
                            complaint={complaint}
                            user={user}
                            onReview={handleReview}
                            onResolve={setResolveTarget}
                            onEscalate={setEscalateTarget}
                            actioningIds={actioningIds}
                        />
                    ))}
                </div>
            )}

            {/* Complaint Detail Modal (Admin Table) */}
            <ComplaintDetailModal
                isOpen={!!detailTarget}
                onClose={() => setDetailTarget(null)}
                complaint={detailTarget}
                user={user}
                onReview={handleReview}
                onResolve={setResolveTarget}
                onEscalate={setEscalateTarget}
                onDeleteClick={setDeleteTarget}
                actioningIds={actioningIds}
            />

            {/* Confirm Resolve Modal */}
            <ConfirmModal
                isOpen={!!resolveTarget}
                onClose={() => setResolveTarget(null)}
                onConfirm={handleResolve}
                disabled={resolveLoading}
                title="Resolve Complaint"
                message={resolveTarget
                    ? `Are you sure you want to mark "${resolveTarget.title}" as resolved?\n\nThis will record you (${user?.name}) as the resolver with a timestamp.`
                    : ''}
                confirmText={resolveLoading ? 'Resolving…' : 'Yes, Resolve'}
                type="primary"
            />

            {/* Escalate Modal */}
            <EscalateModal
                isOpen={!!escalateTarget}
                onClose={() => setEscalateTarget(null)}
                complaint={escalateTarget}
                onEscalate={handleEscalate}
            />

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteComplaint}
                disabled={deleteLoading}
                title="Delete Complaint"
                message={deleteTarget
                    ? `Are you sure you want to delete "${deleteTarget.title}"?\n\nThis action cannot be undone.`
                    : ''}
                confirmText={deleteLoading ? 'Deleting…' : 'Yes, Delete'}
                type="danger"
            />
        </div>
    );
}

function StatCard({ label, value, color }) {
    const colors = {
        amber: 'text-amber-500', blue: 'text-blue-500', red: 'text-red-500', green: 'text-green-500'
    };
    return (
        <div className="card">
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
        </div>
    );
}
