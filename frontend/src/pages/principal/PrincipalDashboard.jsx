import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../services/api';
import {
    Zap,
    Droplets,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Building2,
    Activity,
    Flame,
    Wind,
    Utensils,
    Trash2,
    RefreshCw,
    Filter,
    ChevronDown,
    Sun
} from 'lucide-react';
import Card, { MetricCard } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { logger } from '../../utils/logger';
import useSortableTable from '../../hooks/useSortableTable';
import SortIcon from '../../components/common/SortIcon';
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

const RESOURCE_META = {
    Electricity: { icon: <Zap size={20} />, color: '#f59e0b', bg: 'bg-amber-500/10' },
    Water: { icon: <Droplets size={20} />, color: '#3b82f6', bg: 'bg-blue-500/10' },
    Solar: { icon: <Sun size={20} />, color: '#eab308', bg: 'bg-yellow-500/10' },
    LPG: { icon: <Flame size={20} />, color: '#f97316', bg: 'bg-orange-500/10' },
    Diesel: { icon: <Wind size={20} />, color: '#64748b', bg: 'bg-slate-500/10' },
    Waste: { icon: <Trash2 size={20} />, color: '#ef4444', bg: 'bg-rose-500/10' },
};

export default function PrincipalDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dynamicResources, setDynamicResources] = useState([]);
    const [timeRange, setTimeRange] = useState('7d');
    const [trendData, setTrendData] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [usageSummary, setUsageSummary] = useState({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [configRes, summaryRes, trendRes, leaderboardRes] = await Promise.allSettled([
                api.get('/api/resource-config'),
                api.get('/api/usage/summary'),
                api.get(`/api/usage/trends?range=${timeRange}`),
                api.get('/api/analytics/leaderboard')
            ]);

            if (configRes.status === 'fulfilled') {
                const configs = configRes.value.data?.data || configRes.value.data?.resources || [];
                setDynamicResources(configs.filter(r => r.isActive !== false));
            }

            if (summaryRes.status === 'fulfilled') {
                const sumData = summaryRes.value.data?.data?.summary || {};
                setUsageSummary(sumData);
                setStats({ trends: {} }); // kept for costStats / loading guard
            }

            if (trendRes.status === 'fulfilled') {
                const raw = trendRes.value.data?.data;
                setTrendData(Array.isArray(raw) ? raw : []);
            }

            if (leaderboardRes.status === 'fulfilled') {
                setLeaderboard(leaderboardRes.value.data.data || leaderboardRes.value.data?.leaderboard || []);
            }
        } catch (err) {
            logger.error("Failed to fetch principal dashboard data", err);
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const { sortedData: sortedLeaderboard, sortField, sortDirection, handleSort } = useSortableTable(
        leaderboard,
        'principal-leaderboard'
    );

    const getResourceMeta = (type) => {
        return RESOURCE_META[type] || { icon: <Activity size={20} />, color: '#64748b', bg: 'bg-slate-500/10' };
    };

    const costStats = useMemo(() => {
        if (!stats?.financial) return { total: 0, change: 0 };
        return {
            total: parseFloat(stats.financial.estimatedCost || 0),
            change: parseFloat(stats.financial.percentageChange || 0)
        };
    }, [stats]);

    const distributionData = useMemo(() => {
        return Object.entries(usageSummary)
            .map(([name, data]) => ({ name, value: data.total || 0 }))
            .filter(d => d.value > 0);
    }, [usageSummary]);

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
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        Principal's Insights
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Campus-wide summary of resource consumption
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <Card className="relative overflow-hidden group border-l-4 border-emerald-500">
                    <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 rounded-bl-3xl opacity-50">
                        <DollarSign size={24} className="text-emerald-500" />
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Total Cost</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">₹{costStats.total.toLocaleString()}</span>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-medium ${costStats.change <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {costStats.change <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                            {Math.abs(costStats.change)}% vs last period
                        </div>
                    </div>
                </Card>

            </div>

            {/* Full resource cards grid for Principal */}
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
                                <AreaChart data={trendData}>
                                    <defs>
                                        {dynamicResources.map(res => (
                                            <linearGradient key={res._id || res.name} id={`colorP${res.name}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={getResourceMeta(res.name).color} stopOpacity={0.1} />
                                                <stop offset="95%" stopColor={getResourceMeta(res.name).color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="var(--text-secondary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => {
                                            try { return new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
                                            catch { return val; }
                                        }}
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
                                    {dynamicResources.map(res => (
                                        <Area
                                            key={res._id || res.name}
                                            type="monotone"
                                            dataKey={res.name}
                                            stroke={getResourceMeta(res.name).color}
                                            fillOpacity={1}
                                            fill={`url(#colorP${res.name})`}
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


        </div>
    );
}
