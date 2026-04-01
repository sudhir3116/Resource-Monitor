import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
    Zap, Droplets, Flame, Wind, Sun, Trash2,
    RefreshCw, TrendingUp, TrendingDown,
    PieChart as PieChartIcon, Activity, Bell, History
} from 'lucide-react';
import Card from '../../components/common/Card';
import MetricCard from '../../components/common/MetricCard';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2, Settings, AlertTriangle } from 'lucide-react';
import DonutChart from '../../components/analytics/DonutChart';
import { logger } from '../../utils/logger';
import { getSocket } from '../../utils/socket';
import { useResources } from '../../hooks/useResources';

const GMDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const { resources } = useResources();  // Get active resources from single source
    const [summaryData, setSummaryData] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeAlerts, setActiveAlerts] = useState(0);
    const [recentActivity, setRecentActivity] = useState(0);
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [recentComplaints, setRecentComplaints] = useState([]);
    const [totalBlocks, setTotalBlocks] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log("Fetching dashboard data for:", user?.role);
            const res = await api.get('/api/dashboard');

            if (res.data?.success) {
                const data = res.data.data;
                setSummaryData(data.trends || {}); // Mapping consolidated trends to summary
                setTrendData(Array.isArray(data.blockRanking) ? data.blockRanking : []);
                setActiveAlerts(data.activeCampusAlerts || 0);
                setRecentAlerts(data.criticalAlerts || []);
                setTotalBlocks(Array.isArray(data.blockRanking) ? data.blockRanking.length : 0);
                setSummaryData(prev => ({
                    ...prev,
                    financial: data.financial
                }));
            }
        } catch (err) {
            console.error('GM Dashboard Error:', err.response?.data || err.message);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time updates: usage/alerts affect dashboard KPIs and charts.
    useEffect(() => {
        const socket = getSocket();
        const refresh = () => fetchData();
        if (!socket) return;

        socket.on('usage:refresh', refresh);
        socket.on('alerts:refresh', refresh);
        socket.on('dashboard:refresh', refresh);
        socket.on('resources:refresh', refresh);
        socket.on('usage:added', refresh);

        window.addEventListener('usage:added', refresh);

        return () => {
            socket.off('usage:refresh', refresh);
            socket.off('alerts:refresh', refresh);
            socket.off('dashboard:refresh', refresh);
            socket.off('resources:refresh', refresh);
            socket.off('usage:added', refresh);
            window.removeEventListener('usage:added', refresh);
        };
    }, [fetchData]);

    if (loading && !summaryData) {
        return (
            <div className="p-6 space-y-6">
                <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 flex flex-col items-center justify-center">
                <p className="text-rose-500 font-semibold mb-4">{error}</p>
                <Button onClick={fetchData}>Retry</Button>
            </div>
        );
    }


    const summary = summaryData?.summary || {};
    const grandTotal = summaryData?.grandTotal || 0;
    const totalCost = Object.values(summary).reduce((acc, data) => acc + (data?.totalCost || 0), 0);
    const mostUsed = Object.entries(summary).reduce((max, [name, data]) => {
        if (!max || (data?.total || 0) > (max.data?.total || 0)) return { name, data };
        return max;
    }, null);

    const distributionData = Object.entries(summary)
        .map(([name, data]) => ({ name, value: data?.total || 0 }))
        .filter(d => typeof d.value === 'number' && d.value > 0);

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        General Manager Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Campus-wide resource monitoring and analytics
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/gm/usage')}>
                        View Detailed Usage &rarr;
                    </Button>
                    <Badge variant={activeAlerts > 0 ? "danger" : "success"} className="px-4 py-1 flex items-center gap-2">
                        <Bell size={14} /> {activeAlerts} Active Alerts
                    </Badge>
                    <Button variant="secondary" size="sm" onClick={fetchData}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<Settings size={22} className="text-emerald-500" />}
                    label="Total Resources"
                    value={resources?.length || 0}
                />
                <MetricCard
                    icon={<Activity size={22} className="text-blue-500" />}
                    label="Total Usage"
                    value={grandTotal > 0 ? grandTotal.toLocaleString() : '0'}
                />
                <MetricCard
                    icon={<AlertTriangle size={22} className="text-rose-500" />}
                    label="Active Alerts"
                    value={activeAlerts}
                    colorClass={activeAlerts > 0 ? 'text-rose-500' : 'text-slate-400'}
                    trend={activeAlerts > 0 ? 'negative' : 'none'}
                />
                <MetricCard
                    icon={<Building2 size={22} className="text-indigo-500" />}
                    label="Total Blocks"
                    value={totalBlocks}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {Object.entries(summary || {}).map(([name, data]) => {
                    const resource = (resources || []).find(r => r.name === name) || {};
                    return (
                        <MetricCard
                            key={name}
                            icon={<span className="text-xl" style={{ color: resource.color }}>{resource.icon || '📊'}</span>}
                            label={name}
                            value={data.total > 0 ? `${data.total.toLocaleString()} ${resource.unit || ''}` : 'No data'}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2" title="Resource Consumption Trends" icon={<TrendingUp size={20} />}>
                    <div className="h-[350px] mt-6">
                        {(Array.isArray(trendData) ? trendData : []).length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: '900' }}
                                    />
                                    {Object.entries(summary || {}).map(([name, data]) => {
                                        const res = resources.find(r => r.name === name) || {};
                                        return (
                                            <Area
                                                key={name}
                                                type="monotone"
                                                dataKey={name}
                                                stroke={res.color || '#64748b'}
                                                fill={res.color || '#64748b'}
                                                fillOpacity={0.05}
                                                strokeWidth={3}
                                                dot={false}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                            />
                                        );
                                    })}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Activity size={48} className="mb-2 opacity-20" />
                                <p>No trend data available for this week</p>
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Usage Distribution" icon={<PieChartIcon size={20} />}>
                    <div className="h-[350px] mt-6">
                        {(Array.isArray(distributionData) ? distributionData : []).length > 0 ? (
                            <>
                                {/* DonutChart expects data: [{resource, value}], resources: full resource list */}
                                <DonutChart
                                    data={distributionData.map(d => ({ resource: d.name, value: d.value }))}
                                    resources={resources}
                                    height={320}
                                />
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                <p>No data to display in breakdown</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default GMDashboard;
