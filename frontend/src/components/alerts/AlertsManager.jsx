import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import Loading from '../Loading';

export default function AlertsManager() {
    const { user } = useContext(AuthContext);
    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');

    // Resolution modal
    const [resolvingAlert, setResolvingAlert] = useState(null);
    const [resolutionComment, setResolutionComment] = useState('');
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        fetchAlerts();
    }, [statusFilter, severityFilter]);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (severityFilter) params.append('severity', severityFilter);

            const response = await api.get(`/api/alerts?${params.toString()}`);

            setAlerts(response.data.alerts || []);
            setStats(response.data.stats || {});
        } catch (err) {
            console.error('Fetch alerts error:', err);
            setError(err.response?.data?.error || 'Failed to load alerts');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (alertId) => {
        try {
            const response = await api.put(`/api/alerts/${alertId}/review`);

            // Update alert in list
            setAlerts(alerts.map(a =>
                a._id === alertId ? response.data.alert : a
            ));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to review alert');
        }
    };

    const handleResolveClick = (alert) => {
        setResolvingAlert(alert);
        setResolutionComment('');
    };

    const handleResolveSubmit = async () => {
        if (!resolutionComment.trim()) {
            alert('Please enter a resolution comment');
            return;
        }

        try {
            setResolving(true);
            const response = await api.put(`/api/alerts/${resolvingAlert._id}/resolve`, {
                comment: resolutionComment
            });

            // Update alert in list
            setAlerts(alerts.map(a =>
                a._id === resolvingAlert._id ? response.data.alert : a
            ));

            setResolvingAlert(null);
            setResolutionComment('');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to resolve alert');
        } finally {
            setResolving(false);
        }
    };

    const handleDismiss = async (alertId) => {
        if (!confirm('Are you sure you want to dismiss this alert?')) return;

        try {
            await api.put(`/api/alerts/${alertId}/dismiss`);

            // Update alert in list
            setAlerts(alerts.map(a =>
                a._id === alertId ? { ...a, status: 'Dismissed' } : a
            ));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to dismiss alert');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Critical': return '#991b1b';
            case 'High': return '#ef4444';
            case 'Medium': return '#f59e0b';
            case 'Low': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending': return '#f59e0b';
            case 'Reviewed': return '#3b82f6';
            case 'Resolved': return '#10b981';
            case 'Dismissed': return '#6b7280';
            default: return '#6b7280';
        }
    };

    if (loading && alerts.length === 0) return <Loading />;

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 className="page-title">Alerts Management</h1>
                <p className="text-muted">
                    Monitor, review, and resolve resource usage alerts
                </p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 16,
                    marginBottom: 24
                }}>
                    <div className="card">
                        <div className="card-body">
                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 8 }}>Total Alerts</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total || 0}</div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body">
                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 8 }}>Pending</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{stats.pending || 0}</div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body">
                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 8 }}>Reviewed</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>{stats.reviewed || 0}</div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body">
                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 8 }}>Resolved</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>{stats.resolved || 0}</div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body">
                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 8 }}>High Priority</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{stats.high || 0}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label className="form-label">Status</label>
                            <select
                                className="form-input"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Reviewed">Reviewed</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Dismissed">Dismissed</option>
                            </select>
                        </div>

                        <div style={{ flex: '1 1 200px' }}>
                            <label className="form-label">Severity</label>
                            <select
                                className="form-input"
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value)}
                            >
                                <option value="">All Severities</option>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>

                        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            <button
                                onClick={() => {
                                    setStatusFilter('');
                                    setSeverityFilter('');
                                }}
                                className="btn btn-outline"
                            >
                                Clear Filters
                            </button>
                            <button
                                onClick={fetchAlerts}
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts List */}
            {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

            {alerts.length === 0 ? (
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <p>No alerts found</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ displaydisplay: 'flex', flexDirection: 'column', gap: 16 }}>
                    {alerts.map(alert => (
                        <div key={alert._id} className="card">
                            <div className="card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                            <span
                                                className="badge"
                                                style={{ backgroundColor: getSeverityColor(alert.severity), color: '#fff' }}
                                            >
                                                {alert.severity}
                                            </span>
                                            <span
                                                className="badge"
                                                style={{ backgroundColor: `${getStatusColor(alert.status)}20`, color: getStatusColor(alert.status), border: `1px solid ${getStatusColor(alert.status)}` }}
                                            >
                                                {alert.status}
                                            </span>
                                            <span className="badge badge-outline">
                                                {alert.resourceType}
                                            </span>
                                            {alert.block && (
                                                <span className="badge badge-secondary">
                                                    {alert.block.name}
                                                </span>
                                            )}
                                        </div>

                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600 }}>
                                            {alert.message}
                                        </h4>

                                        {alert.amount && alert.threshold && (
                                            <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: 'var(--muted)' }}>
                                                Usage: {alert.amount.toLocaleString()} / Threshold: {alert.threshold.toLocaleString()}
                                            </p>
                                        )}

                                        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                                            Created {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                        </p>

                                        {/* Resolution Info */}
                                        {alert.status === 'Resolved' && alert.resolvedBy && (
                                            <div style={{
                                                marginTop: 12,
                                                paddingTop: 12,
                                                borderTop: '1px solid var(--border)',
                                                fontSize: '0.875rem'
                                            }}>
                                                <strong>Resolved by:</strong> {alert.resolvedBy.name}<br />
                                                <strong>Comment:</strong> {alert.resolutionComment}<br />
                                                <span className="text-muted">
                                                    {formatDistanceToNow(new Date(alert.resolvedAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                        )}

                                        {alert.status === 'Reviewed' && alert.reviewedBy && (
                                            <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--muted)' }}>
                                                Reviewed by {alert.reviewedBy.name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {alert.status === 'Pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleReview(alert._id)}
                                                    className="btn btn-sm btn-outline"
                                                >
                                                    Mark Reviewed
                                                </button>
                                                <button
                                                    onClick={() => handleResolveClick(alert)}
                                                    className="btn btn-sm btn-primary"
                                                >
                                                    Resolve
                                                </button>
                                                {(user?.role === 'admin' || user?.role === 'warden') && (
                                                    <button
                                                        onClick={() => handleDismiss(alert._id)}
                                                        className="btn btn-sm btn-ghost"
                                                    >
                                                        Dismiss
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {alert.status === 'Reviewed' && (
                                            <button
                                                onClick={() => handleResolveClick(alert)}
                                                className="btn btn-sm btn-primary"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Resolution Modal */}
            {resolvingAlert && (
                <div className="modal-overlay" onClick={() => setResolvingAlert(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h3>Resolve Alert</h3>
                            <button onClick={() => setResolvingAlert(null)} className="btn btn-ghost">×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--muted)' }}>
                                {resolvingAlert.message}
                            </p>
                            <label className="form-label">Resolution Comment *</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                value={resolutionComment}
                                onChange={(e) => setResolutionComment(e.target.value)}
                                placeholder="Describe how this alert was resolved..."
                                disabled={resolving}
                            />
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={() => setResolvingAlert(null)}
                                className="btn btn-outline"
                                disabled={resolving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolveSubmit}
                                className="btn btn-primary"
                                disabled={resolving || !resolutionComment.trim()}
                            >
                                {resolving ? 'Resolving...' : 'Resolve Alert'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
