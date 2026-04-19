import React, { useEffect, useState, useContext, useCallback } from 'react';
import api from '../api';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import {
    Users, Search, Trash2, Edit2, Plus, Key, ToggleLeft, ToggleRight, UserCheck, RefreshCw, XCircle
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import Modal from '../components/common/Modal';
import useSortableTable from '../hooks/useSortableTable';
import SortIcon from '../components/common/SortIcon';
import { ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

// Roles available for creation / edit
const CREATABLE_ROLES = ['admin', 'gm', 'warden', 'student', 'dean', 'principal'];
// All roles for filter dropdown
const ALL_ROLES = ['admin', 'gm', 'warden', 'student', 'dean', 'principal'];

const getRoleLabel = (role) => {
    const labels = {
        admin: 'Admin',
        gm: 'General Manager',
        warden: 'Warden',
        student: 'Student',
        dean: 'Dean',
        principal: 'Principal',
        dean_principal: 'Dean / Principal' // Legacy display
    };
    // Map 'Dean / Principal' label (sometimes used as role string in legacy DB) to 'Dean'
    if (role === 'Dean / Principal') return 'Dean';
    return labels[role] || role;
};

// ─── Small reusable form field ────────────────────────────────────────────────
function FormField({ label, error, children }) {
    return (
        <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {label}
            </label>
            {children}
            {error && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        </div>
    );
}

// ─── Add / Edit User Modal ────────────────────────────────────────────────────
function UserFormModal({ isOpen, onClose, onSaved, blocks, editUser = null }) {
    const isEdit = !!editUser;
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const emptyForm = {
        name: '', email: '', password: '', role: 'student',
        block: '', room: '', status: 'active',
    };
    const [form, setForm] = useState(emptyForm);

    // Populate form when opening for edit
    useEffect(() => {
        if (isOpen) {
            if (editUser) {
                setForm({
                    name: editUser.name || '',
                    email: editUser.email || '',
                    password: '',          // never pre-fill password
                    role: editUser.role || 'student',
                    block: editUser.block?._id || editUser.block || '',
                    room: editUser.room || '',
                    status: editUser.status || 'active',
                });
            } else {
                setForm(emptyForm);
            }
            setErrors({});
        }
    }, [isOpen, editUser]);

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = 'Name is required';
        if (!isEdit && !form.email.trim()) errs.email = 'Email is required';
        if (!isEdit && form.password.length < 6) errs.password = 'Password must be at least 6 characters';

        if (form.role === 'warden' && !form.block) {
            errs.block = 'Block assignment is required for wardens';
        }
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }

        setLoading(true);
        try {
            const payload = {
                name: form.name.trim(),
                role: form.role,
                block: form.block || null,
                room: form.room.trim() || null,
                status: form.status,
            };

            let res;
            if (isEdit) {
                res = await api.put(`/api/admin/users/${editUser._id}`, payload);
            } else {
                res = await api.post('/api/admin/users', {
                    ...payload,
                    email: form.email.trim(),
                    password: form.password,
                });
            }

            if (res.data.success) {
                addToast(isEdit ? 'User updated successfully' : 'User created successfully', 'success');
                onSaved(res.data.data);
                onClose();
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Operation failed';
            addToast(msg, 'error');
            if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('warden')) {
                // specific error handling could go here
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={isEdit ? `Edit User — ${editUser?.name}` : 'Add New User'}
            size="md"
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create User')}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <FormField label="Full Name *" error={errors.name}>
                    <input
                        className="input"
                        placeholder="e.g. Rahul Sharma"
                        value={form.name}
                        onChange={set('name')}
                        autoFocus
                    />
                </FormField>

                {/* Email — editable only for create */}
                <FormField label={isEdit ? 'Email (read-only)' : 'Email *'} error={errors.email}>
                    <input
                        className="input"
                        type="email"
                        placeholder="user@college.com"
                        value={form.email}
                        onChange={set('email')}
                        disabled={isEdit}
                        style={isEdit ? { opacity: 0.6 } : {}}
                    />
                </FormField>

                {/* Password — only for create */}
                {!isEdit && (
                    <FormField label="Password *" error={errors.password}>
                        <input
                            className="input"
                            type="password"
                            placeholder="Min 6 characters"
                            value={form.password}
                            onChange={set('password')}
                            autoComplete="new-password"
                        />
                    </FormField>
                )}

                {/* Role + Status side by side */}
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Role">
                        <select className="input" value={form.role} onChange={set('role')}>
                            {CREATABLE_ROLES.map(r => (
                                <option key={r} value={r}>{getRoleLabel(r)}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Status">
                        <select className="input" value={form.status} onChange={set('status')}>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </FormField>
                </div>

                {/* Block */}
                {['warden', 'student'].includes(form.role) && (
                    <FormField label={form.role === 'warden' ? 'Block Assignment (required for warden)' : 'Block Assignment'}>
                        <select className="input" value={form.block} onChange={set('block')}>
                            <option value="">— No block —</option>
                            {blocks.map(b => (
                                <option key={b._id} value={b._id}>{b.name}</option>
                            ))}
                        </select>
                        {form.role === 'warden' && (
                            <p className="text-xs mt-1" style={{ color: 'var(--color-warning)' }}>
                                Each block can only have one warden.
                            </p>
                        )}
                    </FormField>
                )}

                {/* Room (student only) */}
                {form.role === 'student' && (
                    <FormField label="Room Number">
                        <input
                            className="input"
                            placeholder="e.g. A-101"
                            value={form.room}
                            onChange={set('room')}
                        />
                    </FormField>
                )}
            </form>
        </Modal>
    );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ isOpen, onClose, targetUser }) {
    const { addToast } = useToast();
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) { setNewPassword(''); setError(''); }
    }, [isOpen]);

    const handleReset = async () => {
        if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true);
        try {
            const res = await api.patch(`/api/admin/users/${targetUser._id}/password`, { newPassword });
            if (res.data.success) {
                addToast(res.data.message, 'success');
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={`Reset Password — ${targetUser?.name}`}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" onClick={handleReset} disabled={loading}>
                        {loading ? 'Resetting…' : 'Reset Password'}
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Set a new password for <strong style={{ color: 'var(--text-primary)' }}>{targetUser?.email}</strong>.
                </p>
                <input
                    className="input"
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    autoFocus
                />
                {error && (
                    <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
                )}
            </div>
        </Modal>
    );
}

// ─── Bulk Role Modal ──────────────────────────────────────────────────────────
function BulkRoleModal({ isOpen, onClose, selectedCount, onConfirm }) {
    const [role, setRole] = useState('student');
    const [loading, setLoading] = useState(false);

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={`Change Role — ${selectedCount} Users`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" onClick={() => onConfirm(role)} disabled={loading}>
                        {loading ? 'Applying…' : `Apply to ${selectedCount} Users`}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Select the new role to assign to all selected users:
                </p>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                    {CREATABLE_ROLES.map(r => (
                        <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                </select>
                <div className="p-3 rounded-lg border flex gap-3" style={{ backgroundColor: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                    <AlertCircle size={20} className="flex-shrink-0" style={{ color: 'var(--color-warning)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        ⚠️ This will change the role for <strong>{selectedCount}</strong> users at once.
                        Wardens and Students will have their block assignment cleared if switching to Admin/GM/Dean.
                    </p>
                </div>
            </div>
        </Modal>
    );
}

// ─── Bulk Delete Modal ────────────────────────────────────────────────────────
function BulkDeleteModal({ isOpen, onClose, selectedUsers, onConfirm, confirmText, setConfirmText, loading }) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={`Delete ${selectedUsers.length} Users?`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button
                        variant="danger"
                        disabled={confirmText.trim() !== 'DELETE' || loading}
                        onClick={onConfirm}
                        className={confirmText.trim() === 'DELETE' && !loading ? 'bg-red-600 hover:bg-red-700' : ''}
                    >
                        {loading ? 'Deleting…' : `Delete ${selectedUsers.length} Users`}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm font-medium" style={{ color: 'var(--color-danger)' }}>
                    This action cannot be undone. The following users will be permanently deleted:
                </p>
                <div className="max-h-40 overflow-y-auto border rounded p-2 text-xs space-y-1" style={{ borderColor: 'var(--border)' }}>
                    {selectedUsers.map(u => (
                        <div key={u._id} className="flex justify-between">
                            <span>{u.name} ({u.email})</span>
                            <Badge variant="secondary" size="xs">{u.role}</Badge>
                        </div>
                    ))}
                </div>
                <div className="space-y-2">
                    <label className="text-sm">Type <strong className="text-red-600">DELETE</strong> to confirm:</label>
                    <input
                        className="input"
                        placeholder="Type DELETE"
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>
        </Modal>
    );
}

// ─── Bulk Reset Password Modal ────────────────────────────────────────────────
function BulkResetPasswordModal({ isOpen, onClose, selectedCount, onConfirm }) {
    const [password, setPassword] = useState('');
    const [forceChange, setForceChange] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    useEffect(() => {
        if (isOpen) { setPassword(''); setShowPw(false); }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={`Reset Password — ${selectedCount} Users`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={password.length < 6 || loading}
                        onClick={() => onConfirm(password, forceChange)}
                    >
                        {loading ? 'Resetting…' : `Reset for ${selectedCount} Users`}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Set a new temporary password for all selected users:
                </p>
                <div className="relative">
                    <input
                        className="input pr-10"
                        type={showPw ? 'text' : 'password'}
                        placeholder="New password (min 6 chars)"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                        {showPw ? <Key size={16} /> : <Key size={16} className="opacity-50" />}
                    </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={forceChange}
                        onChange={e => setForceChange(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Force password change on next login</span>
                </label>
            </div>
        </Modal>
    );
}

// ─── Bulk Block Modal ────────────────────────────────────────────────────────
function BulkBlockModal({ isOpen, onClose, selectedCount, onConfirm, blocks }) {
    const [blockId, setBlockId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) { setBlockId(''); }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={`Change Block — ${selectedCount} Users`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" onClick={() => onConfirm(blockId)} disabled={loading || !blockId}>
                        {loading ? 'Applying…' : `Apply to ${selectedCount} Users`}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Select the new block to assign to all selected users:
                </p>
                <select className="input" value={blockId} onChange={e => setBlockId(e.target.value)}>
                    <option value="">— Select a block —</option>
                    {blocks.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                </select>
                <div className="p-3 rounded-lg border flex gap-3" style={{ backgroundColor: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }}>
                    <Users size={20} className="flex-shrink-0 text-blue-500" />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Applying change to <strong>{selectedCount}</strong> selected users.
                    </p>
                </div>
            </div>
        </Modal>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const { addToast } = useToast();
    const { user: currentUser } = useAuth();
    const userRole = (currentUser?.role || '').toString().toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'administrator';
    const isGM = userRole === 'gm' || userRole === 'general manager';
    const canManageUsers = isAdmin || isGM;
    const canManageResources = canManageUsers;

    // Selection
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkLoading, setIsBulkLoading] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [editUser, setEditUser] = useState(null);      // null = closed
    const [resetTarget, setResetTarget] = useState(null); // null = closed
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk Modals
    const [showBulkRole, setShowBulkRole] = useState(false);
    const [showBulkBlock, setShowBulkBlock] = useState(false);
    const [showBulkDelete, setShowBulkDelete] = useState(false);
    const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState('');
    const [showBulkResetPw, setShowBulkResetPw] = useState(false);
    const [bulkActionConfirm, setBulkActionConfirm] = useState(null); // { type, actionType, count }

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, blocksRes] = await Promise.all([
                api.get('/api/admin/users'),
                api.get('/api/admin/blocks'),
            ]);
            setUsers(usersRes.data.data || usersRes.data.users || []);
            setBlocks(blocksRes.data.data || []);
        } catch (err) {
            logger.error('Failed to fetch users', err);
            addToast('Failed to fetch users', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
        const socket = getSocket();
        if (socket) {
            socket.on('users:refresh', fetchUsers);
        }

        return () => {
            if (socket) {
                socket.off('users:refresh', fetchUsers);
            }
        };
    }, [fetchUsers]);

    // ── User saved (create or edit) ───────────────────────────────────────────
    const handleUserSaved = (saved) => {
        fetchUsers();
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!userToDelete || isDeleting) return; // guard against double-click
        setIsDeleting(true);
        try {
            const res = await api.delete(`/api/admin/users/${userToDelete._id}`);
            if (res.data.success) {
                // Optimistic UI: remove from local state immediately, then refetch
                setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
                setSelectedIds(prev => prev.filter(id => id !== userToDelete._id));
                addToast(`${userToDelete.name} has been permanently deleted.`, 'success');
                fetchUsers(); // background sync with server
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to delete user. Please try again.', 'error');
        } finally {
            setIsDeleting(false);
            setUserToDelete(null);
        }
    };

    // ── Toggle Status ─────────────────────────────────────────────────────────
    const handleToggleStatus = async (user) => {
        try {
            const res = await api.patch(`/api/admin/users/${user._id}/status`);
            if (res.data.success) {
                const newStatus = res.data.data.status;
                addToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
                fetchUsers();
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to update status', 'error');
        }
    };

    // ── Bulk Selection Logic ──────────────────────────────────────────────────
    const handleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (visibleUsers) => {
        const allIds = visibleUsers.map(u => u._id);
        const allSelected = allIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
        }
    };

    // ── Bulk Actions API ──────────────────────────────────────────────────────
    const handleBulkRoleChange = async (newRole) => {
        setIsBulkLoading(true);
        try {
            const res = await api.put('/api/admin/users/bulk/role', {
                userIds: selectedIds,
                role: newRole
            });
            addToast(res.data.message, 'success');
            setSelectedIds([]);
            setShowBulkRole(false);
            fetchUsers();
        } catch (err) {
            addToast(err.response?.data?.message || 'Bulk update failed', 'error');
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkStatus = async (status) => {
        setIsBulkLoading(true);
        try {
            const res = await api.put('/api/admin/users/bulk/status', {
                userIds: selectedIds,
                status: status === 'active' ? 'active' : 'suspended'
            });
            addToast(res.data.message, 'success');
            setSelectedIds([]);
            setBulkActionConfirm(null);
            fetchUsers();
        } catch (err) {
            addToast(err.response?.data?.message || 'Bulk status update failed', 'error');
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (bulkDeleteConfirmation.trim() !== 'DELETE') return;

        try {
            setIsBulkLoading(true);

            const res = await api.delete('/api/admin/users/bulk', {
                data: {
                    userIds: Array.from(selectedIds),
                    confirmation: 'DELETE'
                }
            });

            setShowBulkDelete(false);
            setBulkDeleteConfirmation('');
            setSelectedIds([]);

            addToast(`${res.data.deletedCount} users deleted successfully`, 'success');

            if (res.data.excluded > 0) {
                addToast('Your own account was excluded', 'info');
            }

            fetchUsers();

        } catch (err) {
            addToast(err.response?.data?.message || 'Bulk delete failed', 'error');
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkResetPw = async (newPassword, forceChange) => {
        setIsBulkLoading(true);
        try {
            const res = await api.put('/api/admin/users/bulk/reset-password', {
                userIds: selectedIds,
                newPassword,
                forceChange
            });
            addToast(res.data.message, 'success');
            setSelectedIds([]);
            setShowBulkResetPw(false);
            fetchUsers();
        } catch (err) {
            addToast(err.response?.data?.message || 'Bulk password reset failed', 'error');
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkBlockChange = async (newBlockId) => {
        setIsBulkLoading(true);
        try {
            // As per Step 5: loop through existing API
            const updatePromises = selectedIds.map(id =>
                api.put(`/api/admin/users/${id}`, { block: newBlockId })
            );

            await Promise.all(updatePromises);

            addToast(`Block updated for ${selectedIds.length} users`, 'success');
            setSelectedIds([]);
            setShowBulkBlock(false);
            fetchUsers();
        } catch (err) {
            addToast(err.response?.data?.message || 'Bulk block update failed. Some users might not have updated correctly.', 'error');
        } finally {
            setIsBulkLoading(false);
        }
    };

    // ── Inline role change (quick dropdown) ───────────────────────────────────
    const handleRoleChange = async (userId, newRole) => {
        if (!canManageUsers) return;
        try {
            const res = await api.patch(`/api/admin/users/${userId}/role`, { role: newRole });
            if (res.data.success) {
                addToast('Role updated', 'success');
                const updatedUser = res.data.data || res.data.user;
                setUsers(prev => prev.map(u =>
                    u._id === userId ? (updatedUser || { ...u, role: newRole }) : u
                ));
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to update role', 'error');
        }
    };

    // ── Filter ────────────────────────────────────────────────────────────────
    const filteredUsers = React.useMemo(() => {
        // Clear selection when filters change
        return users.filter(u => {
            const matchSearch =
                (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchRole = roleFilter === 'All' || u.role === roleFilter;
            return matchSearch && matchRole;
        });
    }, [users, searchTerm, roleFilter]);

    // Clear selection when search or role changes
    useEffect(() => {
        setSelectedIds([]);
    }, [searchTerm, roleFilter]);

    const { sortedData: finalUsers, sortField, sortDirection, handleSort } = useSortableTable(
        filteredUsers,
        'createdAt',
        [searchTerm, roleFilter]
    );

    const statusVariant = (s) => {
        const norm = (s || '').toLowerCase();
        if (norm === 'active' || norm === 'approved') return 'success';
        if (norm === 'suspended' || norm === 'rejected') return 'danger';
        if (norm === 'pending') return 'warning';
        return 'warning';
    };

    // Normalize status string for display (DB may store 'APPROVED', 'active', etc.)
    const normalizeStatusLabel = (s) => {
        const norm = (s || '').toLowerCase();
        if (norm === 'active' || norm === 'approved') return 'Active';
        if (norm === 'suspended') return 'Suspended';
        if (norm === 'pending') return 'Pending';
        if (norm === 'rejected') return 'Rejected';
        return s || 'Unknown';
    };

    // Whether user is currently in an "active" state (for toggle button display)
    const isUserActive = (s) => {
        const norm = (s || '').toLowerCase();
        return norm === 'active' || norm === 'approved';
    };


    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div />

                <div className="flex gap-3 items-center">
                    <button
                        onClick={fetchUsers}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>

                    {canManageUsers && (
                        <Button variant="primary" onClick={() => setShowAddModal(true)}>
                            <Plus size={16} className="mr-2" />
                            Add User
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: users.length, icon: Users },
                    { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: UserCheck },
                    { label: 'Wardens', value: users.filter(u => u.role === 'warden').length, icon: UserCheck },
                    { label: 'Students', value: users.filter(u => u.role === 'student').length, icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                    <Card key={label}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-hover)' }}>
                                <Icon size={18} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            className="input pl-10"
                            placeholder="Search by name or email…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <select
                            className="input"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="All">All Roles</option>
                            {ALL_ROLES.map(role => (
                                <option key={role} value={role}>
                                    {getRoleLabel(role)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Bulk Actions Toolbar (Sticky Top) */}
            <div className={`sticky top-0 z-20 transition-all duration-300 ${selectedIds.length > 0 ? 'translate-y-0 opacity-100 mb-6' : '-translate-y-4 opacity-0 h-0 pointer-events-none'}`}>
                <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-2 border-blue-500/30 rounded-2xl shadow-xl shadow-blue-500/10">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            {selectedIds.length}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {selectedIds.length} User{selectedIds.length !== 1 ? 's' : ''} Selected
                            </p>
                            <button
                                onClick={() => setSelectedIds([])}
                                className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <select
                                className="appearance-none bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-5 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    if (val === 'delete') {
                                        setShowBulkDelete(true);
                                    } else if (val === 'activate') {
                                        setBulkActionConfirm({ type: 'status', actionType: 'active', count: selectedIds.length });
                                    } else if (val === 'deactivate') {
                                        setBulkActionConfirm({ type: 'status', actionType: 'suspended', count: selectedIds.length });
                                    } else if (val === 'role') {
                                        setShowBulkRole(true);
                                    } else if (val === 'block') {
                                        setShowBulkBlock(true);
                                    } else if (val === 'password') {
                                        setShowBulkResetPw(true);
                                    }
                                    e.target.value = ''; // reset dropdown
                                }}
                            >
                                <option value="">Bulk Actions</option>
                                <optgroup label="Account Status">
                                    <option value="activate">Activate Selected</option>
                                    <option value="deactivate">Deactivate Selected</option>
                                </optgroup>
                                <optgroup label="Management">
                                    <option value="role">Change Roles</option>
                                    <option value="block">Change Block</option>
                                    <option value="password">Reset Passwords</option>
                                </optgroup>
                                {isAdmin && (
                                    <optgroup label="Destructive">
                                        <option value="delete">Delete Permanently</option>
                                    </optgroup>
                                )}
                            </select>
                            <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2" />

                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setBulkActionConfirm({ type: 'status', actionType: 'active', count: selectedIds.length })}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Activate All
                        </Button>
                        {isAdmin && (
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setShowBulkDelete(true)}
                            >
                                Delete All
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <Card>
                {loading ? (
                    <div className="py-8 text-center text-slate-500">Loading users…</div>
                ) : finalUsers.length === 0 ? (
                    <EmptyState title="No Users Found" description="Try adjusting your search or filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    {canManageUsers && (
                                        <th className="w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={finalUsers.length > 0 && finalUsers.every(u => selectedIds.includes(u._id))}
                                                onChange={() => handleSelectAll(finalUsers)}
                                                style={{ width: '16px', height: '16px', minWidth: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                                            />
                                        </th>
                                    )}
                                    <th onClick={() => handleSort('name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        User <SortIcon field="name" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('role')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'role' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Role <SortIcon field="role" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('block.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'block.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Block <SortIcon field="block.name" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('room')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'room' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Room <SortIcon field="room" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('status')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'status' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Status <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    {canManageUsers && <th className="text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {finalUsers.map(user => {
                                    const isSelected = selectedIds.includes(user._id);
                                    return (
                                        <tr key={user._id} className={isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                                            {canManageUsers && (
                                                <td className="text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectOne(user._id)}
                                                        style={{ width: '16px', height: '16px', minWidth: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                                                    />
                                                </td>
                                            )}
                                            {/* User info */}
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {user.avatar
                                                            ? <img src={user.avatar} className="h-full w-full object-cover" alt={user.name} />
                                                            : <Users size={15} />
                                                        }
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                                            {user.name}
                                                            {user._id === currentUser?._id && (
                                                                <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>(you)</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role — inline dropdown for quick change */}
                                            <td>
                                                {!isAdmin || user._id === currentUser?._id ? (
                                                    <Badge variant="primary">{getRoleLabel(user.role)}</Badge>
                                                ) : (
                                                    <select
                                                        className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                                        style={{ color: 'var(--text-primary)' }}
                                                        disabled={!isAdmin || user._id === currentUser?._id}
                                                    >
                                                        {ALL_ROLES.map(r => (
                                                            <option key={r} value={r}>{getRoleLabel(r)}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>

                                            {/* Block */}
                                            <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                {user.block?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>

                                            {/* Room */}
                                            <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                {user.room || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>

                                            {/* Status badge */}
                                            <td>
                                                <Badge variant={statusVariant(user.status)}>
                                                    {normalizeStatusLabel(user.status)}
                                                </Badge>
                                            </td>

                                            {/* Actions */}
                                            {canManageUsers && (
                                                <td className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Edit */}
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => setEditUser(user)}
                                                            title="Edit user"
                                                        >
                                                            <Edit2 size={14} />
                                                        </Button>

                                                        {/* Reset Password */}
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => setResetTarget(user)}
                                                            title="Reset password"
                                                        >
                                                            <Key size={14} />
                                                        </Button>

                                                        {/* Toggle Status (not for self) */}
                                                        {user._id !== currentUser?._id && (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => handleToggleStatus(user)}
                                                                title={isUserActive(user.status) ? 'Suspend user' : 'Activate user'}
                                                            >
                                                                {isUserActive(user.status)
                                                                    ? <ToggleRight size={14} style={{ color: 'var(--color-success)' }} />
                                                                    : <ToggleLeft size={14} style={{ color: 'var(--color-danger)' }} />
                                                                }
                                                            </Button>
                                                        )}

                                                        {/* Onboarding Actions (Approve/Reject) */}
                                                        {(user.status === 'PENDING' || user.status === 'pending') && (
                                                            <>
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await api.put(`/api/admin/approve/${user._id}`);
                                                                            addToast('User approved', 'success');
                                                                            fetchUsers();
                                                                        } catch(e) { addToast('Approval failed', 'error'); }
                                                                    }}
                                                                    title="Approve User"
                                                                    className="bg-green-50 text-green-600 hover:bg-green-100"
                                                                >
                                                                    <UserCheck size={14} />
                                                                </Button>
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        try {
                                                                            await api.put(`/api/admin/reject/${user._id}`);
                                                                            addToast('User rejected', 'info');
                                                                            fetchUsers();
                                                                        } catch(e) { addToast('Rejection failed', 'error'); }
                                                                    }}
                                                                    title="Reject User"
                                                                    className="bg-red-50 text-red-600 hover:bg-red-100"
                                                                >
                                                                    <XCircle size={14} />
                                                                </Button>
                                                            </>
                                                        )}

                                                        {/* Delete (Admin only, not for self) */}
                                                        {isAdmin && user._id !== currentUser?._id && (
                                                            <Button
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => setUserToDelete(user)}
                                                                title="Delete user"
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Pagination hint */}
            {finalUsers.length > 0 && (
                <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
                    Showing {finalUsers.length} of {users.length} users
                </p>
            )}

            {/* ── Modals ───────────────────────────────────────────────────── */}

            {/* Add User */}
            <UserFormModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSaved={handleUserSaved}
                blocks={blocks}
            />

            {/* Edit User */}
            <UserFormModal
                isOpen={!!editUser}
                onClose={() => setEditUser(null)}
                onSaved={handleUserSaved}
                blocks={blocks}
                editUser={editUser}
            />

            {/* Reset Password */}
            <ResetPasswordModal
                isOpen={!!resetTarget}
                onClose={() => setResetTarget(null)}
                targetUser={resetTarget}
            />

            {/* Confirm Delete */}
            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => !isDeleting && setUserToDelete(null)}
                onConfirm={handleDelete}
                title="Delete User"
                message={userToDelete
                    ? `Are you sure you want to permanently delete:\n\n${userToDelete.name} (${userToDelete.email})\n\nThis action cannot be undone.`
                    : ''
                }
                confirmText={isDeleting ? 'Deleting…' : 'Delete User'}
                type="danger"
                disabled={isDeleting}
            />

            {/* Bulk Role Change */}
            <BulkRoleModal
                isOpen={showBulkRole}
                onClose={() => setShowBulkRole(false)}
                selectedCount={selectedIds.length}
                onConfirm={handleBulkRoleChange}
            />

            {/* Bulk Reset Password */}
            <BulkResetPasswordModal
                isOpen={showBulkResetPw}
                onClose={() => setShowBulkResetPw(false)}
                selectedCount={selectedIds.length}
                onConfirm={handleBulkResetPw}
            />

            {/* Bulk Status Change Confirm */}
            <ConfirmModal
                isOpen={!!bulkActionConfirm}
                onClose={() => setBulkActionConfirm(null)}
                onConfirm={() => handleBulkStatus(bulkActionConfirm.actionType)}
                disabled={isBulkLoading}
                title={bulkActionConfirm?.actionType === 'active' ? 'Activate Users?' : 'Deactivate Users?'}
                message={`Are you sure you want to ${bulkActionConfirm?.actionType === 'active' ? 'activate' : 'deactivate'} ${bulkActionConfirm?.count} selected users?\n\nThis will instantly update their access permissions.`}
                confirmText={isBulkLoading ? 'Processing…' : (bulkActionConfirm?.actionType === 'active' ? 'Activate Now' : 'Deactivate Now')}
                type={bulkActionConfirm?.actionType === 'active' ? 'primary' : 'warning'}
            />

            {/* Bulk Delete */}
            <BulkDeleteModal
                isOpen={showBulkDelete}
                onClose={() => {
                    setShowBulkDelete(false);
                    setBulkDeleteConfirmation('');
                }}
                selectedUsers={users.filter(u => selectedIds.includes(u._id))}
                onConfirm={handleBulkDelete}
                confirmText={bulkDeleteConfirmation}
                setConfirmText={setBulkDeleteConfirmation}
                loading={isBulkLoading}
            />

            {/* Bulk Block Change */}
            <BulkBlockModal
                isOpen={showBulkBlock}
                onClose={() => setShowBulkBlock(false)}
                selectedCount={selectedIds.length}
                onConfirm={handleBulkBlockChange}
                blocks={blocks}
            />
        </div>
    );
}
