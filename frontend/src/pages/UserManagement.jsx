import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Users, Search, Trash2, Edit2, Mail, MapPin } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';

const ROLES = ['student', 'warden', 'admin', 'dean', 'principal'];

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const { addToast } = useToast();
    const { user: currentUser } = useContext(AuthContext);
    const [userToDelete, setUserToDelete] = useState(null);

    const canDelete = currentUser?.role === 'admin';
    const canEditRole = currentUser?.role === 'admin';

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/admin/users');
            // Support both formats during migration
            setUsers(res.data.data || res.data.users || []);
        } catch (err) {
            addToast('Failed to fetch users', 'error');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        if (!canEditRole) return;
        try {
            const res = await api.patch(`/api/admin/users/${userId}/role`, { role: newRole });

            if (res.data.success) {
                addToast('User role updated successfully');
                const updatedUser = res.data.data || res.data.user;

                // Safe update using backend response if available, or manual update
                if (updatedUser) {
                    setUsers(users.map(u => u._id === userId ? updatedUser : u));
                } else {
                    setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
                }
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to update role', 'error');
        }
    };

    const confirmDelete = (user) => {
        setUserToDelete(user);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        try {
            const res = await api.delete(`/api/admin/users/${userToDelete._id}`);
            if (res.data.success) {
                addToast('User deleted successfully');
                setUsers(users.filter(u => u._id !== userToDelete._id));
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to delete user', 'error');
        } finally {
            setUserToDelete(null);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchRole = roleFilter === 'All' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 style={{ color: 'var(--text-primary)' }}>User Management</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Manage system users, roles, and permissions
                </p>
            </div>

            {/* Filters */}
            <Card>
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            className="input pl-10"
                            placeholder="Search users..."
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
                            {ROLES.map(role => (
                                <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Users Table */}
            <Card>
                {loading ? (
                    <div className="py-8 text-center text-slate-500">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                    <EmptyState title="No Users Found" description="Try adjusting your search or filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Block</th>
                                    <th>Status</th>
                                    {(canDelete) && <th className="text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user._id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                                    {user.avatar ? <img src={user.avatar} className="h-full w-full object-cover" /> : <Users size={16} />}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{user.name}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <select
                                                className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                                style={{ color: 'var(--text-primary)' }}
                                                disabled={!canEditRole || user._id === currentUser?._id}
                                            >
                                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </td>
                                        <td className="text-slate-500 text-sm">
                                            {user.block?.name || '-'}
                                        </td>
                                        <td>
                                            <Badge variant="success">Active</Badge>
                                        </td>
                                        {(canDelete) && (
                                            <td className="text-right">
                                                {user._id !== currentUser?._id && (
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => confirmDelete(user)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <ConfirmModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={handleDelete}
                title="Delete User"
                message={userToDelete ? `Are you sure you want to delete ${userToDelete.name} (${userToDelete.email})? This action cannot be undone.` : ''}
            />
        </div>
    );
}
