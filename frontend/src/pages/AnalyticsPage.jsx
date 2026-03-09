import React, { useEffect, useState, useContext } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import { Activity, Database, Leaf } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import Card, { MetricCard } from '../components/common/Card';
import { logger } from '../utils/logger';

export default function AnalyticsPage() {
    const [period, setPeriod] = useState('monthly');
    const [range, setRange] = useState('monthly');
    const [loading, setLoading] = useState(true);
    const [chartsLoading, setChartsLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [resourceData, setResourceData] = useState({});
    const [error, setError] = useState(null);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    // Fetch summary stats (period-dependent)
    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await api.get(`/api/analytics/summary?period=${period}`);
                setSummary(res.data);
            } catch (err) {
                logger.error('Summary fetch error:', err);
            }
        };
        fetchSummary();
    }, [period]);

    // Fetch trend chart data (range-dependent)
    // Maps UI range labels to the integer `days` param the analytics controller expects
    const rangeToDays = { '7days': 7, '30days': 30, 'monthly': 30, 'all': 3650 };

    useEffect(() => {
        const fetchTrends = async () => {
            try {
                setChartsLoading(true);
                setError(null);

                // Call the trends endpoint with correct days parameter
                const days = rangeToDays[range] || 7;
                const url = `/api/analytics/trends?days=${days}`;

                const res = await api.get(url);
                const responseData = res.data;

                // Parse response from /api/analytics/trends which returns:
                // { success: true, trends: [{ resource: "Electricity", data: [{date, value, count}] }], period: {...} }
                const trends = responseData.trends || [];

                console.log('[Analytics] Trends from API:', trends);

                // Transform the trends array into grouped format
                const grouped = {};
                Object.keys(RESOURCE_COLORS).forEach(r => { grouped[r] = []; });

                // Process each resource's trend data
                trends.forEach(trendItem => {
                    const resource = trendItem.resource; // e.g., "Electricity"
                    if (grouped[resource] !== undefined && Array.isArray(trendItem.data)) {
                        grouped[resource] = trendItem.data.map(item => ({
                            date: item.date,
                            value: Number(item.value || 0)
                        }));
                    }
                });

                // Sort each resource's data by date
                Object.keys(grouped).forEach(key => {
                    grouped[key].sort((a, b) => new Date(a.date) - new Date(b.date));
                });

                setResourceData(grouped);
            } catch (err) {
                logger.error('Trends fetch error:', err);
                setError('Failed to load trend data.');
                setResourceData({});
            } finally {
                setChartsLoading(false);
                setLoading(false);
            }
        };
        fetchTrends();
    }, [range]);

    const RESOURCE_COLORS = {
        Electricity: '#F59E0B',  // amber
        Water: '#3B82F6',  // blue
        LPG: '#EF4444',  // red
        Diesel: '#6B7280',  // gray
        Solar: '#10B981',  // green
        Waste: '#8B5CF6',  // purple
    };

    const RESOURCE_UNITS = {
        Electricity: 'kWh',
        Water: 'L',
        LPG: 'kg',
        Diesel: 'L',
        Solar: 'kWh',
        Waste: 'kg',
    };

    if (loading) return (
        <div className="space-y-6">
            <div className="h-8 rounded" style={{ backgroundColor: 'var(--bg-hover)', width: '200px' }}></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-72 animate-pulse border border-gray-200 dark:border-gray-700">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6" />
                        <div className="h-48 bg-gray-100 dark:bg-gray-750 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );

    const rangeLabels = { '7days': '7 Days', '30days': '30 Days', 'monthly': 'This Month', 'all': 'All Time' };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Analytics &amp; Trends</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Detailed resource consumption analysis over time
                    </p>
                </div>

                {/* Period selector (affects summary cards) */}
                <div className="flex bg-white dark:bg-slate-800 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
                    {['daily', 'weekly', 'monthly'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${period === p
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    icon={<Activity size={20} />}
                    label="Total Usage"
                    value={summary?.current?.total?.toLocaleString() || 0}
                    change={summary?.percentageChange}
                />
                <MetricCard
                    icon={<Database size={20} />}
                    label="Records"
                    value={summary?.current?.records?.toLocaleString() || 0}
                />
                {
                    // Calculate averages for ALL resources
                    Object.entries(resourceData)
                        .map(([resource, data]) => {
                            const values = data.map(d => d.value || 0);
                            const avg = values.length > 0 ? (values.reduce((s, v) => s + v, 0) / values.length) : 0;
                            return { resource, avg };
                        })
                        // Sort by average descending
                        .sort((a, b) => b.avg - a.avg)
                        // Take top 2 that have data > 0, fallback to first 2 if none
                        .filter(item => item.avg > 0)
                        .slice(0, 2)
                        .concat(Object.entries(resourceData).map(([r]) => ({ resource: r, avg: 0 })).slice(0, 2))
                        // Remove duplicates from fallback
                        .filter((v, i, a) => a.findIndex(t => (t.resource === v.resource)) === i)
                        .slice(0, 2)
                        .map(({ resource, avg }) => {
                            const unit = RESOURCE_UNITS[resource] || 'units';
                            return (
                                <MetricCard
                                    key={resource}
                                    icon={<Leaf size={20} />}
                                    label={`Avg ${resource} (${rangeLabels[range]})`}
                                    value={<>{avg.toFixed(1)} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{unit}</span></>}
                                />
                            );
                        })
                }
            </div>

            {/* Range selector for charts */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Chart Range:</span>
                <div className="flex gap-2">
                    {[['7days', '7 Days'], ['30days', '30 Days'], ['monthly', 'This Month'], ['all', 'All Time']].map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => setRange(val)}
                            id={`range-btn-${val}`}
                            className={`px-3 py-1 rounded-md text-sm font-medium border transition-all ${range === val
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                            style={{ borderColor: range === val ? '#2563EB' : 'var(--border)' }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {chartsLoading && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Loading charts…
                    </span>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                    {error}
                </div>
            )}

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chartsLoading ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 h-72 animate-pulse border border-gray-200 dark:border-gray-700">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6" />
                            <div className="h-48 bg-gray-100 dark:bg-gray-750 rounded" />
                        </div>
                    ))
                ) : (
                    Object.entries(resourceData).map(([resource, data]) => (
                        <div key={resource} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                            {/* Chart Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        {resource} Trend
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {rangeLabels[range]} · {data.length} records · Unit: {RESOURCE_UNITS[resource] || 'units'}
                                    </p>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {data.length > 0
                                        ? `${data.reduce((s, d) => s + d.value, 0).toFixed(1)} ${RESOURCE_UNITS[resource] || ''}`
                                        : 'No data'
                                    }
                                </span>
                            </div>

                            {/* Chart or Empty State */}
                            {data.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={data}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            stroke="#9CA3AF"
                                            tick={{ fontSize: 10 }}
                                        />
                                        <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} unit={` ${RESOURCE_UNITS[resource] || ''}`} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1F2937',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: '#F9FAFB',
                                                fontSize: '12px'
                                            }}
                                            formatter={(val) => [`${val} ${RESOURCE_UNITS[resource] || ''}`, resource]}
                                            labelFormatter={(l) => new Date(l).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke={RESOURCE_COLORS[resource] || '#3B82F6'}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-600">
                                    <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <p className="text-sm font-medium">No data yet</p>
                                    <p className="text-xs mt-1 text-center">Log {resource} usage to see chart</p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
