import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
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
    LineChart,
    Line,
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
    Pie
} from 'recharts';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import { getSocket } from '../utils/socket';


export default function AnalyticsPage() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [summaryData, setSummaryData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [dynamicResources, setDynamicResources] = useState([]);
    const [blockComparison, setBlockComparison] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: usageRes } = await api.get("/api/usage");
            const { data: resourcesRes } = await api.get("/api/resources");

            const usage = usageRes?.data || usageRes || [];
            const resources = resourcesRes?.data || resourcesRes || [];

            setDynamicResources(resources.filter(r => r?.status === "active"));

            // Map and group by date for charts (Normalize to YYYY-MM-DD)
            const dates = Array.from(new Set(usage.map(u => {
                const raw = u.date || u.usage_date;
                return typeof raw === 'string' ? raw.split('T')[0] : new Date(raw).toISOString().split('T')[0];
            }))).sort();

            const pivotedTrendData = dates.map(date => {
                const row = { date };
                resources.forEach(r => {
                    const total = usage
                        .filter(u => {
                            const uDate = typeof (u.date || u.usage_date) === 'string'
                                ? (u.date || u.usage_date).split('T')[0]
                                : new Date(u.date || u.usage_date).toISOString().split('T')[0];
                            const uRes = (u.resource || u.resourceId || u.resource_type);
                            return uDate === date && (uRes === r._id || uRes === r.name);
                        })
                        .reduce((sum, u) => sum + Number(u.amount || u.usage_value || 0), 0);
                    row[r.name] = total;
                });
                return row;
            });

            setTrendData(pivotedTrendData);

            // Mapping for summary
            const grouped = pivotedTrendData.reduce((acc, row) => {
                resources.forEach(r => {
                    if (!acc[r.name]) acc[r.name] = { resource: r.name, total: 0, unit: r.unit || 'units' };
                    acc[r.name].total += row[r.name] || 0;
                });
                return acc;
            }, {});

            setSummaryData(Object.entries(grouped).map(([key, val]) => ({
                resource: key,
                current: val.total,
                unit: val.unit
            })));

        } catch (err) {
            logger.error('Failed to fetch analytics data', err);
            addToast('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchData();
        const socket = getSocket();
        const refresh = () => fetchData();
        if (socket) {
            socket.on('usage:refresh', refresh);
            socket.on('alerts:refresh', refresh);
            socket.on('dashboard:refresh', refresh);
            socket.on('resources:refresh', refresh);
            socket.on('usage:added', refresh);
        }

        window.addEventListener('usage:added', refresh);

        return () => {
            if (socket) {
                socket.off('usage:refresh', refresh);
                socket.off('alerts:refresh', refresh);
                socket.off('dashboard:refresh', refresh);
                socket.off('resources:refresh', refresh);
                socket.off('usage:added', refresh);
            }
            window.removeEventListener('usage:added', refresh);
        };
    }, [fetchData]);

    const resourcesForCharts = useMemo(() => {
        if (Array.isArray(dynamicResources) && dynamicResources.length > 0) return dynamicResources;
        // Fallback: build resource list from the usage summary so charts don't go empty
        // when config thresholds are temporarily missing/empty.
        return (Array.isArray(summaryData) ? summaryData : []).map(s => ({
            _id: s.resource,
            resource: s.resource,
            name: s.resource,
            unit: s.unit
        }));
    }, [dynamicResources, summaryData]);

    const activeSummary = useMemo(() => {
        const activeResourceNames = resourcesForCharts.map(r => r.resource || r.name);
        return summaryData.filter(s => activeResourceNames.includes(s.resource));
    }, [summaryData, resourcesForCharts]);

    const selectedRange = parseInt(timeRange) || 7;
    const filteredData = useMemo(() => {
        return trendData.filter((d) => {
            const days = selectedRange;
            return new Date(d.date) >= new Date(Date.now() - days * 86400000);
        });
    }, [trendData, selectedRange]);

    const hasData = filteredData && filteredData.length > 0;
    const trendSeries = useMemo(
        () => resourcesForCharts.map(r => r.resource || r.name).filter(Boolean),
        [resourcesForCharts]
    );

    const hasAnyTrendSeriesData = useMemo(() => {
        return hasData;
    }, [hasData]);

    const getResourceMeta = (type) => {
        const res = (Array.isArray(resourcesForCharts) ? resourcesForCharts : [])
            .find(r => (r?.name || r?.resource) === type);
        return {
            icon: res?.icon || '📊',
            color: res?.color || '#64748b',
            bg: (res?.color || '#64748b') + '15',
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
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <TrendingUp size={28} className="text-blue-500" /> Consumption Analytics
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Historical trends and summary of hostel resource usage
                    </p>
                </div>
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
                    <Button variant="secondary" size="sm" onClick={fetchData} className="ml-2">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {resourcesForCharts.map((res) => {
                    const resName = res.resource || res.name;
                    const stats = activeSummary.find(s => s.resource === resName) || { current: 0, change: 0, unit: res.unit || 'units' };
                    const meta = getResourceMeta(resName);
                    const isNegative = stats.change < 0;

                    return (
                        <Card key={res._id || res.name} className="relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 p-3 items-center justify-center rounded-bl-3xl opacity-50 group-hover:scale-110 transition-transform`} style={{ backgroundColor: meta.bg }}>
                                <span className="text-lg leading-none">{meta.icon}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{res?.name || "Unknown"}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold truncate">
                                        {stats.current > 0 ? stats.current.toLocaleString() : 'No data available'}
                                    </span>
                                    {stats.current > 0 && <span className="text-xs text-slate-500">{stats.unit}</span>}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Main Trends Chart */}
            < Card >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <BarChart3 size={20} className="text-blue-500" /> Usage Trends Over Time
                    </h2>
                    <div className="flex items-center gap-4 text-xs">
                        {resourcesForCharts.map((res, i) => {
                            const resName = res.resource || res.name;
                            return (
                                <div key={resName} className="flex items-center gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getResourceMeta(resName).color }}></div>
                                    <span className="text-slate-500 font-medium">{resName}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="h-[300px] w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-slate-400">Loading chart data...</div>
                    ) : hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData}>
                                <defs>
                                    {trendSeries.map((resName) => {
                                        return (
                                            <linearGradient key={resName} id={`color${resName}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={getResourceMeta(resName).color} stopOpacity={0.1} />
                                                <stop offset="95%" stopColor={getResourceMeta(resName).color} stopOpacity={0} />
                                            </linearGradient>
                                        );
                                    })}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="date"
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
                                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {trendSeries.map((resName) => {
                                    const meta = getResourceMeta(resName);
                                    return (
                                        <Area
                                            key={resName}
                                            type="monotone"
                                            dataKey={resName}
                                            stroke={meta.color}
                                            fillOpacity={1}
                                            fill={`url(#color${resName})`}
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    );
                                })}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-gray-400 text-sm flex items-center justify-center h-full">
                            No data available
                        </p>
                    )}
                </div>
            </Card >

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
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">No data found.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activeSummary}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="current"
                                        nameKey="resource"
                                    >
                                        {activeSummary.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getResourceMeta(entry.resource).color} />
                                        ))}
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

                {/* Block Comparison */}
                <Card>
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <BarChart3 size={20} className="text-amber-500" /> Block Comparison
                    </h2>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Loading comparison...</div>
                        ) : (blockComparison || []).length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">No data found.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={blockComparison || []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="block" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                                    />
                                    <Bar dataKey="score" name="Efficiency Score" radius={[6, 6, 0, 0]}>
                                        {(blockComparison || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>
        </div >
    );
}
