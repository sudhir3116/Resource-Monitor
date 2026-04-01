import React, { useEffect, useState, useContext, useCallback } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { AlertCountContext } from '../context/AlertCountContext';
import { ROLES } from '../utils/roles';
import { useToast } from '../context/ToastContext';
import { getSocket } from '../utils/socket';
import timeAgo from '../utils/timeAgo';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import {
    AlertCircle, AlertTriangle, Info, CheckCircle,
    Search, RefreshCw, Eye,
    XCircle, MapPin, Activity, TrendingUp, RotateCcw
} from 'lucide-react';
import { useResources } from '../hooks/useResources';

const SEVERITY_CONFIG = {
    critical: { label: 'Critical', badgeVariant: 'danger', icon: <AlertCircle size={16} className="text-red-500" />, border: 'border-l-red-500' },
    high: { label: 'High', badgeVariant: 'warning', icon: <AlertTriangle size={16} className="text-orange-500" />, border: 'border-l-orange-500' },
    medium: { label: 'Medium', badgeVariant: 'warning', icon: <AlertTriangle size={16} className="text-amber-500" />, border: 'border-l-amber-400' },
    low: { label: 'Low', badgeVariant: 'primary', icon: <Info size={16} className="text-blue-500" />, border: 'border-l-blue-400' },
};

const STATUS_BADGE = {
    Pending: 'warning',
    Investigating: 'primary',
    Reviewed: 'primary',
    Resolved: 'success',
    Dismissed: 'default',
    Active: 'warning',
};

function getSeverityKey(severity) {
    return severity?.toLowerCase() || 'medium';
}

export default function Alerts() {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();
    const alertCountCtx = useContext(AlertCountContext);
    const refreshCounts = alertCountCtx?.refreshCounts || (() => { });

    const { resources } = useResources();
    const getResIcon = (type) => {
        const res = (resources || []).find(r => r.name === type);
        if (!res?.icon) return <Activity size={14} />;
        if (typeof res.icon === 'string' && res.icon.length < 5) return <span>{res.icon}</span>;
        return <Activity size={14} />;
    };

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [blockFilter, setBlockFilter] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [actioning, setActioning] = useState(new Set()); // ids being processed
    const [selectedAlertIds, setSelectedAlertIds] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);

    const isStudent = user?.role === 'student';
    const isWarden = user?.role === 'warden';
    const isAdmin = user?.role === 'admin';
    const isDean = user?.role === 'dean';
    const isPrincipal = user?.role === 'principal';
    const isGM = user?.role === 'gm';
    // Wardens can investigate (flag for review) but cannot close alerts.
    const isExecutive = isAdmin || isDean || isPrincipal || isGM;
    const canModifyAlerts = isAdmin || isGM;

    const canResolve = canModifyAlerts;
    const canDismiss = canModifyAlerts;
    const canEscalate = canModifyAlerts;
    const canReopen = canModifyAlerts;
    const canInvestigate = isWarden || canModifyAlerts;
    // Dean/Principal are read-only in alert lifecycle actions.
    const canAcknowledge = canModifyAlerts;

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (blockFilter) params.set('blockId', blockFilter);
            const response = await api.get(`/api/alerts?${params.toString()}`);
            setAlerts(response.data.alerts || []);
        } catch (err) {
            if (err.message?.includes('403')) {
                addToast('You do not have permission to view alerts', 'error');
            } else {
                addToast('Failed to load alerts', 'error');
            }
        } finally {
            setLoading(false);
        }
    }, [blockFilter]);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    useEffect(() => {
        if (isExecutive) {
            api.get('/api/admin/blocks').then(r => setBlocks(r.data.data || [])).catch(() => { });
        }
    }, [isExecutive]);

    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            socket.on('alert:new', fetchAlerts);
            socket.on('alert:updated', fetchAlerts);
            socket.on('alerts:refresh', fetchAlerts);
        }

        return () => {
            if (socket) {
                socket.off('alert:new', fetchAlerts);
                socket.off('alert:updated', fetchAlerts);
                socket.off('alerts:refresh', fetchAlerts);
            }
        };
    }, [fetchAlerts]);

    const setActioning_ = (id, val) => {
        setActioning(prev => {
            const next = new Set(prev);
            val ? next.add(id) : next.delete(id);
            return next;
        });
    };

    const handleInvestigate = async (alertId) => {
        setActioning_(alertId, true);
        try {
            await api.put(`/api/alerts/${alertId}/investigate`);
            refreshCounts();
            addToast('Alert marked as Investigating', 'success');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'Investigating' } : a));
        } catch (err) {
            addToast(err.message || 'Failed to update alert', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    const handleAcknowledge = async (alertId) => {
        setActioning_(alertId, true);
        try {
            refreshCounts();
            await api.put(`/api/alerts/${alertId}/acknowledge`);
            addToast('Alert acknowledged', 'success');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, isRead: true } : a));
        } catch (err) {
            addToast(err.message || 'Failed to acknowledge', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    const handleReview = async (alertId) => {
        setActioning_(alertId, true);
        try {
            await api.put(`/api/alerts/${alertId}/review`);
            refreshCounts(); // after API call completes
            addToast('Alert marked as Reviewed', 'success');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'Reviewed', isRead: true } : a));
        } catch (err) {
            addToast(err.message || 'Failed to update alert', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    const handleResolve = async (alertId) => {
        setActioning_(alertId, true);
        try {
            await api.put(`/api/alerts/${alertId}/resolve`, { comment: 'Resolved via dashboard' });
            refreshCounts(); // after API call completes
            addToast('Alert resolved', 'success');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'Resolved', isRead: true } : a));
        } catch (err) {
            addToast(err.message || 'Failed to resolve alert', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    const handleDismiss = async (alertId) => {
        setActioning_(alertId, true);
        try {
            await api.put(`/api/alerts/${alertId}/dismiss`);
            addToast('Alert dismissed', 'success');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'Dismissed' } : a));
        } catch (err) {
            addToast(err.message || 'Failed to dismiss', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    const handleEscalate = async (alertId) => {
        setActioning_(alertId, true);
        try {
            await api.put(`/api/alerts/${alertId}/escalate`);
            refreshCounts();
            addToast('Alert escalated', 'warning');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'Escalated' } : a));
        } catch (err) {
            addToast(err.message || 'Failed to escalate', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    const handleReopen = async (alertId) => {
        setActioning_(alertId, true);
        try {
            await api.put(`/api/alerts/${alertId}/reopen`);
            refreshCounts();
            addToast('Alert reopened', 'success');
            setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, status: 'Active', isRead: false } : a));
        } catch (err) {
            addToast(err.message || 'Failed to reopen alert', 'error');
        } finally {
            setActioning_(alertId, false);
        }
    };

    // Derived filter — include all non-terminal statuses
    // 'Active' is the DB value (ALERT_STATUS.PENDING is aliased to 'Active')
    const activeStatuses = ['Active', 'Investigating', 'Escalated'];
    const filteredAlerts = alerts.filter(a => {
        if (filter === 'active' && !activeStatuses.includes(a.status)) return false;
        if (filter === 'reviewed' && a.status !== 'Reviewed') return false;
        if (filter === 'resolved' && a.status !== 'Resolved' && a.status !== 'Dismissed') return false;
        if (severityFilter !== 'all' && getSeverityKey(a.severity) !== severityFilter) return false;
        if (searchQuery && !a.message?.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !a.resourceType?.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !a.block?.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // Counts — 'Active' is what the DB stores (not 'Pending')
    const pendingCount = alerts.filter(a => a.status === 'Active').length;
    const investigatingCnt = alerts.filter(a => a.status === 'Investigating').length;
    const escalatedCnt = alerts.filter(a => a.status === 'Escalated').length;
    const criticalCount = alerts.filter(a => getSeverityKey(a.severity) === 'critical').length;
    const resolvedCount = alerts.filter(a => a.status === 'Resolved').length;
    const activeTotal = pendingCount + investigatingCnt + escalatedCnt;

    const selectedAlerts = alerts.filter(a => selectedAlertIds.includes(a._id));
    const allVisibleSelected = filteredAlerts.length > 0 && filteredAlerts.every(a => selectedAlertIds.includes(a._id));

    const toggleSelected = (id) => {
        setSelectedAlertIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const setSelectedForVisible = (checked) => {
        if (!checked) {
            setSelectedAlertIds([]);
            return;
        }
        setSelectedAlertIds(filteredAlerts.map(a => a._id));
    };

    const bulkUpdate = async (kind) => {
        if (bulkBusy) return;
        const currentlySelected = selectedAlerts;
        if (!currentlySelected.length) return;

        setBulkBusy(true);
        try {
            const ids = currentlySelected
                .filter(a => {
                    if (kind === 'investigate') return a.status !== 'Investigating' && !['Resolved', 'Dismissed'].includes(a.status);
                    if (kind === 'resolve') return a.status !== 'Resolved' && a.status !== 'Dismissed';
                    if (kind === 'dismiss') return a.status !== 'Resolved' && a.status !== 'Dismissed';
                    if (kind === 'escalate') return a.status !== 'Resolved' && a.status !== 'Escalated';
                    if (kind === 'reopen') return ['Resolved', 'Dismissed'].includes(a.status);
                    return false;
                })
                .map(a => a._id);

            if (!ids.length) {
                addToast('No selected alerts eligible for this action', 'info');
                return;
            }

            const requests = ids.map(id => {
                switch (kind) {
                    case 'investigate':
                        return api.put(`/api/alerts/${id}/investigate`);
                    case 'resolve':
                        return api.put(`/api/alerts/${id}/resolve`, { comment: 'Resolved via bulk action' });
                    case 'dismiss':
                        return api.put(`/api/alerts/${id}/dismiss`);
                    case 'escalate':
                        return api.put(`/api/alerts/${id}/escalate`);
                    case 'reopen':
                        return api.put(`/api/alerts/${id}/reopen`);
                    default:
                        return Promise.resolve();
                }
            });

            await Promise.allSettled(requests);
            refreshCounts();
            await fetchAlerts();
            setSelectedAlertIds([]);
            addToast('Bulk update completed', 'success');
        } catch (err) {
            addToast(err.message || 'Bulk update failed', 'error');
        } finally {
            setBulkBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-hover)', width: 220 }} />
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-28 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div />

                <button
                    onClick={fetchAlerts}
                    className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                    title="Refresh Data"
                >
                    <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                </button>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard label="Active" value={activeTotal} icon={<AlertTriangle size={18} />} color="amber" />
                <KPICard label="Investigating" value={investigatingCnt} icon={<Search size={18} />} color="blue" />
                <KPICard label="Critical" value={criticalCount} icon={<AlertCircle size={18} />} color="red" />
                <KPICard label="Resolved" value={resolvedCount} icon={<CheckCircle size={18} />} color="green" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Status tabs */}
                <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {[
                        { key: 'all', label: `All (${alerts.length})` },
                        { key: 'active', label: `Active (${alerts.filter(a => activeStatuses.includes(a.status)).length})` },
                        { key: 'reviewed', label: `Reviewed` },
                        { key: 'resolved', label: `Resolved` },
                    ].map(tab => (
                        <button key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                            style={{
                                backgroundColor: filter === tab.key ? 'var(--bg-card)' : 'transparent',
                                color: filter === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                boxShadow: filter === tab.key ? 'var(--shadow)' : 'none'
                            }}
                        >{tab.label}</button>
                    ))}
                </div>

                {/* Severity filter */}
                <select
                    className="input text-sm py-1.5 px-3"
                    style={{ width: 150 }}
                    value={severityFilter}
                    onChange={e => setSeverityFilter(e.target.value)}
                >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>

                {/* Block filter for Dean / Principal / Admin / General Manager */}
                {isExecutive && (
                    <select
                        className="input text-sm py-1.5 px-3"
                        style={{ width: 160 }}
                        value={blockFilter}
                        onChange={e => setBlockFilter(e.target.value)}
                    >
                        <option value="">All Blocks</option>
                        {blocks.map(b => (
                            <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                    </select>
                )}

                {/* Search */}
                <div className="relative flex-1" style={{ minWidth: 200 }}>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        className="input text-sm pl-9 py-1.5 w-full"
                        placeholder="Search alerts…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Alerts List */}
            {filteredAlerts.length === 0 ? (
                <EmptyState
                    icon={<AlertTriangle size={32} />}
                    title="No alerts found"
                    description="No alerts match the current filters."
                />
            ) : (isAdmin || isGM) ? (
                <div className="space-y-3">
                    {isAdmin && selectedAlertIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-blue-900/30 border border-blue-600/40 rounded-xl">
                            <span className="text-sm font-medium text-blue-300">
                                {selectedAlertIds.length} selected
                            </span>
                            <button
                                onClick={() => setSelectedAlertIds([])}
                                className="text-xs text-gray-300 hover:text-white"
                                type="button"
                            >
                                Clear
                            </button>

                            <div className="ml-auto flex flex-wrap gap-2">
                                {canInvestigate && (
                                    <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulkUpdate('investigate')}>
                                        {bulkBusy ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Search size={14} className="mr-2" />}
                                        Investigate
                                    </Button>
                                )}
                                {canResolve && (
                                    <Button size="sm" variant="primary" disabled={bulkBusy} onClick={() => bulkUpdate('resolve')}>
                                        {bulkBusy ? <RefreshCw size={14} className="animate-spin mr-2" /> : <CheckCircle size={14} className="mr-2" />}
                                        Resolve
                                    </Button>
                                )}
                                {canDismiss && (
                                    <Button size="sm" variant="danger" disabled={bulkBusy} onClick={() => bulkUpdate('dismiss')}>
                                        {bulkBusy ? <RefreshCw size={14} className="animate-spin mr-2" /> : <XCircle size={14} className="mr-2" />}
                                        Dismiss
                                    </Button>
                                )}
                                {canEscalate && (
                                    <Button size="sm" variant="warning" disabled={bulkBusy} onClick={() => bulkUpdate('escalate')}>
                                        {bulkBusy ? <RefreshCw size={14} className="animate-spin mr-2" /> : <TrendingUp size={14} className="mr-2" />}
                                        Escalate
                                    </Button>
                                )}
                                {canReopen && (
                                    <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulkUpdate('reopen')}>
                                        {bulkBusy ? <RefreshCw size={14} className="animate-spin mr-2" /> : <RotateCcw size={14} className="mr-2" />}
                                        Reopen
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th className="w-10">
                                        <input
                                            type="checkbox"
                                            checked={allVisibleSelected}
                                            disabled={!isAdmin}
                                            className={!isAdmin ? 'opacity-0 pointer-events-none' : ''}
                                            onChange={(e) => isAdmin && setSelectedForVisible(e.target.checked)}
                                            style={{ width: '16px', height: '16px', minWidth: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                                        />
                                    </th>
                                    <th>Severity</th>
                                    <th>Resource</th>
                                    <th>Block</th>
                                    <th>Message</th>
                                    <th>Status</th>
                                    <th className="pr-6">Time</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAlerts.map(alert => {
                                    const sevKey = getSeverityKey(alert.severity);
                                    const sevConfig = SEVERITY_CONFIG[sevKey] || SEVERITY_CONFIG.medium;
                                    const isActioning = actioning.has(alert._id);
                                    const isResolved = alert.status === 'Resolved' || alert.status === 'Dismissed';
                                    const checked = selectedAlertIds.includes(alert._id);

                                    return (
                                        <tr key={alert._id} className={checked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={!isAdmin}
                                                    className={!isAdmin ? 'opacity-0 pointer-events-none' : ''}
                                                    onChange={() => isAdmin && toggleSelected(alert._id)}
                                                    style={{ width: '16px', height: '16px', minWidth: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                                                />
                                            </td>
                                            <td>
                                                <Badge variant={sevConfig.badgeVariant}>{sevConfig.label}</Badge>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {getResIcon(alert.resourceType)}
                                                    <span className="font-medium">{alert.resourceType}</span>
                                                </div>
                                            </td>
                                            <td className="text-sm">
                                                {alert.block?.name || '-'}
                                            </td>
                                            <td className="max-w-xs text-sm text-slate-600 dark:text-slate-300 truncate">
                                                {alert.message}
                                            </td>
                                            <td>
                                                <Badge variant={STATUS_BADGE[alert.status] || 'default'}>{alert.status}</Badge>
                                            </td>
                                            <td className="pr-6 text-xs text-slate-500">
                                                {timeAgo(alert.createdAt)}
                                            </td>
                                            <td className="text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Warden/Admin/GM Investigate */}
                                                    {canInvestigate && !isResolved && alert.status !== 'Investigating' && (
                                                        <Button size="sm" variant="secondary" disabled={isActioning} onClick={() => handleInvestigate(alert._id)}>
                                                            {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <Search size={13} className="mr-1" />}
                                                            Investigate
                                                        </Button>
                                                    )}
                                                    {/* Dean/Principal/Admin/GM Acknowledge */}
                                                    {canAcknowledge && !alert.acknowledgedAt && (
                                                        <Button size="sm" variant="secondary" disabled={isActioning} onClick={() => handleAcknowledge(alert._id)}>
                                                            <Eye size={13} className="mr-1" />
                                                            Acknowledge
                                                        </Button>
                                                    )}

                                                    {canResolve && !isResolved && (
                                                        <Button size="sm" variant="primary" disabled={isActioning} onClick={() => handleResolve(alert._id)}>
                                                            {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <CheckCircle size={13} className="mr-1" />}
                                                            Resolve
                                                        </Button>
                                                    )}

                                                    {canDismiss && !isResolved && (
                                                        <Button size="sm" variant="danger" disabled={isActioning} onClick={() => handleDismiss(alert._id)}>
                                                            <XCircle size={13} className="mr-1" />
                                                            Dismiss
                                                        </Button>
                                                    )}

                                                    {canEscalate && !isResolved && alert.status !== 'Escalated' && (
                                                        <Button size="sm" variant="warning" disabled={isActioning} onClick={() => handleEscalate(alert._id)}>
                                                            <TrendingUp size={13} className="mr-1" />
                                                            Escalate
                                                        </Button>
                                                    )}

                                                    {canReopen && (alert.status === 'Resolved' || alert.status === 'Dismissed') && (
                                                        <Button size="sm" variant="secondary" disabled={isActioning} onClick={() => handleReopen(alert._id)}>
                                                            <RotateCcw size={13} className="mr-1" />
                                                            Reopen
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredAlerts.map(alert => {
                        const sevKey = getSeverityKey(alert.severity);
                        const sevConfig = SEVERITY_CONFIG[sevKey] || SEVERITY_CONFIG.medium;
                        const isActioning = actioning.has(alert._id);
                        const isResolved = alert.status === 'Resolved' || alert.status === 'Dismissed';

                        return (
                            <div
                                key={alert._id}
                                className={`rounded-lg border-l-4 p-4 transition-all ${sevConfig.border}`}
                                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderLeftColor: undefined }}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    {/* Left: Identity */}
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="mt-0.5 flex-shrink-0">{sevConfig.icon}</div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <Badge variant={sevConfig.badgeVariant}>{sevConfig.label}</Badge>
                                                <Badge variant={STATUS_BADGE[alert.status] || 'default'}>{alert.status}</Badge>
                                                {!alert.isRead && (
                                                    <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" title="Unread" />
                                                )}
                                            </div>
                                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                                                {alert.message}
                                            </p>
                                            <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="flex items-center gap-1">
                                                    {getResIcon(alert.resourceType)} {alert.resourceType}
                                                </span>
                                                {alert.block?.name && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={12} /> {alert.block.name}
                                                    </span>
                                                )}
                                                {alert.amount != null && (
                                                    <span>Usage: {alert.amount} / Limit: {alert.threshold}</span>
                                                )}
                                                <span>{timeAgo(alert.createdAt)}</span>
                                            </div>
                                            {/* Resolution / investigation info */}
                                            {alert.status === 'Resolved' && alert.resolvedBy && (
                                                <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                                                    ✓ Resolved by {alert.resolvedBy?.name} — {alert.resolutionComment}
                                                </p>
                                            )}
                                            {alert.status === 'Investigating' && alert.investigatedBy && (
                                                <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">
                                                    🔍 Under investigation by {alert.investigatedBy?.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Role-scoped actions */}
                                    {!isStudent && (
                                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                                            {/* Warden / Admin / GM: Investigate (flag alert for review) */}
                                            {canInvestigate && !isResolved && alert.status !== 'Investigating' && (
                                                <Button size="sm" variant="secondary"
                                                    disabled={isActioning}
                                                    onClick={() => handleInvestigate(alert._id)}>
                                                    {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <Search size={13} className="mr-1" />}
                                                    Investigate
                                                </Button>
                                            )}

                                            {/* Dean / Principal / Admin / GM: Acknowledge */}
                                            {canAcknowledge && !alert.acknowledgedAt && (
                                                <Button size="sm" variant="secondary"
                                                    disabled={isActioning}
                                                    onClick={() => handleAcknowledge(alert._id)}>
                                                    <Eye size={13} className="mr-1" />
                                                    Acknowledge
                                                </Button>
                                            )}

                                            {/* Admin / GM ONLY: Resolve — Wardens cannot resolve */}
                                            {canResolve && !isResolved && (
                                                <Button size="sm" variant="primary"
                                                    disabled={isActioning}
                                                    onClick={() => handleResolve(alert._id)}>
                                                    {isActioning ? <RefreshCw size={13} className="animate-spin mr-1" /> : <CheckCircle size={13} className="mr-1" />}
                                                    Resolve
                                                </Button>
                                            )}

                                            {/* Admin / GM ONLY: Dismiss */}
                                            {canDismiss && !isResolved && (
                                                <Button size="sm" variant="danger"
                                                    disabled={isActioning}
                                                    onClick={() => handleDismiss(alert._id)}>
                                                    <XCircle size={13} className="mr-1" />
                                                    Dismiss
                                                </Button>
                                            )}

                                            {/* Admin / GM: Escalate */}
                                            {canEscalate && !isResolved && alert.status !== 'Escalated' && (
                                                <Button size="sm" variant="warning"
                                                    disabled={isActioning}
                                                    onClick={() => handleEscalate(alert._id)}>
                                                    <TrendingUp size={13} className="mr-1" />
                                                    Escalate
                                                </Button>
                                            )}

                                            {/* Admin / GM: Reopen resolved or dismissed alert */}
                                            {canReopen && (alert.status === 'Resolved' || alert.status === 'Dismissed') && (
                                                <Button size="sm" variant="secondary"
                                                    disabled={isActioning}
                                                    onClick={() => handleReopen(alert._id)}>
                                                    <RotateCcw size={13} className="mr-1" />
                                                    Reopen
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function KPICard({ label, value, icon, color }) {
    const colorMap = {
        amber: 'text-amber-500',
        blue: 'text-blue-500',
        red: 'text-red-500',
        green: 'text-green-500',
    };
    return (
        <div className="card flex items-center justify-between">
            <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
            <div className={`${colorMap[color] || 'text-blue-500'} opacity-80`}>{icon}</div>
        </div>
    );
}
