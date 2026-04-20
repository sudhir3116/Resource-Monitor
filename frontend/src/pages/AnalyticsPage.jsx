import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { safe } from '../utils/safe';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    Activity,
    BarChart3,
    PieChart as PieIcon,
    Filter,
    RefreshCw,
    Info,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
    Cell,
    PieChart,
    Pie,
    LineChart,
    Line
} from 'recharts';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import { getSocket } from '../utils/socket';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

export default function AnalyticsPage() {
    const { user } = useContext(AuthContext);
    const isDean = (user?.role || '').toLowerCase() === 'dean';
    const isPrincipal = (user?.role || '').toLowerCase() === 'principal';
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [summaryData, setSummaryData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [dynamicResources, setDynamicResources] = useState([]);
    const [blockComparison, setBlockComparison] = useState([]);
    const [blockRanking, setBlockRanking] = useState([]);
    const [stats, setStats] = useState({}); // Restored missing stats state

    // Removed hardcoded COLORS object. Using dynamic colors from resources.

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const blockIdForQuery = user?.block?._id || user?.block || null;

            // Convert UI range string to number of days
            const rangeToDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
            const days = rangeToDays[timeRange] || 30;

            const [resourcesRes, summaryRes, trendsRes, comparisonRes] = await Promise.all([
                api.get("/api/resources"),
                api.get(`/api/usage/summary`, { params: { blockId: blockIdForQuery } }),
                api.get(`/api/usage/trends`, { params: { blockId: blockIdForQuery, range: timeRange } }),
                api.get(`/api/usage/block-comparison`)
            ]);

            const resources = resourcesRes.data.data || resourcesRes.data || [];
            const summaryRaw = summaryRes.data.data || summaryRes.data || {};
            const trendsRaw = trendsRes.data.data || trendsRes.data || [];
            const comparisonRaw = comparisonRes.data.data || comparisonRes.data || [];

            setDynamicResources(resources.filter(r => r?.isActive !== false));
            setBlockComparison(comparisonRaw);
            setBlockRanking(comparisonRaw);

            // Map summary — support both array and object shapes
            const rawItems = Array.isArray(summaryRaw.summaryArray) ? summaryRaw.summaryArray
                : (Array.isArray(summaryRaw.summary) ? summaryRaw.summary
                    : Object.values(summaryRaw.summary || {}));

            const summary = rawItems.map(item => ({
                name: item.resource_type || item._id || item.name,
                value: item.total || item.value || 0,
                total: item.total || item.value || 0,
                _id: item._id,
                ...item
            }));

            // Map trends: accept both array directly or { trends: [] } shape
            let trends = Array.isArray(trendsRaw)
                ? trendsRaw
                : (Array.isArray(trendsRaw.trends) ? trendsRaw.trends : []);

            const statsMap = {};
            summary.forEach(item => { statsMap[item.name] = item; });

            setSummaryData(summary);
            setStats(statsMap);
            setTrendData(trends);

        } catch (err) {
            logger.error('Failed to fetch analytics data', err);
            addToast('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, user, timeRange]);

    useEffect(() => {
        fetchAnalytics();
        const socket = getSocket();

        if (socket) {
            socket.on('usage:refresh', fetchAnalytics);
            socket.on('dashboard:refresh', fetchAnalytics);
            socket.on('alerts:refresh', fetchAnalytics);
            socket.on('analytics:refresh', fetchAnalytics);
            socket.on('blocks:refresh', fetchAnalytics);
        }

        return () => {
            if (socket) {
                socket.off('usage:refresh', fetchAnalytics);
                socket.off('dashboard:refresh', fetchAnalytics);
                socket.off('alerts:refresh', fetchAnalytics);
                socket.off('analytics:refresh', fetchAnalytics);
                socket.off('blocks:refresh', fetchAnalytics);
            }
        };
    }, [fetchAnalytics]);

    const resourcesForCharts = useMemo(() => {
        if (!Array.isArray(dynamicResources) || dynamicResources.length === 0) {
            return (Array.isArray(summaryData) ? summaryData : []).map(s => ({
                _id: s.resource,
                resource: s.resource_type,
                name: s.resource_type,
                unit: s.unit,
                total: s.total || 0,
                value: s.value || 0
            }));
        }

        return dynamicResources.map(r => {
            const s = (Array.isArray(summaryData) ? summaryData : [])
                .find(item => (item.name || '').toLowerCase() === (r.name || '').toLowerCase() ||
                    (item.resource_type || '').toLowerCase() === (r.name || '').toLowerCase());
            return {
                ...r,
                total: s?.total || 0,
                value: s?.value || 0,
                unit: s?.unit || r.unit
            };
        });
    }, [dynamicResources, summaryData]);

    const activeSummary = useMemo(() => {
        return Array.isArray(summaryData) ? summaryData : [];
    }, [summaryData]);

    const selectedRange = parseInt(timeRange) || 7;
    // FIX EMPTY CHECK (Requirement Step 5)
    const hasData = Array.isArray(activeSummary) && activeSummary.length > 0;
    const trendSeries = useMemo(
        () => resourcesForCharts.map(r => r.resource || r.name).filter(Boolean),
        [resourcesForCharts]
    );

    const hasAnyTrendSeriesData = useMemo(() => {
        return Array.isArray(trendData) && trendData.length > 0;
    }, [trendData]);

    const getResourceMeta = (type) => {
        const res = (Array.isArray(resourcesForCharts) ? resourcesForCharts : [])
            .find(r => (r?.name || r?.resource) === type);
        const color = res?.color || '#64748b';
        return {
            icon: res?.icon || '📊',
            color: color,
            bg: color + '15',
            unit: res?.unit || 'units'
        };
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xl backdrop-blur-md bg-opacity-90">
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-tight">
                        {new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="space-y-2">
                        {payload.map((entry, index) => {
                            const meta = getResourceMeta(entry.name);
                            return (
                                <div key={index} className="flex items-center justify-between gap-8">
                                    <div className="flex items-center gap-2">
                                        <span>{meta.icon}</span>
                                        <span className="text-sm font-semibold" style={{ color: entry.color }}>{entry.name}</span>
                                    </div>
                                    <span className="text-sm font-black tabular-nums">
                                        {entry.value.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold uppercase">{meta.unit}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    const getScoreColor = (score) => {
        const s = Number(score || 0);
        if (s >= 80) return '#10b981'; // green
        if (s >= 60) return '#f59e0b'; // amber
        return '#ef4444'; // red
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-black">
                    {(isPrincipal || isDean) ? 'Executive Consumption Insights' : 'Consumption Intelligence'}
                </h1>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchAnalytics}
                        className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                    </button>

                    {/* Time Range Filter (Visible to All Authorized Roles) */}
                    {(isPrincipal || isDean || !isPrincipal) && (
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            {['7d', '30d', '90d', '1y'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeRange === range ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    {range.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {resourcesForCharts.map((res) => {
                    const resName = res.resource || res.resource_type || res.name;
                    const stats = (activeSummary || []).find(s =>
                        (s.resource_type || s.resource || s.name || '').toLowerCase() === (resName || '').toLowerCase()
                    ) || { value: 0, unit: res.unit || 'units' };
                    const meta = getResourceMeta(resName);

                    return (
                        <Card key={res._id || resName} className="relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 p-3 items-center justify-center rounded-bl-3xl opacity-50 group-hover:scale-110 transition-transform`} style={{ backgroundColor: meta.bg }}>
                                <span className="text-lg leading-none">{meta.icon}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{resName}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold truncate">
                                        {safe(stats.value || stats.total).toLocaleString()}
                                    </span>
                                    <span className="text-xs text-slate-500">{stats.unit || res.unit}</span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Main Trends Chart */}
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <BarChart3 size={20} className="text-blue-500" /> Multi-Resource Trends
                    </h2>
                </div>
                <div className="h-[350px] w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-slate-400">Loading chart data...</div>
                    ) : (trendData || []).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    {resourcesForCharts.map((res, i) => (
                                        <linearGradient key={`grad-${i}`} id={`color-${res.name || res.resource_type}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={res.color || '#3B82F6'} stopOpacity={0.1} />
                                            <stop offset="95%" stopColor={res.color || '#3B82F6'} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 'bold' }} />

                                {resourcesForCharts.map((res) => {
                                    const rName = res.name || res.resource_type;
                                    return (
                                        <Area
                                            key={rName}
                                            type="monotone"
                                            dataKey={rName}
                                            name={rName}
                                            stroke={res.color || '#3B82F6'}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill={`url(#color-${rName})`}
                                            stackId="1"
                                            connectNulls
                                        />
                                    );
                                })}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Activity size={40} className="opacity-20" />
                            <p className="text-sm font-medium">No trend data available for this period</p>
                        </div>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribution Chart */}
                <Card>
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <PieIcon size={20} className="text-emerald-500" /> Resource Distribution
                    </h2>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Loading distribution...</div>
                        ) : activeSummary.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">No data available</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activeSummary}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) =>
                                            `${name} ${(percent * 100).toFixed(0)}%`
                                        }
                                    >
                                        {activeSummary.map((entry, index) => {
                                            const meta = getResourceMeta(entry.name);
                                            return (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={meta.color}
                                                />
                                            );
                                        })}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                                    />
                                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Block Comparison (Visible to All Authorized Roles) */}
                {true && (
                    <Card>
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                            <BarChart3 size={20} className="text-amber-500" /> Block Consumption (Monthly Cost)
                        </h2>
                        <div className="h-[300px]">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-slate-400">Loading comparison...</div>
                            ) : (blockComparison || []).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">No data found.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={blockRanking || blockComparison || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="block" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis
                                            stroke="var(--text-secondary)"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl shadow-black/10">
                                                            <p className="text-sm font-bold mb-1">{label}</p>
                                                            <p className="text-xs font-semibold text-blue-500">Efficiency: {data.score}%</p>
                                                            <p className="text-sm font-black text-slate-700 dark:text-slate-200 mt-1">Total: ₹{Number(data.totalCost || 0).toLocaleString()}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="totalCost" name="Total Cost" radius={[6, 6, 0, 0]}>
                                            {(blockRanking || blockComparison || []).map((entry, index) => {
                                                // Cycle through dynamic colors if we don't have enough resources
                                                const resColor = resourcesForCharts[index % resourcesForCharts.length]?.color || '#3b82f6';
                                                return (
                                                    <Cell key={`cell-${index}`} fill={resColor} />
                                                );
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </div >
    );
}
