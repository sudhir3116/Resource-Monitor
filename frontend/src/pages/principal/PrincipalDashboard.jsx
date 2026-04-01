import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
    Activity, Bell, RefreshCw, TrendingUp, PieChart as PieChartIcon,
    Settings, AlertTriangle, Building2, ShieldCheck, ShieldAlert,
    ArrowUpRight, ArrowDownRight, IndianRupee, MessageSquare
} from 'lucide-react';
import Card from '../../components/common/Card';
import MetricCard from '../../components/common/MetricCard';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DonutChart from '../../components/analytics/DonutChart';
import { useResources } from '../../hooks/useResources';

const PrincipalDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const { resources } = useResources();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/api/dashboard');
            if (res.data?.success) {
                setDashboardData(res.data.data);
            }
        } catch (err) {
            console.error('Principal Dashboard Error:', err.response?.data || err.message);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading && !dashboardData) {
        return (
            <div className="p-6 space-y-6">
                <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                <ShieldAlert size={48} className="text-rose-500 mb-4 opacity-20" />
                <p className="text-rose-500 font-semibold mb-4">{error}</p>
                <Button onClick={fetchData}>Retry</Button>
            </div>
        );
    }

    const {
        summary = {},
        grandTotal = 0,
        trendsOverTime = [],
        blockRanking = [],
        totalBlocks = 0,
        activeCampusAlerts = 0,
        criticalAlerts = [],
        recentComplaints = [],
        financial = {}
    } = dashboardData || {};

    // Logic for Quick Insights
    const mostUsed = Object.entries(summary).reduce((max, [name, total]) => {
        if (!max || total > max.total) return { name, total };
        return max;
    }, null);

    const highestBlock = blockRanking.length > 0 ? blockRanking[0] : null;
    const systemStatus = activeCampusAlerts > 5 ? 'Warning' : 'Healthy';

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            {/* Executive Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                        Executive Overview
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Principal's Monitoring Desk &bull; Campus Resource Distribution
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className={`h-2.5 w-2.5 rounded-full ${systemStatus === 'Healthy' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                        <span className="text-sm font-bold opacity-80 uppercase tracking-widest">System {systemStatus}</span>
                    </div>
                    <Button variant="secondary" className="!rounded-2xl" onClick={fetchData}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Primary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<Settings size={22} className="text-emerald-500" />}
                    label="Total Configured Resources"
                    value={dashboardData?.totalResources || resources?.length || 0}
                    colorClass="text-emerald-500"
                />
                <MetricCard
                    icon={<Activity size={22} className="text-blue-500" />}
                    label="Active Campus Usage"
                    value={grandTotal.toLocaleString()}
                    colorClass="text-blue-500"
                />
                <MetricCard
                    icon={<AlertTriangle size={22} className="text-rose-500" />}
                    label="Pending Alerts"
                    value={activeCampusAlerts}
                    colorClass={activeCampusAlerts > 0 ? 'text-rose-500' : 'text-slate-400'}
                />
                <MetricCard
                    icon={<Building2 size={22} className="text-indigo-500" />}
                    label="Monitored Blocks"
                    value={totalBlocks}
                    colorClass="text-indigo-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Trends */}
                <Card className="lg:col-span-2 shadow-xl border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white" title="Consumption Intelligence" icon={<TrendingUp size={20} className="text-blue-400" />}>
                    <div className="h-[350px] mt-6">
                        {trendsOverTime.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendsOverTime}>
                                    <defs>
                                        <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        stroke="rgba(255,255,255,0.4)"
                                    />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: '900' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#3B82F6"
                                        fill="url(#usageGradient)"
                                        strokeWidth={4}
                                        dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
                                        activeDot={{ r: 8, strokeWidth: 0, fill: '#fff' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                                <Activity size={48} className="mb-2 opacity-20" />
                                <p>No real-time usage data detected</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Quick Insights Card */}
                <Card title="Quick Insights" icon={<ShieldCheck size={20} className="text-emerald-500" />}>
                    <div className="space-y-6 py-2">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Most Consumed</p>
                                <p className="text-lg font-bold">{mostUsed?.name || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heavy Load Block</p>
                                <p className="text-lg font-bold">{highestBlock?.name || 'All Stable'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                <IndianRupee size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Est. Monthly Cost</p>
                                <p className="text-lg font-bold">₹{(financial.estimatedCost || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className={`p-4 rounded-2xl ${systemStatus === 'Healthy' ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-600' : 'bg-rose-500/5 border border-rose-500/20 text-rose-600'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {systemStatus === 'Healthy' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                                    <span className="font-black text-xs uppercase tracking-tighter">Campus Status</span>
                                </div>
                                <p className="text-sm font-medium opacity-80">
                                    {systemStatus === 'Healthy'
                                        ? 'All resources functioning within normal thresholds.'
                                        : `${activeCampusAlerts} anomalies detected across blocks.`}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Role-Specific Resource Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(summary).map(([name, total]) => {
                    const res = resources?.find(r => r.name === name) || {};
                    return (
                        <div key={name} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                            <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 group-hover:scale-[2] transition-transform text-slate-400">
                                {res.icon || <Activity size={40} />}
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{name}</p>
                            <p className="text-2xl font-black truncate">{total.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-slate-500">{res.unit || 'units'}</p>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

export default PrincipalDashboard;
