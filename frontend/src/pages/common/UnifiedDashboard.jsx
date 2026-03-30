import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import {
    AlertTriangle, Bell, RefreshCw, Plus, Activity,
    TrendingUp, TrendingDown, History, PieChart as PieChartIcon
} from 'lucide-react';
import Card, { MetricCard } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { logger } from '../../utils/logger';
import {
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid,
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
        setLoading(true);
        setError(null);
        try {
            const blockParam = (!perms.seesAllBlocks && blockId) ? `&blockId=${blockId}` : '';

            const requests = [
                // [0] Usage summary
                api.get(`/api/usage/summary${blockParam ? `?${blockParam.slice(1)}` : ''}`),
                // [1] Trends
                api.get(`/api/usage/trends?range=${timeRange}${blockParam}`),
                // [2] Resources (NEW: single source of truth)
                api.get('/api/resources'),
                // [3] Alerts — all roles except student
                role !== 'student'
                    ? api.get('/api/alerts?limit=5')
                    : Promise.resolve({ data: { data: [], alerts: [] } }),
            ];

            // Dean/Principal: also fetch audit logs
            if (isExecReadOnly) {
                requests.push(api.get('/api/audit-logs?limit=5')); // [4]
            }

            // Warden: fetch leaderboard for efficiency score
            if (role === 'warden') {
                requests.push(api.get('/api/analytics/leaderboard')); // [4]
            }

            const results = await Promise.allSettled(requests);

            // [0] Summary
            if (results[0].status === 'fulfilled') {
                setUsageSummary(results[0].value.data?.data || null);
            }

            // [1] Trends — always ensure it's an array
            if (results[1].status === 'fulfilled') {
                const raw = results[1].value.data?.data;
                setTrendData(Array.isArray(raw) ? raw : []);
            }

            // [2] Resources (NEW)
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

            // Executive: audit logs OR Warden: leaderboard
            if (results[4]?.status === 'fulfilled') {
                if (isExecReadOnly) {
                    const logsRes = results[4].value.data;
                    const logsArr = logsRes?.data || logsRes?.logs || [];
                    setRecentLogs(Array.isArray(logsArr) ? logsArr : []);
                }
                if (role === 'warden') {
                    const leaderboardArr = results[4].value.data?.data
                        || results[4].value.data?.leaderboard
                        || [];
                    if (Array.isArray(leaderboardArr) && leaderboardArr.length > 0) {
                        setEfficiency(leaderboardArr[0]);
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
        const refresh = () => fetchData();
        window.addEventListener('usage:added', refresh);
        return () => window.removeEventListener('usage:added', refresh);
    }, [fetchData]);

    // ── Computed values ────────────────────────────────────────────────────────
    const totals = usageSummary?.totals || {};
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
                {data.total.toLocaleString()}{' '}
                <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
                    {data.unit || getResourceMeta(resName).unit}
                </span>
            </>
        );
    };

    // Warden: data keyed differently (from /api/dashboard/warden)
    const wardenMetricValue = (resName) => {
        const resLow = resName.toLowerCase();
        const data = (summary[resName] || {});
        const val = data.total;
        if (!val || val === 0) return 'No data';
        return (
            <>
                {val.toLocaleString()}{' '}
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

    // Navigate to usage page
    const goToUsage = () => {
        const routes = { admin: '/admin/usage', gm: '/gm/usage', warden: '/warden/usage' };
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
        <div className="space-y-6">

            {/* ═══════════════════════════════════════ Header ══════════════════ */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3"
                        style={{ color: 'var(--text-primary)' }}>
                        {dashboardTitle}
                        {perms.isReadOnly && <Badge variant="secondary">View Only</Badge>}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {role === 'gm' && 'Campus-wide resource monitoring and analytics'}
                        {role === 'warden' && 'Monitor and manage resource usage for your assigned block'}
                        {isExecReadOnly && <>Campus-wide resource analytics and financial performance. <a href={`/${role}/analytics`} onClick={(e) => { e.preventDefault(); navigate(`/${role}/analytics`); }} className="text-blue-500 hover:underline">For detailed data, visit Analytics →</a></>}
                        {role === 'student' && 'Overview of your block\'s resource consumption'}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Time range selector — GM, Dean, Principal */}
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

                    {/* GM: alerts badge */}
                    {role === 'gm' && (
                        <Badge variant={alertsCount > 0 ? 'danger' : 'success'}
                            className="px-4 py-1 flex items-center gap-2">
                            <Bell size={14} /> {alertsCount} Active Alerts
                        </Badge>
                    )}

                    {/* Warden: View Usage + Add Usage */}
                    {role === 'warden' && (
                        <>
                            <Button variant="secondary" size="sm" onClick={goToUsage}>
                                View Detailed Usage &rarr;
                            </Button>
                            <Button variant="primary" size="sm"
                                onClick={() => navigate('/warden/usage/new')}>
                                <Plus size={16} className="mr-2" /> Add Usage
                            </Button>
                        </>
                    )}

                    {/* GM: View Usage */}
                    {role === 'gm' && (
                        <Button variant="secondary" size="sm" onClick={goToUsage}>
                            View Detailed Usage &rarr;
                        </Button>
                    )}

                    <Button variant="secondary" size="sm" onClick={fetchData}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* ═══════════════════════════════ Resource Metric Cards ═══════════ */}
            <div className={`grid gap-4 ${role === 'gm'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                }`}>
                {/* Alerts card — non-student, non-GM (GM has badge in header) */}
                {role === 'warden' && (
                    <MetricCard
                        icon={<AlertTriangle size={20} />}
                        label="Active Alerts"
                        value={<span style={{ color: 'var(--color-danger)' }}>{alertsCount}</span>}
                    />
                )}

                {resourcesForCards.map(res => {
                    const resName = res.name;
                    const meta = getResourceMeta(resName);
                    return (
                        <MetricCard
                            key={resName}
                            icon={<span className="text-xl">{meta.icon || '📊'}</span>}
                            label={resName}
                            value={metricValue(resName)}
                        />
                    );
                })}
            </div>

            {/* ══════════════════════════ Trend + Distribution Charts ══════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart — col-span-2 */}
                <Card className="lg:col-span-2" title="Resource Consumption Trends"
                    icon={<TrendingUp size={20} />}>
                    <div className="h-[350px] mt-6">
                        {!Array.isArray(trendData) || trendData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Activity size={48} className="mb-2 opacity-20" />
                                <p>No trend data available for this period</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>{CHART_GRADIENTS}</defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false}
                                        stroke="var(--border)" />
                                    <XAxis dataKey="date"
                                        tickFormatter={val =>
                                            new Date(val).toLocaleDateString(undefined,
                                                { month: 'short', day: 'numeric' })}
                                        fontSize={12} stroke="var(--text-secondary)"
                                        tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} stroke="var(--text-secondary)"
                                        tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--bg-card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '12px'
                                        }} />
                                    <Legend iconType="circle" />
                                    {chartResources.map((r) => {
                                        const name = r?.name;
                                        if (!name) return null;
                                        const safeId = String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
                                        return (
                                            <Area
                                                key={name}
                                                type="monotone"
                                                dataKey={name}
                                                name={name}
                                                stroke={r?.color || '#64748b'}
                                                fill={`url(#unified-grad-${safeId})`}
                                                fillOpacity={1}
                                                strokeWidth={2.5}
                                                dot={false}
                                            />
                                        );
                                    })}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Resource Distribution Pie */}
                <Card title="Resource Distribution" icon={<PieChartIcon size={20} />}>
                    <div className="h-[350px] mt-6">
                        {distributionData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                <p>No distribution data.</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={distributionData} cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={100}
                                        paddingAngle={5} dataKey="value">
                                        {distributionData.map((entry, i) => (
                                            <Cell key={i}
                                                fill={getResourceMeta(entry.name).color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px'
                                    }} />
                                    <Legend iconType="circle" verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            {/* ════════════════ Warden Block Performance Card ══════════════════ */}
            {role === 'warden' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="Block Performance" description="Overall efficiency metrics">
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium"
                                        style={{ color: 'var(--text-secondary)' }}>
                                        Overall Efficiency
                                    </span>
                                    <span className="text-sm font-semibold"
                                        style={{
                                            color: (efficiency?.score || 0) >= 80
                                                ? 'var(--color-success)'
                                                : (efficiency?.score || 0) >= 60
                                                    ? 'var(--color-warning)'
                                                    : 'var(--color-danger)'
                                        }}>
                                        {efficiency ? Math.round(efficiency.score) : '—'}%
                                    </span>
                                </div>
                                <div className="w-full rounded-full h-2 overflow-hidden"
                                    style={{ backgroundColor: 'var(--bg-hover)' }}>
                                    <div className="h-full transition-all duration-500 rounded-full"
                                        style={{
                                            width: `${efficiency?.score || 0}%`,
                                            backgroundColor: (efficiency?.score || 0) >= 80
                                                ? 'var(--color-success)'
                                                : (efficiency?.score || 0) >= 60
                                                    ? 'var(--color-warning)'
                                                    : 'var(--color-danger)'
                                        }} />
                                </div>
                            </div>

                            <div className="p-4 rounded-lg border"
                                style={{
                                    borderColor: (efficiency?.score || 0) >= 80
                                        ? 'var(--color-success)'
                                        : (efficiency?.score || 0) >= 60
                                            ? 'var(--color-warning)'
                                            : 'var(--color-danger)',
                                    backgroundColor: (efficiency?.score || 0) >= 80
                                        ? 'rgba(34,197,94,0.1)'
                                        : (efficiency?.score || 0) >= 60
                                            ? 'rgba(234,179,8,0.1)'
                                            : 'rgba(239,68,68,0.1)',
                                }}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wider mb-1"
                                            style={{
                                                color: (efficiency?.score || 0) >= 80
                                                    ? 'var(--color-success)'
                                                    : (efficiency?.score || 0) >= 60
                                                        ? 'var(--color-warning)'
                                                        : 'var(--color-danger)'
                                            }}>
                                            Sustainability Rating
                                        </p>
                                        <p className="text-3xl font-bold"
                                            style={{
                                                color: (efficiency?.score || 0) >= 80
                                                    ? 'var(--color-success)'
                                                    : (efficiency?.score || 0) >= 60
                                                        ? 'var(--color-warning)'
                                                        : 'var(--color-danger)'
                                            }}>
                                            {efficiency
                                                ? (efficiency.score >= 90 ? 'A+' : efficiency.score >= 80 ? 'A' : efficiency.score >= 70 ? 'B' : efficiency.score >= 60 ? 'C' : 'F')
                                                : '—'
                                            }
                                        </p>
                                    </div>
                                    <div className="text-right text-xs"
                                        style={{
                                            color: (efficiency?.score || 0) >= 80
                                                ? 'var(--color-success)'
                                                : (efficiency?.score || 0) >= 60
                                                    ? 'var(--color-warning)'
                                                    : 'var(--color-danger)'
                                        }}>
                                        {efficiency
                                            ? (efficiency.score >= 80 ? 'Top tier' : efficiency.score >= 60 ? 'Average' : 'Needs attention')
                                            : '—'
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                <Button variant="secondary" className="w-full justify-center"
                                    onClick={() => navigate('/warden/daily-report')}>
                                    📋 Submit Daily Report →
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* ═══════════════ Executive: Alerts + Audit Logs side-by-side ══════════ */}
            {isExecReadOnly && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="Recent Alerts" icon={<Bell size={18} />}
                        description="Latest pending resource threshold alerts">
                        <div className="space-y-4 mt-4">
                            {recentAlerts.length === 0 ? (
                                <p className="text-sm text-center py-4 text-slate-400">No pending alerts.</p>
                            ) : (
                                recentAlerts.map(alert => (
                                    <div key={alert._id}
                                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
                                        <div className="mt-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-sm truncate">
                                                    {alert.resourceType} Threshold
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(alert.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-1">{alert.message}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <Button variant="link" size="sm" className="w-full text-blue-500"
                                onClick={() => navigate(`/${role}/alerts`)}>
                                View All Alerts
                            </Button>
                        </div>
                    </Card>

                    <Card title="System Activity" icon={<History size={18} />}
                        description="Recent administrative actions and updates">
                        <div className="space-y-4 mt-4">
                            {recentLogs.length === 0 ? (
                                <p className="text-sm text-center py-4 text-slate-400">No recent activity.</p>
                            ) : (
                                recentLogs.map(log => (
                                    <div key={log._id}
                                        className="flex gap-3 items-start p-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
                                        <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                            {log.action?.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                                <span className="font-semibold">{log.userId?.name || 'System'}</span>{' '}
                                                {log.description}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {new Date(log.timestamp || log.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <Button variant="link" size="sm" className="w-full text-blue-500"
                                onClick={() => navigate(`/${role}/audit-logs`)}>
                                View Audit Trail
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ══════════════════ Student: Complaints section ═══════════════════ */}
            {role === 'student' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="My Complaints" description="Track and submit your block complaints">
                        <div className="flex flex-col items-center justify-center h-32 gap-3 mt-4">
                            <Button variant="primary"
                                onClick={() => navigate('/student/complaints')}>
                                + Submit Complaint
                            </Button>
                            <p className="text-xs text-slate-500">View and track your complaints</p>
                        </div>
                    </Card>
                </div>
            )}

            {/* ════════════════════════ Action Links Row ═══════════════════════ */}
            <div className="flex flex-wrap gap-3">
                {['gm', 'warden'].includes(role) && (
                    <Button variant="secondary" size="sm" onClick={goToUsage}>
                        📊 View Detailed Usage →
                    </Button>
                )}
                {role === 'dean' && (
                    <Button variant="secondary" size="sm"
                        onClick={() => navigate('/dean/analytics')}>
                        📈 View Full Analytics →
                    </Button>
                )}
                {role === 'principal' && (
                    <Button variant="secondary" size="sm"
                        onClick={() => navigate('/principal/analytics')}>
                        📈 View Full Analytics →
                    </Button>
                )}
            </div>

        </div>
    );
}
