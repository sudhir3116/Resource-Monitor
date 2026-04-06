import React, { useEffect, useState, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getSocket } from '../utils/socket';
import { safe } from '../utils/safe';
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
    Sun,
    Users,
    MessageSquare,
    CheckCircle,
    ShieldCheck
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

            const isExecutive = [ROLES.ADMIN, ROLES.DEAN, ROLES.PRINCIPAL].includes(user?.role);
            
            if (isExecutive) {
                promises.push(api.get('/api/alerts?status=Pending&limit=5'));
                promises.push(api.get('/api/audit-logs?limit=5'));
            }

            const [summaryRes, trendRes, leaderboardRes, alertsRes, logsRes] = await Promise.allSettled(promises);

            if (summaryRes.status === 'fulfilled') {
                const data = summaryRes.value.data?.data;
                console.log("Dashboard Data:", summaryRes.value.data);
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

            if (isExecutive && alertsRes?.status === 'fulfilled') {
                setRecentAlerts(alertsRes.value.data.alerts || alertsRes.value.data.data || []);
            }

            if (isExecutive && logsRes?.status === 'fulfilled') {
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

        // Keyed lookup to ensure robustness
        const summaryMap = {};
        Object.entries(usageSummary).forEach(([key, val]) => {
            summaryMap[key.toLowerCase()] = val;
        });

        return (Array.isArray(resources) ? resources : [])
            .map(res => {
                const resName = res?.name;
                const data = summaryMap[resName?.toLowerCase()] || {};
                return {
                    name: resName,
                    value: safe(data?.total) || safe(data?.value) || 0
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
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        {user?.role === ROLES.PRINCIPAL ? "Principal's Executive Desk" : 
                         user?.role === ROLES.DEAN ? "Dean's Insights Hub" : "Executive Dashboard"}
                        {isDean && <Badge variant="secondary" className="text-[10px] font-black uppercase">Operation View</Badge>}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {user?.role === ROLES.PRINCIPAL 
                            ? "Campus-wide operational intelligence and resource distribution."
                            : "Real-time monitoring and analytics for strategic resource management."}
                        <span className="ml-2">
                             <a href={`/${user?.role?.toLowerCase()}/analytics`} onClick={(e) => { e.preventDefault(); navigate(`/${user?.role?.toLowerCase()}/analytics`); }} className="text-blue-500 hover:underline font-bold underline-offset-4">Detailed Analytics &rarr;</a>
                        </span>
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
            
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard
                    label="Campus Usage"
                    value={stats?.totalUsage || stats?.grandTotal ? safe(stats?.totalUsage || stats?.grandTotal).toLocaleString() : '0'}
                    icon={<Activity size={20} />}
                    colorClass="text-blue-500"
                />
                <MetricCard
                    label="Est. Cost"
                    value={stats?.grandTotal || stats?.totalUsage ? `₹${(safe(stats?.totalUsage || stats?.grandTotal) * 4.5).toLocaleString()}` : "₹0"}
                    icon={<DollarSign size={20} />}
                    colorClass="text-emerald-500"
                />
                <MetricCard
                    label="Active Alerts"
                    value={safe(stats?.alertsCount || stats?.activeCampusAlerts || 0)}
                    icon={<Bell size={20} />}
                    colorClass={(stats?.alertsCount || stats?.activeCampusAlerts) > 0 ? "text-rose-500" : "text-slate-400"}
                />
                <MetricCard
                    label="Managed Blocks"
                    value={safe(stats?.totalBlocks || 0)}
                    icon={<Building2 size={20} />}
                    colorClass="text-indigo-500"
                />
                <MetricCard
                    label="Campus Users"
                    value={safe(stats?.totalUsers || 0)}
                    icon={<Users size={20} />}
                    colorClass="text-emerald-500"
                />
                <MetricCard
                    label="Total Grievances"
                    value={safe(stats?.unresolvedComplaintsCount || 0)}
                    icon={<MessageSquare size={20} />}
                    colorClass="text-purple-500"
                />
            </div>

            {/* Secondary Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card 
                    title="Executive Watchlist (Critical Alerts)" 
                    icon={<Bell size={18} />} 
                    description="Latest pending resource threshold alerts"
                >
                    <div className="space-y-4 mt-4">
                        {(recentAlerts || []).length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center opacity-30 italic text-sm">
                                <CheckCircle size={32} className="mb-2" />
                                All campus systems report nominal status.
                            </div>
                        ) : (
                            recentAlerts.map(alert => (
                                <div key={alert._id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3 group hover:border-rose-500/30 transition-all">
                                    <div className="mt-1 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-sm truncate">{alert.resourceType || 'Resource'} Threshold</span>
                                            <Badge variant="danger">{alert.severity}</Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-1">{alert.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <Button variant="link" size="sm" className="w-full text-blue-500" onClick={() => navigate(`/${user?.role?.toLowerCase()}/alerts`)}>
                            Access Operational Alert Center &rarr;
                        </Button>
                    </div>
                </Card>

                <Card 
                    title="System Activity Feed" 
                    icon={<History size={18} />} 
                    description="Recent administrative actions and updates"
                >
                    <div className="space-y-4 mt-4">
                        {(recentLogs || []).length === 0 ? (
                            <p className="text-sm text-center py-4 text-slate-400">No recent activity detected.</p>
                        ) : (
                            recentLogs.map(log => (
                                <div key={log._id} className="flex gap-3 items-start p-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-lg transition-colors">
                                    <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                                        {log.action?.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            <span className="font-bold">{log.userId?.name || 'System'}</span> {log.description}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold tabular-nums">{new Date(log.timestamp || log.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <Button variant="link" size="sm" className="w-full text-blue-500 uppercase text-[10px] font-black" onClick={() => navigate(`/${user?.role?.toLowerCase()}/audit-logs`)}>
                            Review Full Audit Trail &rarr;
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
