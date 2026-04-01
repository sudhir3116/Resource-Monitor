import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';
import { getSocket } from '../utils/socket';
import {
    Users,
    AlertTriangle,
    Activity,
    Settings,
    UserPlus,
    Shield,
    FileText,
    CheckCircle,
    XCircle,
    Building2,
    MessageSquare,
    Zap,
    Droplets,
    Flame,
    Wind,
    Utensils,
    Trash2,
    RefreshCw,
    Search,
    Sun
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { logger } from '../utils/logger';

import { useResources } from '../hooks/useResources';

const renderResIcon = (resName, resources) => {
    const r = (resources || []).find(rc => rc.name === resName);
    const icon = r?.icon || r?.emoji || '📊';
    const color = r?.color || '#3B82F6';
    if (typeof icon === 'string' && icon.length <= 4) return <span style={{ color }}>{icon}</span>;
    return <Activity size={16} style={{ color }} />;
};

export default function AdminDashboard() {
    const { resources } = useResources();
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalBlocks: 0,
        totalResources: 0,
        activeAlerts: 0,
        unresolvedComplaints: 0,
        recentAlerts: [],
        recentComplaints: []
    });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [
                usersRes,
                blocksRes,
                alertsRes,
                complaintsRes,
                alertCountRes,
                complaintStatsRes
            ] = await Promise.allSettled([
                api.get('/api/admin/users'),
                api.get('/api/admin/blocks'),
                api.get('/api/alerts?limit=5'),
                api.get('/api/complaints?limit=5'),
                api.get('/api/alerts/count'),
                api.get('/api/complaints/stats')
            ]);

            const users = usersRes.status === 'fulfilled'
                ? (usersRes.value.data.data || usersRes.value.data.users || [])
                : [];
            const blocks = blocksRes.status === 'fulfilled'
                ? (blocksRes.value.data.data || blocksRes.value.data.blocks || [])
                : [];

            const recentAlerts = alertsRes.status === 'fulfilled'
                ? (alertsRes.value.data.alerts || [])
                : [];
            const recentComplaints = complaintsRes.status === 'fulfilled'
                ? (complaintsRes.value.data.data || [])
                : [];

            const alertCounts = alertCountRes.status === 'fulfilled'
                ? (alertCountRes.value.data.counts || {})
                : {};

            const activeAlerts =
                Number(alertCounts.pending || 0) +
                Number(alertCounts.investigating || 0) +
                Number(alertCounts.escalated || 0);

            const byStatus = complaintStatsRes.status === 'fulfilled'
                ? (complaintStatsRes.value.data.byStatus || [])
                : [];
            const statusMap = byStatus.reduce((acc, s) => {
                const key = s?._id || s?.status;
                if (!key) return acc;
                acc[key] = Number(s.count || 0);
                return acc;
            }, {});
            const totalComplaints = Number(complaintStatsRes.status === 'fulfilled' ? complaintStatsRes.value.data.total : 0);
            const resolvedComplaints = Number(statusMap.resolved || statusMap.RESOLVED || 0);
            const unresolvedComplaints = Math.max(0, totalComplaints - resolvedComplaints);

            setStats({
                totalUsers: Array.isArray(users) ? users.length : 0,
                totalBlocks: Array.isArray(blocks) ? blocks.length : 0,
                totalResources: Array.isArray(resources) ? resources.length : 0,
                activeAlerts,
                unresolvedComplaints,
                recentAlerts: Array.isArray(recentAlerts) ? recentAlerts : [],
                recentComplaints: Array.isArray(recentComplaints) ? recentComplaints : []
            });
        } catch (err) {
            logger.error('Failed to load Admin Dashboard stats', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const socket = getSocket();
        const refresh = () => fetchData();

        if (socket) {
            socket.on('dashboard:refresh', refresh);
            socket.on('users:refresh', refresh);
            socket.on('alerts:refresh', refresh);
            socket.on('resources:refresh', refresh);
            socket.on('usage:added', refresh);
            socket.on('dashboard:alert_created', refresh);
            socket.on('dashboard:alert_resolved', refresh);
            socket.on('dashboard:complaint_added', refresh);
            socket.on('complaints:refresh', refresh);
        }

        window.addEventListener('usage:added', refresh);

        return () => {
            if (socket) {
                socket.off('dashboard:refresh', refresh);
                socket.off('users:refresh', refresh);
                socket.off('alerts:refresh', refresh);
                socket.off('resources:refresh', refresh);
                socket.off('usage:added', refresh);
                socket.off('dashboard:alert_created', refresh);
                socket.off('dashboard:alert_resolved', refresh);
                socket.off('dashboard:complaint_added', refresh);
                socket.off('complaints:refresh', refresh);
            }
            window.removeEventListener('usage:added', refresh);
        };
    }, [fetchData]);

    const getResourceIcon = (type) => {
        const r = (resources || []).find(res => res.name === type);
        const icon = r?.icon || r?.emoji || '📊';
        const color = r?.color || '#3B82F6';
        if (typeof icon === 'string' && icon.length <= 4) return <span style={{ color }}>{icon}</span>;
        return <Activity size={16} style={{ color }} />;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-48 rounded animate-pulse bg-slate-200 dark:bg-slate-700"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
                <div />
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>
                    <Link to="/admin/users">
                        <Button variant="primary" className="!px-6 !py-2.5">
                            <UserPlus size={18} className="mr-2" /> Manage Users
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                <MetricCard
                    label="Total Users"
                    value={stats.totalUsers}
                    icon={<Users size={22} />}
                    colorClass="text-blue-500"
                />
                <MetricCard
                    label="Total Blocks"
                    value={stats.totalBlocks}
                    icon={<Building2 size={22} />}
                    colorClass="text-indigo-500"
                />
                <MetricCard
                    label="Resources"
                    value={stats.totalResources}
                    icon={<Settings size={22} />}
                    colorClass="text-emerald-500"
                />
                <MetricCard
                    label="Active Alerts"
                    value={stats.activeAlerts}
                    icon={<AlertTriangle size={22} />}
                    colorClass={stats.activeAlerts > 0 ? "text-rose-500" : "text-slate-400"}
                    trend={stats.activeAlerts > 0 ? "negative" : "none"}
                />
                <MetricCard
                    label="Complaints"
                    value={stats.unresolvedComplaints}
                    icon={<MessageSquare size={22} />}
                    colorClass="text-amber-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <Card title="Latest System Alerts" action={<Link to="/alerts" className="text-xs font-bold text-blue-500 hover:scale-105 transition-transform uppercase tracking-wider">View All</Link>} className="!p-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th className="!pl-6">Resource</th>
                                        <th>Block</th>
                                        <th>Severity</th>
                                        <th>Status</th>
                                        <th className="!pr-6">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentAlerts.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-12 text-slate-500 font-medium">✨ All systems normal. No active alerts.</td></tr>
                                    ) : (
                                        stats.recentAlerts.map(alert => (
                                            <tr key={alert._id}>
                                                <td className="!pl-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted flex-shrink-0">
                                                            {renderResIcon(alert.resourceType, resources)}
                                                        </div>
                                                        <span className="font-bold text-primary">{alert.resource || alert.resourceType}</span>
                                                    </div>
                                                </td>
                                                <td className="font-medium text-secondary">{alert.block?.name || alert.block || '-'}</td>
                                                <td>
                                                    {(() => {
                                                        const sev = String(alert.severity || '').toUpperCase();
                                                        const variant = (sev === 'CRITICAL' || sev === 'SEVERE') ? 'danger'
                                                            : (sev === 'HIGH') ? 'warning'
                                                                : 'secondary';
                                                        return <Badge variant={variant}>{alert.severity}</Badge>;
                                                    })()}
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const st = String(alert.status || '').toUpperCase();
                                                        const variant = st === 'RESOLVED' ? 'success'
                                                            : (st === 'DISMISSED') ? 'default'
                                                                : (st === 'ESCALATED') ? 'warning'
                                                                    : 'warning';
                                                        return <Badge variant={variant}>{alert.status}</Badge>;
                                                    })()}
                                                </td>
                                                <td className="!pr-6 text-xs text-slate-400 font-bold tabular-nums">
                                                    {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card title="Recent Complaints" action={<Link to="/complaints" className="text-xs font-bold text-blue-500 hover:scale-105 transition-transform uppercase tracking-wider">View All</Link>} className="shadow-sm hover:shadow-md transition-shadow">
                        <div className="space-y-3 mt-4">
                            {stats.recentComplaints.length === 0 ? (
                                <p className="text-center py-12 text-slate-500 font-medium italic">No pending complaints records found.</p>
                            ) : (
                                stats.recentComplaints.map(complaint => (
                                    <div key={complaint._id} className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-muted)]/10 hover:bg-[var(--bg-muted)]/40 hover:border-blue-500/20 transition-all group">
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                <MessageSquare size={20} />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-primary group-hover:text-blue-600 transition-colors">{complaint.title || complaint.subject}</h4>
                                                <p className="text-xs text-secondary font-medium tracking-tight line-clamp-1">{complaint.description}</p>
                                                <div className="flex items-center gap-3 pt-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        <Building2 size={10} /> {complaint.block?.name || 'Assigned Block'}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        By {complaint.userId?.name || 'Warden/Student'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant={String(complaint.status || '').toLowerCase() === 'resolved' ? 'success' : 'warning'} className="shadow-sm">
                                            {complaint.status}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card title="Infrastructure Tools" className="shadow-sm hover:shadow-md transition-shadow">
                        <div className="space-y-3 mt-4">
                            {[
                                { link: '/admin/blocks', label: 'Monitor Blocks', icon: <Building2 size={18} />, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/10' },
                                { link: '/admin/resource-config', label: 'Resource Management', icon: <Settings size={18} />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10' },
                                { link: '/admin/analytics', label: 'Global Analytics', icon: <Activity size={18} />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                                { link: '/admin/audit-logs', label: 'Security & Integrity', icon: <Shield size={18} />, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/10' },
                            ].map(tool => (
                                <Link key={tool.link} to={tool.link} className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-muted)]/10 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tool.bg} ${tool.color} group-hover:scale-110 transition-transform`}>
                                            {tool.icon}
                                        </div>
                                        <span className="font-bold text-sm text-primary group-hover:text-blue-600 transition-colors uppercase tracking-tight">{tool.label}</span>
                                    </div>
                                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all">
                                        <ChevronDown size={18} className="-rotate-90" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div >
    );
}

function ChevronDown({ size, className }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6" /></svg>
}
