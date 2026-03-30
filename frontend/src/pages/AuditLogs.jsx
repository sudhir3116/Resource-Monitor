import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import {
    Search,
    Filter,
    RefreshCw,
    Shield,
    Settings,
    Trash2,
    LogIn,
    LogOut,
    FileText,
    AlertTriangle,
    Database
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { logger } from '../utils/logger';
import useSortableTable from '../hooks/useSortableTable';
import SortIcon from '../components/common/SortIcon';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: '',
        resourceType: '',
        limit: 50
    });

    const actions = [
        'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT',
        'RESOLVE_ALERT', 'REVIEW_ALERT', 'ESCALATE_ALERT',
        'ADD_COMMENT', 'DISMISS_ALERT', 'UPDATE_THRESHOLD',
        'RESOLVE_COMPLAINT', 'ESCALATE_COMPLAINT', 'COMMENT_COMPLAINT',
        'COMPLAINT_SLA_BREACH',
        'BULK_DELETE', 'BULK_UPDATE'
    ];
    const resources = ['Usage', 'User', 'Block', 'Alert', 'SystemConfig', 'Auth', 'Complaint'];

    useEffect(() => {
        fetchLogs();
    }, [filters]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.action) params.append('action', filters.action);
            if (filters.resourceType) params.append('resourceType', filters.resourceType);
            params.append('limit', filters.limit);

            const res = await api.get(`/api/audit-logs?${params}`);
            setLogs(res.data.logs || []);
        } catch (err) {
            logger.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    const { sortedData: finalLogs, sortField, sortDirection, handleSort } = useSortableTable(
        logs,
        'createdAt',
        [filters]
    );

    const getActionIcon = (action) => {
        switch (action) {
            case 'CREATE': return <Database size={16} className="text-green-500" />;
            case 'UPDATE': return <Settings size={16} className="text-blue-500" />;
            case 'DELETE': return <Trash2 size={16} className="text-red-500" />;
            case 'LOGIN': return <LogIn size={16} className="text-amber-500" />;
            case 'LOGOUT': return <LogOut size={16} className="text-slate-500" />;
            case 'RESOLVE_ALERT': return <Shield size={16} className="text-purple-500" />;
            default: return <FileText size={16} className="text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>System Audit Logs</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Track system activities and security events
                    </p>
                </div>
                <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
                    <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Action Type</label>
                        <select
                            className="input"
                            value={filters.action}
                            onChange={e => setFilters({ ...filters, action: e.target.value })}
                        >
                            <option value="">All Actions</option>
                            {actions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Resource Type</label>
                        <select
                            className="input"
                            value={filters.resourceType}
                            onChange={e => setFilters({ ...filters, resourceType: e.target.value })}
                        >
                            <option value="">All Resources</option>
                            {resources.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Records Limit</label>
                        <select
                            className="input"
                            value={filters.limit}
                            onChange={e => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                        >
                            <option value="25">25 Records</option>
                            <option value="50">50 Records</option>
                            <option value="100">100 Records</option>
                            <option value="500">500 Records</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Logs Table */}
            <Card>
                {loading && logs.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">Loading logs...</div>
                ) : logs.length === 0 ? (
                    <EmptyState title="No Logs Found" description="Try adjusting your filters." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('action')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'action' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Action <SortIcon field="action" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('userId.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'userId.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        User <SortIcon field="userId.name" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('resourceType')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'resourceType' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Resource <SortIcon field="resourceType" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('description')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'description' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Description <SortIcon field="description" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                    <th onClick={() => handleSort('createdAt')} className={`text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'createdAt' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                        Time <SortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalLogs.map(log => (
                                    <tr key={log._id}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                {getActionIcon(log.action)}
                                                <span className="font-medium text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {log.action}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">
                                                    {log.userId?.name || 'System'}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {log.userId?.email || 'N/A'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-sm">
                                            {log.resourceType}
                                            {log.resourceId && (
                                                <span className="text-xs text-slate-400 block font-mono">
                                                    {log.resourceId.slice(-6)}...
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                            {log.description}
                                        </td>
                                        <td className="text-right text-sm text-slate-500">
                                            <div>
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
