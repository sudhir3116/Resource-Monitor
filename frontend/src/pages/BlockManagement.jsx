import React, { useEffect, useState, useCallback, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
    Building2, Plus, Trash2, UserCheck, UserX,
    X, RefreshCw, Shield, Users, Edit2
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import Modal from '../components/common/Modal';
import { useToast } from '../context/ToastContext';
import useSortableTable from '../hooks/useSortableTable';
import SortIcon from '../components/common/SortIcon';

import { getSocket } from '../utils/socket';

// ─── Create Block Modal ───────────────────────────────────────────────────────
function CreateBlockModal({ isOpen, onClose, onCreated }) {
    const { addToast } = useToast();
    const [form, setForm] = useState({ name: '', type: 'Hostel', capacity: '', monthly_budget: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) { setForm({ name: '', type: 'Hostel', capacity: '', monthly_budget: '' }); setError(''); }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Block name is required.'); return; }
        setLoading(true);
        try {
            const res = await api.post('/api/admin/blocks', {
                name: form.name.trim(),
                type: form.type,
                capacity: Number(form.capacity) || 0,
                monthly_budget: Number(form.monthly_budget) || 0,
            });
            addToast(`Block "${res.data.data.name}" created successfully`, 'success');
            onCreated(res.data.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create block');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Block" size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="text-sm px-3 py-2 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                        {error}
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Block Name <span className="text-red-500">*</span>
                    </label>
                    <input className="input w-full" placeholder="e.g. Block A" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                    <select className="input w-full" value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="Hostel">Hostel</option>
                        <option value="Academic">Academic</option>
                        <option value="Administrative">Administrative</option>
                        <option value="Service">Service</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Capacity</label>
                        <input type="number" min="0" className="input w-full" placeholder="0" value={form.capacity}
                            onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Monthly Budget (₹)</label>
                        <input type="number" min="0" className="input w-full" placeholder="0" value={form.monthly_budget}
                            onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                        {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                        Create Block
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ─── Edit Block Modal ──────────────────────────────────────────────────────────
function EditBlockModal({ isOpen, onClose, block, onUpdated }) {
    const { addToast } = useToast();
    const [form, setForm] = useState({
        name: '',
        type: 'Hostel',
        capacity: '',
        monthly_budget: '',
        status: 'Active'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        setForm({
            name: block?.name || '',
            type: block?.type || 'Hostel',
            capacity: block?.capacity ?? '',
            monthly_budget: block?.monthly_budget ?? '',
            status: block?.status || 'Active'
        });
    }, [isOpen, block]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim()) {
            setError('Block name is required.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: form.name.trim(),
                type: form.type,
                capacity: Number(form.capacity) || 0,
                monthly_budget: Number(form.monthly_budget) || 0,
                status: form.status
            };
            const res = await api.patch(`/api/admin/blocks/${block._id}`, payload);
            if (res.data?.success) {
                addToast(`Block "${res.data.data?.name || form.name}" updated`, 'success');
                onUpdated(res.data.data || { ...block, ...payload });
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update block');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Block — ${block?.name || ''}`} size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="text-sm px-3 py-2 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Block Name <span className="text-red-500">*</span>
                    </label>
                    <input className="input w-full" value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                    <select className="input w-full" value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="Hostel">Hostel</option>
                        <option value="Academic">Academic</option>
                        <option value="Administrative">Administrative</option>
                        <option value="Service">Service</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Capacity</label>
                        <input type="number" min="0" className="input w-full" placeholder="0" value={form.capacity}
                            onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Monthly Budget (₹)</label>
                        <input type="number" min="0" className="input w-full" placeholder="0" value={form.monthly_budget}
                            onChange={e => setForm(f => ({ ...f, monthly_budget: e.target.value }))} />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
                    <select className="input w-full" value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="Active">Active</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Closed">Closed</option>
                    </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                        {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : null}
                        Save Changes
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ─── Assign Warden Modal ──────────────────────────────────────────────────────
function AssignWardenModal({ isOpen, onClose, block, wardens, onAssigned }) {
    const { addToast } = useToast();
    const [selectedWarden, setSelectedWarden] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) setSelectedWarden(block?.warden?._id || block?.warden || '');
    }, [isOpen, block]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const body = selectedWarden ? { wardenId: selectedWarden } : {};
            const res = await api.put(`/api/admin/blocks/${block._id}/warden`, body);
            addToast(res.data.message, 'success');
            onAssigned(res.data.data || { ...block, warden: null });
            onClose();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to update warden assignment', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Assign Warden — ${block?.name}`} size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Select a warden to assign to this block. Leave blank to unassign the current warden.
                </p>
                <select
                    className="input w-full"
                    value={selectedWarden}
                    onChange={e => setSelectedWarden(e.target.value)}
                >
                    <option value="">— Unassign (no warden) —</option>
                    {wardens.map(w => (
                        <option key={w._id} value={w._id}>
                            {w.name} ({w.email}){w.block ? ` — currently: ${w.block?.name || 'another block'}` : ''}
                        </option>
                    ))}
                </select>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                        {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : <UserCheck size={14} className="mr-1" />}
                        Save Assignment
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ─── Main Block Management Page ───────────────────────────────────────────────
export default function BlockManagement() {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'admin';
    const { addToast } = useToast();
    const [blocks, setBlocks] = useState([]);
    const [wardens, setWardens] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCreate, setShowCreate] = useState(false);
    const [assignTarget, setAssignTarget] = useState(null);
    const [editTarget, setEditTarget] = useState(null);

    const [selectedIds, setSelectedIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        message: '',
        onConfirm: null
    });

    const { sortedData: sortedBlocks, sortField, sortDirection, handleSort } = useSortableTable(
        blocks,
        'name',
        [blocks]
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [blocksRes, usersRes] = await Promise.all([
                api.get('/api/admin/blocks'),
                api.get('/api/admin/users'),
            ]);
            setBlocks(blocksRes.data.data || []);
            const allWardens = (usersRes.data.data || []).filter(u => u.role === 'warden');
            setWardens(allWardens);
        } catch (err) {
            addToast('Failed to load block data', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            socket.on('blocks:refresh', fetchData);
            return () => socket.off('blocks:refresh', fetchData);
        }
    }, [fetchData]);

    const handleCreated = (newBlock) => {
        fetchData();
    };

    const handleUpdated = () => {
        fetchData();
    };

    const handleSingleDelete = (blockId, blockName) => {
        setConfirmModal({
            open: true,
            message: `Delete "${blockName}"? This cannot be undone.`,
            onConfirm: async () => {
                try {
                    setConfirmModal({ open: false, message: '', onConfirm: null })
                    await api.delete(`/api/admin/blocks/${blockId}`)
                    await fetchData()
                    addToast(`Block "${blockName}" deleted`, 'success')
                } catch (err) {
                    console.error('Delete error:', err)
                    addToast('Failed to delete block', 'error')
                }
            }
        })
    }

    const handleBulkDelete = async () => {
        try {
            setBulkLoading(true)
            setConfirmModal({ open: false, message: '', onConfirm: null })

            // Delete each selected block one by one
            const results = await Promise.allSettled(
                selectedIds.map(id => api.delete(`/api/admin/blocks/${id}`))
            )

            const succeeded = results.filter(r => r.status === 'fulfilled').length
            const failed = results.filter(r => r.status === 'rejected').length

            // Clear selection
            setSelectedIds([])
            setSelectAll(false)

            // Refresh blocks list
            await fetchData()

            // Show result toast
            if (failed === 0) {
                addToast(`${succeeded} block(s) deleted successfully`, 'success')
            } else {
                addToast(`${succeeded} deleted, ${failed} could not be deleted`, 'warning')
            }
        } catch (err) {
            console.error('Bulk delete error:', err)
        } finally {
            setBulkLoading(false)
        }
    }

    const handleAssigned = (updatedBlock) => {
        if (!updatedBlock) { fetchData(); return; }
        setBlocks(prev => prev.map(b => b._id === updatedBlock._id ? updatedBlock : b));
        fetchData(); // refresh to get fully populated warden fields
    };

    const statusColor = (status) => {
        if (status === 'Active') return 'success';
        if (status === 'Maintenance') return 'warning';
        return 'default';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div />

                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>
                    {isAdmin && (
                        <Button variant="primary" onClick={() => setShowCreate(true)}>
                            <Plus size={15} className="mr-2" />
                            New Block
                        </Button>
                    )}
                </div>
            </div>

            {/* Block list */}
            <Card>
                {loading ? (
                    <div className="py-16 text-center">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Loading blocks...</p>
                    </div>
                ) : blocks.length === 0 ? (
                    <EmptyState
                        title="No Blocks Found"
                        description="Create your first hostel block using the button above."
                    />
                ) : (
                    <>
                        {selectedIds.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-2.5 mb-2 bg-blue-900/30 border border-blue-600/40 rounded-xl">
                                {/* Left: count + clear */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                                            <span className="text-white text-[10px] font-bold">
                                                {selectedIds.length}
                                            </span>
                                        </div>
                                        <span className="text-sm font-medium text-blue-300">
                                            {selectedIds.length === 1 ? '1 block selected' : `${selectedIds.length} blocks selected`}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedIds([])}
                                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        ✕ Clear
                                    </button>
                                </div>

                                {/* Right: action buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setConfirmModal({
                                            open: true,
                                            message: `Permanently delete ${selectedIds.length} block${selectedIds.length !== 1 ? 's' : ''}? This cannot be undone.`,
                                            onConfirm: handleBulkDelete
                                        })}
                                        disabled={bulkLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                                    >
                                        {bulkLoading ? (
                                            <span className="flex items-center gap-1.5">
                                                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                                Deleting...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5">
                                                🗑 Delete {selectedIds.length} Block{selectedIds.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Blocks Table Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-6 border-t border-[var(--border-color)]">
                            <div>
                                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    Block Records
                                </h3>
                                <p className="text-[11px] text-secondary mt-0.5">Manage and monitor hostel block assignments</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th className="w-12 px-3 py-3">
                                            <input
                                                type="checkbox"
                                                checked={blocks.length > 0 && selectedIds.length === blocks.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds(blocks.map(b => b._id))
                                                    } else {
                                                        setSelectedIds([])
                                                    }
                                                }}

                                                style={{ width: '16px', height: '16px', minWidth: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                                            />
                                        </th>
                                        <th onClick={() => handleSort('name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Block Name <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('type')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'type' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Type <SortIcon field="type" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('status')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'status' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('capacity')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'capacity' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Capacity <SortIcon field="capacity" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('warden.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'warden.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Assigned Warden <SortIcon field="warden.name" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        {isAdmin && <th className="text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedBlocks.map(block => {
                                        const warden = block.warden;
                                        return (
                                            <tr key={block._id} className={selectedIds.includes(block._id) ? 'bg-blue-900/20' : ''}>
                                                <td className="w-12 px-3 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(block._id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedIds(prev => [...prev, block._id])
                                                            } else {
                                                                setSelectedIds(prev => prev.filter(id => id !== block._id))
                                                            }
                                                        }}

                                                        style={{ width: '16px', height: '16px', minWidth: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <Building2 size={16} className="text-blue-500 flex-shrink-0" />
                                                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                            {block.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                        {block.type || 'Hostel'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <Badge variant={statusColor(block.status)}>
                                                        {block.status || 'Active'}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                        {block.capacity || 0}
                                                    </span>
                                                </td>
                                                <td>
                                                    {warden ? (
                                                        <div>
                                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                                {warden.name}
                                                            </p>
                                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                {warden.email}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                                                            ⚠ Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                {isAdmin ? (
                                                    <td className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                title="Edit block"
                                                                onClick={() => setEditTarget(block)}
                                                            >
                                                                <Edit2 size={14} />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                title="Assign / change warden"
                                                                onClick={() => setAssignTarget(block)}
                                                            >
                                                                <UserCheck size={14} className="mr-1" />
                                                                {warden ? 'Reassign' : 'Assign Warden'}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                title="Delete block"
                                                                onClick={() => handleSingleDelete(block._id, block.name)}
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                ) : <td />}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Card>

            {/* Modals */}
            <CreateBlockModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={handleCreated}
            />
            <EditBlockModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                block={editTarget}
                onUpdated={handleUpdated}
            />
            {assignTarget && (
                <AssignWardenModal
                    isOpen={!!assignTarget}
                    onClose={() => setAssignTarget(null)}
                    block={assignTarget}
                    wardens={wardens}
                    onAssigned={handleAssigned}
                />
            )}
            {
                confirmModal.open && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-sm p-6">

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-red-400 text-lg">⚠️</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">
                                        Confirm Delete
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-0.5">
                                        This action cannot be undone
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                                {confirmModal.message}
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal({
                                        open: false,
                                        message: '',
                                        onConfirm: null
                                    })}
                                    className="flex-1 py-2.5 border border-gray-600 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmModal.onConfirm}
                                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
