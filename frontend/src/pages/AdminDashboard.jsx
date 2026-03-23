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
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { logger } from '../utils/logger';

const RESOURCE_META = {
    Electricity: { icon: <Zap size={16} className="text-amber-500" />, emoji: '⚡' },
    Water: { icon: <Droplets size={16} className="text-blue-500" />, emoji: '💧' },
    Solar: { icon: <Sun size={16} className="text-yellow-500" />, emoji: '☀️' },
    LPG: { icon: <Flame size={16} className="text-orange-500" />, emoji: '🔥' },
    Diesel: { icon: <Wind size={16} className="text-slate-500" />, emoji: '⛽' },
    Waste: { icon: <Trash2 size={16} className="text-rose-500" />, emoji: '♻️' },
};

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalBlocks: 0,
        activeAlerts: 0,
        pendingComplaints: 0,
        recentAlerts: [],
        recentComplaints: []
    });
    const [loading, setLoading] = useState(true);
    const [dynamicResources, setDynamicResources] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            const [usersRes, blocksRes, alertsRes, complaintsRes, configRes] = await Promise.allSettled([
                api.get('/api/admin/users'),
                api.get('/api/admin/blocks'),
                api.get('/api/alerts?limit=5'),
                api.get('/api/complaints?limit=5'),
                api.get('/api/config/thresholds')
            ]);

            const safeArray = (res) => {
                if (res.status !== 'fulfilled') return []
                const d = res.value.data
                return Array.isArray(d) ? d
                    : Array.isArray(d?.data) ? d.data
                        : Array.isArray(d?.users) ? d.users
                            : Array.isArray(d?.blocks) ? d.blocks
                                : Array.isArray(d?.alerts) ? d.alerts
                                    : Array.isArray(d?.complaints) ? d.complaints
                                        : []
            }

            const safeCount = (res, ...keys) => {
                if (res.status !== 'fulfilled') return 0
                const d = res.value.data
                for (const k of keys) {
                    if (typeof d?.[k] === 'number') return d[k]
                }
                return safeArray(res).length
            }

            if (configRes.status === 'fulfilled') {
                setDynamicResources((configRes.value.data.data || []).filter(r => r.isActive));
            }

            setStats({
                totalUsers: safeCount(usersRes, 'totalUsers', 'total'),
                totalBlocks: safeCount(blocksRes, 'totalBlocks', 'total'),
                activeAlerts: safeArray(alertsRes).length, // simplified for dashboard
                pendingComplaints: safeArray(complaintsRes).filter(c => c.status !== 'RESOLVED').length,
                recentAlerts: safeArray(alertsRes),
                recentComplaints: safeArray(complaintsRes)
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
        if (socket) {
            socket.on('dashboard:refresh', fetchData);
            socket.on('users:refresh', fetchData);
        }
        return () => {
            if (socket) {
                socket.off('dashboard:refresh', fetchData);
                socket.off('users:refresh', fetchData);
            }
        };
    }, [fetchData]);

    const getResourceIcon = (type) => {
        return RESOURCE_META[type]?.icon || <Activity size={16} />;
    };

    if (loading && stats.totalUsers === 0) {
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Shield className="text-blue-600" /> System Control Center
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Master overview of infrastructure, security, and users
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/users">
                        <Button variant="primary">
                            <UserPlus size={16} className="mr-2" /> Manage Users
                        </Button>
                    </Link>
                    <Button variant="secondary" onClick={fetchData}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</span>
                        <Users size={18} className="text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold">{stats.totalUsers}</div>
                    <p className="text-xs text-slate-500 mt-1">Across all roles</p>
                </Card>

                <Card className="border-l-4 border-indigo-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Blocks</span>
                        <Building2 size={18} className="text-indigo-500" />
                    </div>
                    <div className="text-3xl font-bold">{stats.totalBlocks}</div>
                    <p className="text-xs text-slate-500 mt-1">Monitored infrastructure</p>
                </Card>

                <Card className="border-l-4 border-rose-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Alerts</span>
                        <AlertTriangle size={18} className="text-rose-500" />
                    </div>
                    <div className={`text-3xl font-bold ${stats.activeAlerts > 0 ? 'text-rose-500' : ''}`}>{stats.activeAlerts}</div>
                    <p className="text-xs text-slate-500 mt-1">Requires attention</p>
                </Card>

                <Card className="border-l-4 border-amber-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Complaints</span>
                        <MessageSquare size={18} className="text-amber-500" />
                    </div>
                    <div className="text-3xl font-bold">{stats.pendingComplaints}</div>
                    <p className="text-xs text-slate-500 mt-1">Unresolved tickets</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Latest System Alerts" action={<Link to="/alerts" className="text-xs text-blue-500 hover:underline">View All</Link>}>
                        <div className="overflow-x-auto -mx-6 mt-4">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th className="pl-6">Resource</th>
                                        <th>Block</th>
                                        <th>Severity</th>
                                        <th>Status</th>
                                        <th className="pr-6">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentAlerts.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-8 text-slate-500">No active alerts.</td></tr>
                                    ) : (
                                        stats.recentAlerts.map(alert => (
                                            <tr key={alert._id}>
                                                <td className="pl-6">
                                                    <div className="flex items-center gap-2">
                                                        {getResourceIcon(alert.resource || alert.resourceType)}
                                                        <span className="font-medium">{alert.resource || alert.resourceType}</span>
                                                    </div>
                                                </td>
                                                <td>{alert.block?.name || alert.block || '-'}</td>
                                                <td>
                                                    <Badge variant={alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'HIGH' ? 'warning' : 'secondary'}>
                                                        {alert.severity}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Badge variant={alert.status === 'RESOLVED' ? 'success' : 'warning'}>
                                                        {alert.status}
                                                    </Badge>
                                                </td>
                                                <td className="pr-6 text-xs text-slate-400">
                                                    {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card title="Recent Complaints" action={<Link to="/complaints" className="text-xs text-blue-500 hover:underline">View All</Link>}>
                        <div className="space-y-4 mt-4">
                            {stats.recentComplaints.length === 0 ? (
                                <p className="text-center py-8 text-slate-500 text-sm">No recent complaints.</p>
                            ) : (
                                stats.recentComplaints.map(complaint => (
                                    <div key={complaint._id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                                <MessageSquare size={20} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm">{complaint.title || complaint.subject}</h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{complaint.description}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                                                        <Building2 size={10} /> {complaint.block?.name || 'Unknown'}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                        By {complaint.userId?.name || 'Student'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant={complaint.status === 'RESOLVED' ? 'success' : 'warning'}>
                                            {complaint.status}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Infrastructure Tools">
                        <div className="space-y-3 mt-4">
                            {[
                                { link: '/admin/blocks', label: 'Monitor Blocks', icon: <Building2 size={16} />, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                                { link: '/resource-config', label: 'Resource Config', icon: <Settings size={16} />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                                { link: '/analytics', label: 'Global Analytics', icon: <Activity size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                                { link: '/audit-logs', label: 'Security Audit', icon: <Shield size={16} />, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                            ].map(tool => (
                                <Link key={tool.link} to={tool.link} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${tool.bg} ${tool.color}`}>
                                            {tool.icon}
                                        </div>
                                        <span className="font-semibold text-sm group-hover:text-blue-600 transition-colors">{tool.label}</span>
                                    </div>
                                    <ChevronDown size={14} className="-rotate-90 text-slate-400" />
                                </Link>
                            ))}
                        </div>
                    </Card>

                    <Card title="System Performance">
                        <div className="space-y-4 mt-4">
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500">Storage Usage</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">42%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: '42%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500">API Latency</span>
                                    <span className="font-bold text-green-500">124ms</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500" style={{ width: '15%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500">Uptime</span>
                                    <span className="font-bold text-blue-500">99.9%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: '99.9%' }}></div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ChevronDown({ size, className }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6" /></svg>
}
