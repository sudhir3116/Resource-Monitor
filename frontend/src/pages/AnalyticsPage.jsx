import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    Zap,
    Droplets,
    Flame,
    Wind,
    Utensils,
    Trash2,
    Activity,
    BarChart3,
    PieChart as PieIcon,
    Filter,
    RefreshCw,
    Info,
    Sun
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


const RESOURCE_META = {
    Electricity: { icon: <Zap size={20} />, color: '#f59e0b', bg: 'bg-amber-500/10' },
    Water: { icon: <Droplets size={20} />, color: '#3b82f6', bg: 'bg-blue-500/10' },
    Solar: { icon: <Sun size={20} />, color: '#eab308', bg: 'bg-yellow-500/10' },
    LPG: { icon: <Flame size={20} />, color: '#f97316', bg: 'bg-orange-500/10' },
    Diesel: { icon: <Wind size={20} />, color: '#64748b', bg: 'bg-slate-500/10' },
    Food: { icon: <Utensils size={20} />, color: '#10b981', bg: 'bg-emerald-500/10' },
    Waste: { icon: <Trash2 size={20} />, color: '#ef4444', bg: 'bg-rose-500/10' },
};

export default function AnalyticsPage() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [summaryData, setSummaryData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [dynamicResources, setDynamicResources] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [configRes, summaryRes, trendRes] = await Promise.all([
                api.get('/api/resource-config'),
                api.get('/api/usage/summary'),
                api.get(`/api/usage/trends?range=${timeRange}`)
            ]);

            const activeConfigs = (configRes.data.data || configRes.data.resources || []).filter(c => c.isActive !== false);
            setDynamicResources(activeConfigs);

            const summaryDataObj = summaryRes.data?.data?.summary || {};
            const mappedSummary = Object.entries(summaryDataObj).map(([key, val]) => ({
                resource: key,
                current: val.total || 0,
                change: 0,
                unit: val.unit || 'units'
            }));

            setSummaryData(mappedSummary);
            setTrendData(trendRes.data.data || []);
        } catch (err) {
            logger.error('Failed to fetch analytics data', err);
            addToast('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    }, [timeRange, addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const activeSummary = useMemo(() => {
        const activeResourceNames = dynamicResources.map(r => r.name);
        return summaryData.filter(s => activeResourceNames.includes(s.resource));
    }, [summaryData, dynamicResources]);

    const getResourceMeta = (type) => {
        return RESOURCE_META[type] || { icon: <Activity size={20} />, color: '#64748b', bg: 'bg-slate-500/10' };
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
                {dynamicResources.map((res) => {
                    const resName = res.name;
                    const stats = activeSummary.find(s => s.resource === resName) || { current: 0, change: 0, unit: res.unit || 'units' };
                    const meta = getResourceMeta(resName);
                    const isNegative = stats.change < 0;

                    return (
                        <Card key={res._id || res.name} className="relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 p-3 ${meta.bg} rounded-bl-3xl opacity-50 group-hover:scale-110 transition-transform`}>
                                {meta.icon}
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{resName}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold truncate">
                                        {stats.current > 0 ? stats.current.toLocaleString() : 'No data available'}
                                    </span>
                                    {stats.current > 0 && <span className="text-xs text-slate-500">{stats.unit}</span>}
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-medium ${isNegative ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {isNegative ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                    {Math.abs(stats.change)}% vs last period
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
                        <BarChart3 size={20} className="text-blue-500" /> Usage Trends Over Time
                    </h2>
                    <div className="flex items-center gap-4 text-xs">
                        {dynamicResources.map((res, i) => {
                            const resName = res.name;
                            return (
                                <div key={resName} className="flex items-center gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getResourceMeta(resName).color }}></div>
                                    <span className="text-slate-500 font-medium">{resName}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="h-[400px] w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-slate-400">Loading chart data...</div>
                    ) : trendData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Info size={40} className="mb-2 opacity-20" />
                            No trend data available for this period.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    {dynamicResources.map((res, i) => {
                                        const resName = res.name;
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
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ marginBottom: '8px', fontWeight: 'bold' }}
                                />
                                {dynamicResources.map((res) => {
                                    const resName = res.name;
                                    return (
                                        <Area
                                            key={resName}
                                            type="monotone"
                                            dataKey={resName}
                                            stroke={getResourceMeta(resName).color}
                                            fillOpacity={1}
                                            fill={`url(#color${resName})`}
                                            strokeWidth={3}
                                            dot={false}
                                        />
                                    );
                                })}
                            </AreaChart>
                        </ResponsiveContainer>
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

                {/* Efficiency/Threshold Comparison */}
                <Card>
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                        <BarChart3 size={20} className="text-amber-500" /> Usage vs Recommended Threshold
                    </h2>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Loading comparison...</div>
                        ) : activeSummary.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">No data found.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeSummary}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="resource" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                                    />
                                    <Bar dataKey="current" name="Current Usage" radius={[6, 6, 0, 0]}>
                                        {activeSummary.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getResourceMeta(entry.resource).color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
