/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useContext } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'
import { AuthContext } from '../context/AuthContext'
import { ROLES } from '../utils/roles'

export default function AdminDashboard() {
    const { user: currentUser } = useContext(AuthContext)
    const [users, setUsers] = useState([])
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [usersRes, summaryRes] = await Promise.all([
                api.get('/api/admin/users'),
                api.get('/api/admin/usage/summary')
            ])

            setUsers(Array.isArray(usersRes) ? usersRes : [])
            setSummary(summaryRes)
        } catch (err) {
            setError('Failed to load admin data')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (currentUser.role !== ROLES.ADMIN) return alert('Only Admins can delete users');
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
        try {
            await api.del(`/api/admin/users/${id}`)
            setUsers(prev => prev.filter(u => u._id !== id))
        } catch (err) {
            alert(err.message || 'Failed to delete user')
        }
    }

    const handleChangeRole = async (id, newRole) => {
        if (currentUser.role !== ROLES.ADMIN) return alert('Only Admins can change roles');
        if (!window.confirm(`Are you sure you want to change role to ${newRole.toUpperCase()}?`)) return
        try {
            const updatedUser = await api.patch(`/api/admin/users/${id}/role`, { role: newRole })
            setUsers(prev => prev.map(u => u._id === id ? updatedUser : u))
        } catch (err) {
            alert(err.message || 'Failed to change role')
        }
    }

    if (loading) return <Loading />
    if (error) return (
        <div className="container" style={{ padding: 40, textAlign: 'center' }}>
            <div className="alert-danger" style={{ padding: 20, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
                {error}
            </div>
        </div>
    )

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header" style={{ marginBottom: 32 }}>
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="text-muted">Manage system users and view platform statistics</p>
            </div>

            {/* System Overview - Visible to all Management Roles */}
            <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 16, fontWeight: 600 }}>System Overview</h2>
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                    <div className="card stat-card">
                        <div className="stat-value">{summary?.totalUsers || 0}</div>
                        <div className="stat-label">Total Users</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-value">{summary?.totalUsage || 0}</div>
                        <div className="stat-label">Usage Records</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-value">{summary?.totalAlerts || 0}</div>
                        <div className="stat-label">Total Alerts</div>
                    </div>
                </div>
            </section>

            {/* User Management - Table visible to all, Actions restricted */}
            <section className="card" style={{ overflow: 'hidden' }}>
                <div className="card-header" style={{ padding: 24, paddingBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>User Management</h2>
                </div>
                <div className="table-responsive">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Name</th>
                                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Email</th>
                                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Role</th>
                                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '0.875rem', color: '#6b7280' }}>Joined</th>
                                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '0.875rem', color: '#6b7280' }}>
                                    {currentUser.role === ROLES.ADMIN ? 'Actions' : 'Status'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ fontWeight: 500 }}>{user.name}</div>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{user.email}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN].includes(user.role) ? '#dbeafe' : '#f3f4f6',
                                                color: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN].includes(user.role) ? '#1e40af' : '#374151'
                                            }}
                                        >
                                            {user.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        {currentUser.role === ROLES.ADMIN ? (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                <button
                                                    className="btn-text"
                                                    onClick={() => {
                                                        const roles = Object.values(ROLES);
                                                        const nextIndex = (roles.indexOf(user.role) + 1) % roles.length;
                                                        const newRole = roles[nextIndex];
                                                        handleChangeRole(user._id, newRole);
                                                    }}
                                                    style={{ fontSize: '0.875rem', color: '#4f46e5', fontWeight: 500, marginRight: 12, background: 'none', border: 'none', cursor: 'pointer' }}
                                                    title="Cycle Role"
                                                >
                                                    Change Role
                                                </button>
                                                <button
                                                    className="btn-text"
                                                    onClick={() => handleDelete(user._id)}
                                                    style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Read Only</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No users found</div>}
                </div>
            </section>
        </div>
    )
}
