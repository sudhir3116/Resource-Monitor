import React, { useEffect, useState, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    Zap,
    Droplets,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Download,
    Building2,
    Activity,
    Flame,
    Wind,
    Utensils,
    Trash2,
    RefreshCw,
    Filter,
    ChevronDown,
    Bell,
    History,
    Sun
} from 'lucide-react';
import Card from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { logger } from '../utils/logger';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import useSortableTable from '../hooks/useSortableTable';
import SortIcon from '../components/common/SortIcon';
import { useResources } from '../hooks/useResources';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

export default function ExecutiveDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const isDean = user?.role === ROLES.DEAN;
    const { resources } = useResources();  // Get active resources from single source
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [trendData, setTrendData] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [usageSummary, setUsageSummary] = useState({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const promises = [
                api.get('/api/usage/summary'),
                api.get('/api/usage/trends?range=' + timeRange),
                api.get('/api/analytics/leaderboard')
            ];

            if (isDean) {
                promises.push(api.get('/api/alerts?status=Pending&limit=5'));
                promises.push(api.get('/api/audit-logs?limit=5'));
            }

            const [summaryRes, trendRes, leaderboardRes, alertsRes, logsRes] = await Promise.allSettled(promises);

            if (summaryRes.status === 'fulfilled') {
                const data = summaryRes.value.data?.data;
                setUsageSummary(data?.summary || {});
                setStats({
                    ...data,
                    financial: { estimatedCost: data?.grandTotal || 0, percentageChange: 0 }
                });
            }

            if (trendRes.status === 'fulfilled') {
                setTrendData(trendRes.value.data?.data || []);
            }

            if (leaderboardRes.status === 'fulfilled') {
                setLeaderboard(leaderboardRes.value.data.data || leaderboardRes.value.data?.leaderboard || []);
            }

            if (isDean && alertsRes?.status === 'fulfilled') {
                setRecentAlerts(alertsRes.value.data.alerts || alertsRes.value.data.data || []);
            }

            if (isDean && logsRes?.status === 'fulfilled') {
                setRecentLogs(logsRes.value.data.data || logsRes.value.data.logs || []);
            }
        } catch (err) {
            logger.error("Failed to fetch executive dashboard data", err);
        } finally {
            setLoading(false);
        }
    }, [timeRange, isDean]);

    useEffect(() => {
        fetchData();
        const refresh = () => fetchData();
        window.addEventListener('usage:added', refresh);
        const socket = getSocket();
        if (socket) {
            socket.on('usage:refresh', refresh);
            socket.on('usage:added', refresh);
            socket.on('alerts:refresh', refresh);
            socket.on('dashboard:refresh', refresh);
        }
        return () => {
            window.removeEventListener('usage:added', refresh);
            if (socket) {
                socket.off('usage:refresh', refresh);
                socket.off('usage:added', refresh);
                socket.off('alerts:refresh', refresh);
                socket.off('dashboard:refresh', refresh);
            }
        };
    }, [fetchData]);

    const { sortedData: sortedLeaderboard, sortField, sortDirection, handleSort } = useSortableTable(
        leaderboard,
        'executive-leaderboard'
    );

    const getResourceMeta = (type) => {
        const resource = (Array.isArray(resources) ? resources : []).find(r => r?.name === type);
        return {
            icon: resource?.icon || '📊',
            color: resource?.color || '#64748b',
            bg: 'bg-slate-500/10'
        };
    };

    const costStats = useMemo(() => {
        if (!stats?.financial) return { total: 0, change: 0 };
        return {
            total: parseFloat(stats.financial.estimatedCost || 0),
            change: parseFloat(stats.financial.percentageChange || 0)
        };
    }, [stats]);

    const distributionData = useMemo(() => {
        if (!usageSummary || Object.keys(usageSummary).length === 0) return [];
        return (Array.isArray(resources) ? resources : [])
            .map(res => {
                const resName = res?.name;
                const data = usageSummary[resName] || {};
                return {
                    name: resName,
                    value: data?.total || 0
                };
            })
            .filter(d => d?.value > 0) || [];
    }, [usageSummary, resources]);

    if (loading && !stats) {
        return (
            <div className="space-y-6">
                <div className="h-8 rounded w-1/4 animate-pulse bg-slate-200 dark:bg-slate-700"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
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
                    <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        Executive Insights
                        {isDean && <Badge variant="secondary">View Only</Badge>}
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Campus-wide resource analytics and financial performance. <a href="/dean/analytics" onClick={(e) => { e.preventDefault(); navigate('/dean/analytics'); }} className="text-blue-500 hover:underline">For detailed data, visit Analytics &rarr;</a>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-1">
                        {['7d', '30d', '90d'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeRange === range ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {range.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" onClick={fetchData}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Full resource cards grid for Dean */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(usageSummary)
                    .filter(([, d]) => d.total > 0 || d.dailyThreshold > 0)
                    .map(([name, data]) => {
                        const pct = data.dailyThreshold
                            ? Math.min(
                                Math.round(
                                    (data.total / data.dailyThreshold) * 100
                                ), 200)
                            : 0;
                        const pctColor =
                            pct >= 150 ? '#EF4444'
                                : pct >= 100 ? '#F97316'
                                    : pct >= 80 ? '#F59E0B'
                                        : '#10B981';
                        const meta = getResourceMeta(name);

                        return (
                            <Card key={name}
                                className="p-5 flex flex-col gap-3"
                                style={{
                                    borderLeftWidth: '3px',
                                    borderLeftColor: meta.color
                                }}>

                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">
                                            {meta.icon}
                                        </span>
                                        <span className="font-semibold text-sm"
                                            style={{
                                                color: 'var(--text-primary)'
                                            }}>
                                            {name}
                                        </span>
                                    </div>
                                    {pct > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{
                                                backgroundColor: pctColor + '20',
                                                color: pctColor
                                            }}>
                                            {pct}%
                                        </span>
                                    )}
                                </div>

                                {/* Value */}
                                <div>
                                    <p className="text-2xl font-bold"
                                        style={{
                                            color: 'var(--text-primary)'
                                        }}>
                                        {data.total > 0
                                            ? data.total.toLocaleString()
                                            : '—'}
                                    </p>
                                    <p className="text-sm"
                                        style={{
                                            color: 'var(--text-secondary)'
                                        }}>
                                        {data.unit}
                                        {data.dailyThreshold > 0 &&
                                            ` / ${data.dailyThreshold} limit`}
                                    </p>
                                </div>

                                {/* Progress bar */}
                                {pct > 0 && (
                                    <div className="w-full h-1.5 rounded-full overflow-hidden"
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)'
                                        }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(pct, 100)}%`,
                                                backgroundColor: pctColor
                                            }}
                                        />
                                    </div>
                                )}

                                {/* No data state */}
                                {data.total === 0 && (
                                    <p className="text-xs"
                                        style={{
                                            color: 'var(--text-secondary)'
                                        }}>
                                        No data recorded yet
                                    </p>
                                )}
                            </Card>
                        );
                    })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" title="Consumption Trends">
                    <div className="h-[350px] w-full mt-4">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Loading trends...</div>
                        ) : !Array.isArray(trendData) ? (
                            <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
                        ) : trendData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400">No trend data available.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={(Array.isArray(trendData) ? trendData : []).slice(0, 10)}>
                                    <defs>
                                        {resources.map(res => (
                                            <linearGradient key={res._id || res.name} id={`color${res.name}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={getResourceMeta(res.name).color} stopOpacity={0.1} />
                                                <stop offset="95%" stopColor={getResourceMeta(res.name).color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis
                                        dataKey="_id"
                                        stroke="var(--text-secondary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    />
                                    <YAxis
                                        stroke="var(--text-secondary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                                    />
                                    {resources.map(res => (
                                        <Area
                                            key={res._id || res.name}
                                            type="monotone"
                                            dataKey={res.name}
                                            stroke={getResourceMeta(res.name).color}
                                            fillOpacity={1}
                                            fill={`url(#color${res.name})`}
                                            strokeWidth={3}
                                            dot={false}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card title="Resource Distribution">
                    <div className="h-[350px] mt-4">
                        {distributionData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400">No distribution data.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getResourceMeta(entry.name).color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                                    />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>



            {isDean && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="Recent Alerts" icon={<Bell size={18} />} description="Latest pending resource threshold alerts">
                        <div className="space-y-4 mt-4">
                            {recentAlerts.length === 0 ? (
                                <p className="text-sm text-center py-4 text-slate-400">No pending alerts.</p>
                            ) : (
                                recentAlerts.map(alert => (
                                    <div key={alert._id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
                                        <div className="mt-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-sm truncate">{alert.resourceType} Threshold</span>
                                                <span className="text-[10px] text-slate-400">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-1">{alert.message}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <Button variant="link" size="sm" className="w-full text-blue-500" onClick={() => navigate('/dean/alerts')}>
                                View All Alerts
                            </Button>
                        </div>
                    </Card>

                    <Card title="System Activity" icon={<History size={18} />} description="Recent administrative actions and updates">
                        <div className="space-y-4 mt-4">
                            {recentLogs.length === 0 ? (
                                <p className="text-sm text-center py-4 text-slate-400">No recent activity.</p>
                            ) : (
                                recentLogs.map(log => (
                                    <div key={log._id} className="flex gap-3 items-start p-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
                                        <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                            {log.action?.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                                <span className="font-semibold">{log.userId?.name || 'System'}</span> {log.description}
                                            </p>
                                            <p className="text-[10px] text-slate-400">{new Date(log.timestamp || log.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            <Button variant="link" size="sm" className="w-full text-blue-500" onClick={() => navigate('/dean/audit-logs')}>
                                View Audit Trail
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
