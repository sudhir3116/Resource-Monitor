import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import {
    AlertTriangle, Bell, RefreshCw, Plus, Activity,
    TrendingUp, TrendingDown, History, PieChart as PieChartIcon
} from 'lucide-react';
import Card from '../../components/common/Card';
import MetricCard from '../../components/common/MetricCard';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { logger } from '../../utils/logger';
import { getSocket } from '../../utils/socket';
import { safe } from '../../utils/safe';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

// ── Role permission matrix ─────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
    admin: {
        canCreate: true, canEdit: true, canDelete: true,
        canResolveAlerts: true, canEscalate: true, canManageUsers: true,
        seesAllBlocks: true, isReadOnly: false,
    },
    gm: {
        canCreate: false, canEdit: false, canDelete: true,
        canResolveAlerts: true, canEscalate: true, canManageUsers: false,
        seesAllBlocks: true, isReadOnly: false,
    },
    warden: {
        canCreate: true, canEdit: true, canDelete: false,
        canResolveAlerts: false, canEscalate: false, canManageUsers: false,
        seesAllBlocks: false, isReadOnly: false,
    },
    student: {
        canCreate: false, canEdit: false, canDelete: false,
        canResolveAlerts: false, canEscalate: false, canManageUsers: false,
        seesAllBlocks: false, isReadOnly: true,
    },
    dean: {
        canCreate: false, canEdit: false, canDelete: false,
        canResolveAlerts: false, canEscalate: false, canManageUsers: false,
        seesAllBlocks: true, isReadOnly: true,
    },
    principal: {
        canCreate: false, canEdit: false, canDelete: false,
        canResolveAlerts: false, canEscalate: false, canManageUsers: false,
        seesAllBlocks: true, isReadOnly: true,
    },
};

// ── Role display labels ────────────────────────────────────────────────────────
const ROLE_LABELS = {
    gm: 'General Manager',
    warden: 'Warden',
    dean: 'Dean',
    principal: 'Principal',
    student: 'Student',
};

export default function UnifiedDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const role = (user?.role || '').toLowerCase();
    const blockId = user?.block || user?.blockId;
    const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.student;
    // Executive read-only roles (Dean & Principal)
    const isExecReadOnly = ['dean', 'principal'].includes(role);

    // ── State ──────────────────────────────────────────────────────────────────
    const [usageSummary, setUsageSummary] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);   // dean only
    const [dynamicResources, setDynamicResources] = useState([]);
    const [efficiency, setEfficiency] = useState(null); // warden efficiency score
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ── Dashboard title ────────────────────────────────────────────────────────
    const dashboardTitle = {
        gm: 'General Manager Dashboard',
        warden: 'Block Management',
        dean: 'Executive Insights',
        principal: "Principal's Insights",
        student: 'My Block Overview',
    }[role] || 'Dashboard';

    // ── Fetch all data ─────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        // Guard: Warden MUST have a block to fetch dashboard stats
        const isWarden = role === 'warden';
        const bId = blockId?._id || (typeof blockId === 'string' ? blockId : null);

        if (isWarden && !bId) {
            setLoading(false);
            setError('No block assigned. Please contact the administrator.');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const blockParam = (!perms.seesAllBlocks && bId) ? `&blockId=${bId}` : '';

            const requests = [
                // [0] Usage summary
                api.get(`/api/usage/summary${blockParam ? `?${blockParam.slice(1)}` : ''}`),
                // [1] Trends
                api.get(`/api/usage/trends?range=${timeRange}${blockParam}`),
                // [2] Resources
                api.get('/api/resources'),
                // [3] Alerts
                api.get('/api/alerts?limit=5'),
                // [4] Announcements (NEW for Dashboard)
                api.get('/api/announcements?limit=3'),
            ];

            // Dean/Principal: audit logs
            if (isExecReadOnly) {
                requests.push(api.get('/api/audit-logs?limit=5'));
            }

            // Warden: leaderboard
            if (role === 'warden') {
                requests.push(api.get('/api/analytics/leaderboard'));
            }

            const results = await Promise.allSettled(requests);

            // [0] Summary
            if (results[0].status === 'fulfilled') {
                setUsageSummary(results[0].value.data?.data || null);
            }

            // [1] Trends
            if (results[1].status === 'fulfilled') {
                const raw = results[1].value.data?.data;
                setTrendData(Array.isArray(raw) ? raw : []);
            }

            // [2] Resources
            if (results[2].status === 'fulfilled') {
                const resources = results[2].value.data?.data || [];
                const activeResources = (Array.isArray(resources) ? resources : []).filter(r => r?.isActive === true);
                setDynamicResources(activeResources);
            }

            // [3] Alerts
            if (results[3].status === 'fulfilled') {
                const alertRes = results[3].value.data;
                const alertArr = alertRes?.alerts || alertRes?.data || [];
                setRecentAlerts(Array.isArray(alertArr) ? alertArr.slice(0, 5) : []);
            }

            // [4] Announcements
            if (results[4]?.status === 'fulfilled') {
                const announceRes = results[4].value.data;
                const announceArr = announceRes?.data || announceRes?.announcements || [];
                setRecentAnnouncements(Array.isArray(announceArr) ? announceArr.slice(0, 3) : []);
            }

            // Executive Logs [5] OR Warden Leaderboard [5]
            const extraIdx = 5; 
            if (results[extraIdx]?.status === 'fulfilled') {
                if (isExecReadOnly) {
                    const logsRes = results[extraIdx].value.data;
                    const logsArr = logsRes?.data || logsRes?.logs || [];
                    setRecentLogs(Array.isArray(logsArr) ? logsArr : []);
                }
                if (role === 'warden') {
                    const leaderboardArr = results[extraIdx].value.data?.data
                        || results[extraIdx].value.data?.leaderboard
                        || [];
                    if (Array.isArray(leaderboardArr) && leaderboardArr.length > 0) {
                        setEfficiency(leaderboardArr[0]);
                    } else {
                        setEfficiency({ score: 0 }); // Fallback
                    }
                }
            }
        } catch (err) {
            logger.error('UnifiedDashboard fetch error', err);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [role, blockId, timeRange, perms.seesAllBlocks, isExecReadOnly]);

    useEffect(() => {
        fetchData();

        // Listen for browser events
        const refresh = () => fetchData();
        window.addEventListener('usage:added', refresh);

        // Listen for socket events (Requirement Part 4)
        const socket = getSocket();
        if (socket) {
            socket.on('usage:added', refresh);
            socket.on('dashboard:refresh', refresh);
            socket.on('usage:refresh', refresh);
        }

        return () => {
            window.removeEventListener('usage:added', refresh);
            if (socket) {
                socket.off('usage:added', refresh);
                socket.off('dashboard:refresh', refresh);
                socket.off('usage:refresh', refresh);
            }
        };
    }, [fetchData]);

    // ── Computed values ────────────────────────────────────────────────────────
    const summary = usageSummary?.summary || {};
    const alertsCount = usageSummary?.alertsCount || recentAlerts.length || 0;

    const getResourceMeta = (type) => {
        const match = (Array.isArray(dynamicResources) ? dynamicResources : [])
            .find(r => r?.name === type);
        return {
            icon: match?.icon || '📊',
            color: match?.color || '#64748b',
            bg: 'bg-slate-500/10',
            unit: match?.unit || 'units'
        };
    };

    // MetricCard value helper
    const metricValue = (resName) => {
        const data = summary[resName] || {};
        if (!data.total || data.total === 0) return 'No data';
        return (
            <>
                {safe(data.total).toLocaleString()}{' '}
                <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
                    {data.unit || getResourceMeta(resName).unit}
                </span>
            </>
        );
    };

    // Pie chart data — from summary
    const distributionData = Object.entries(summary)
        .map(([name, d]) => ({ name, value: d.total || 0 }))
        .filter(d => d.value > 0);

    // Navigate to usage history
    const goToUsage = () => {
        const routes = { 
            admin: '/admin/usage', 
            gm: '/gm/usage', 
            warden: '/warden/usage',
            student: '/student/usage'
        };
        const path = routes[role];
        if (path) navigate(path);
    };

    // ── Loading skeleton ───────────────────────────────────────────────────────
    if (loading && !usageSummary) {
        return (
            <div className="space-y-6">
                <div className="h-10 w-64 rounded animate-pulse bg-slate-200 dark:bg-slate-700" />
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-32 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700" />
                    ))}
                </div>
                <div className="h-80 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700" />
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────────
    if (error && !usageSummary) {
        return (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4">
                <p className="text-rose-500 font-semibold">{error}</p>
                <Button onClick={fetchData}>Retry</Button>
            </div>
        );
    }

    // Which resources to show as metric cards
    const resourcesForCards = (Array.isArray(dynamicResources) ? dynamicResources : []).slice(0, role === 'gm' ? 6 : 3);

    const chartResources = (Array.isArray(dynamicResources) ? dynamicResources : []);
    const CHART_GRADIENTS = chartResources.map((r) => {
        const name = r?.name || 'resource';
        const color = r?.color || '#64748b';
        const safeId = String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
        return (
            <linearGradient key={safeId} id={`unified-grad-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
        );
    });

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 pb-10">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2"
                        style={{ color: 'var(--text-primary)' }}>
                        {dashboardTitle}
                        {perms.isReadOnly && <Badge variant="secondary" className="text-[10px]">View Only</Badge>}
                    </h1>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {role === 'gm' && 'Campus-wide resource monitoring and analytics'}
                        {role === 'warden' && 'Monitor and manage resource usage for your assigned block'}
                        {isExecReadOnly && <>Campus-wide resource analytics and financial performance.</>}
                        {role === 'student' && 'Overview of your block\'s resource consumption'}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {['gm', 'dean', 'principal'].includes(role) && (
                        <div className="bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-1">
                            {['7d', '30d', '90d'].map(r => (
                                <button key={r} onClick={() => setTimeRange(r)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeRange === r
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}>
                                    {r.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}

                    {role === 'warden' && (
                        <Button variant="primary" size="sm"
                            onClick={() => navigate('/warden/usage/new')}>
                            <Plus size={16} className="mr-2" /> Add Usage
                        </Button>
                    )}

                    <Button variant="secondary" size="sm" onClick={fetchData}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Resource Metric Cards Row */}
            <div className={`grid gap-4 ${role === 'gm'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                }`}>
                {role === 'warden' && (
                    <MetricCard
                        icon={<AlertTriangle size={20} />}
                        label="Active Alerts"
                        value={<span style={{ color: 'var(--color-danger)' }}>{alertsCount}</span>}
                    />
                )}

                {resourcesForCards.map(res => {
                    const resName = res.name;
                    return (
                        <MetricCard
                            key={resName}
                            icon={<span className="text-xl">{getResourceMeta(resName).icon}</span>}
                            label={resName}
                            value={metricValue(resName)}
                        />
                    );
                })}
            </div>

            {/* main charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2" title="Consumption Trends" icon={<TrendingUp size={20} />}>
                    <div className="h-[300px] mt-4">
                        {!Array.isArray(trendData) || trendData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Activity size={48} className="mb-2 opacity-20" />
                                <p>No trend data available for this period</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>{CHART_GRADIENTS}</defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} fontSize={10} stroke="var(--text-secondary)" />
                                    <YAxis fontSize={10} stroke="var(--text-secondary)" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                                    <Legend iconType="circle" />
                                    {chartResources.map((r) => (
                                        <Area key={r.name} type="monotone" dataKey={r.name} name={r.name} stroke={r.color} fill={`url(#unified-grad-${String(r.name).replace(/[^a-zA-Z0-9_-]/g, '_')})`} fillOpacity={1} strokeWidth={2} dot={false} />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card title="Usage Distribution" icon={<PieChartIcon size={20} />}>
                    <div className="h-[300px] mt-4">
                        {distributionData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400"><p>No distribution data.</p></div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={distributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                        {distributionData.map((entry, i) => <Cell key={i} fill={getResourceMeta(entry.name).color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                                    <Legend iconType="circle" verticalAlign="bottom" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            {/* Bottom Row - Mixed roles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Alerts Section - Generic */}
                <Card title="Recent Alerts" icon={<Bell size={18} />} description="Critical notifications regarding block resources">
                    <div className="space-y-3 mt-4">
                        {recentAlerts.length === 0 ? (
                            <p className="text-xs text-slate-500 italic py-4 text-center">No pending alerts</p>
                        ) : (
                            recentAlerts.slice(0, 3).map(alert => (
                                <div key={alert._id} className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 flex items-start gap-3">
                                    <AlertTriangle className="text-rose-500 mt-1" size={14} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{alert.resourceType} - {alert.severity}</p>
                                        <p className="text-xs text-slate-500 line-clamp-1">{alert.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <Button variant="link" size="sm" className="w-full text-blue-500" onClick={() => navigate(role === 'student' ? '/student/alerts' : `/${role}/alerts`)}>
                            View All Alerts &rarr;
                        </Button>
                    </div>
                </Card>

                {/* Role Specific Block */}
                {isExecReadOnly ? (
                    <Card title="Recent Activity" icon={<History size={18} />} description="Log of administrative events">
                        <div className="space-y-3 mt-4">
                            {recentLogs.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-4 text-center">No activity found</p>
                            ) : (
                                recentLogs.map(log => (
                                    <div key={log._id} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/20 rounded-lg flex gap-3 text-xs">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{log.action?.[0] || 'L'}</div>
                                        <div>
                                            <p className="font-semibold">{log.userId?.name || 'System'}</p>
                                            <p className="opacity-70">{log.description}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <Button variant="link" size="sm" className="w-full" onClick={() => navigate(`/${role}/audit-logs`)}>Full Audit Log &rarr;</Button>
                        </div>
                    </Card>
                ) : role === 'warden' ? (
                    <Card title="Daily Reports" description="Manage and track daily submissions">
                        <div className="flex flex-col items-center justify-center p-6 gap-4 text-center">
                            <Button variant="secondary" className="w-full" onClick={() => navigate('/warden/daily-report')}>
                                📋 Submit New Report
                            </Button>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Efficiency: {Math.round(efficiency?.score || 0)}%</p>
                        </div>
                    </Card>
                ) : role === 'student' ? (
                    <Card title="Help & Support" description="Submit queries or block complaints">
                        <div className="flex flex-col items-center justify-center p-6 gap-4">
                            <Button variant="primary" onClick={() => navigate('/student/complaints')}>
                                + New Support Ticket
                            </Button>
                            <p className="text-xs text-slate-500">Track your reported issues and resolutions</p>
                        </div>
                    </Card>
                ) : null}
            </div>

            {/* Announcements Card - Full Width for Student, else integrated */}
            {role === 'student' && (
                <Card title="Block Announcements" description="Latest updates for your specific block">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {recentAnnouncements.length === 0 ? (
                            <div className="col-span-full py-10 text-center italic text-slate-400">No announcements for your block.</div>
                        ) : (
                            recentAnnouncements.map(notice => (
                                <div key={notice._id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge variant="primary" className="text-[9px]">{notice.type}</Badge>
                                        <span className="text-[10px] text-slate-400">{new Date(notice.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">{notice.title}</h4>
                                    <p className="text-xs text-slate-500 line-clamp-2">{notice.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            )}

            {/* Quick Actions Row */}
            <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="secondary" size="sm" onClick={goToUsage}>
                    <PieChartIcon size={16} className="mr-2" /> View Full Usage History
                </Button>
                {role === 'admin' && <Button variant="primary" size="sm" onClick={() => navigate('/admin/dashboard')}>Admin Control Control Panel</Button>}
                {role === 'dean' && <Button variant="secondary" size="sm" onClick={() => navigate('/dean/analytics')}>Full Analytics</Button>}
                {role === 'principal' && <Button variant="secondary" size="sm" onClick={() => navigate('/principal/analytics')}>Institutional Insights</Button>}
                <Button variant="secondary" size="sm" onClick={() => navigate('/announcements')}>Campus Notice Board</Button>
            </div>
        </div>
    );
}
