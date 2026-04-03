import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
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
            const data = res.data.data || res.data || {};

            if (res.data?.success || data) {
                // FIX DATA MAPPING (Executive API consistency)
                setSummaryData(data);

                // Safe trend mapping
                const rawTrends = data.trendsOverTime || data.trends || [];
                setTrendData(Array.isArray(rawTrends) ? rawTrends : []);

                // Safe alert count
                setActiveAlerts(data.activeCampusAlerts || data.alertsCount || 0);

                // Safe alerts list
                setRecentAlerts(Array.isArray(data.criticalAlerts) ? data.criticalAlerts : []);

                setTotalBlocks(data.totalBlocks || 0);
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
    const totalCost = summaryData?.estimatedCost || Object.values(summary).reduce((acc, data) => {
        const val = typeof data === 'number' ? 0 : (data?.totalCost || 0);
        return acc + val;
    }, 0);

    const mostUsed = Object.entries(summary).reduce((max, [name, data]) => {
        const val = typeof data === 'number' ? data : (data?.total || 0);
        if (!max || val > max.value) return { name, value: val, data };
        return max;
    }, null);

    const distributionData = Object.entries(summary)
        .map(([name, data]) => ({
            name,
            value: typeof data === 'number' ? data : (data?.total || data?.current || 0)
        }))
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

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                {/* Critical Alerts / Recent Activity Section */}
                <Card title="Critical Incidents Watchlist" icon={<AlertTriangle size={20} className="text-rose-500" />}>
                    <div className="space-y-4 mt-4">
                        {(recentAlerts || []).length > 0 ? (
                            recentAlerts.map(alert => (
                                <div key={alert._id} className="flex items-center justify-between p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-rose-500 shadow-sm group-hover:scale-110 transition-transform">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-rose-100 truncate max-w-[200px]">{alert.title || alert.message}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{alert.block?.name || 'Campus'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="danger">{alert.severity}</Badge>
                                        <span className="text-[10px] text-slate-400 font-bold tabular-nums">{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center opacity-30 italic text-sm">
                                <Activity size={32} className="mb-2" />
                                All systems currently nominal. No active critical incidents.
                            </div>
                        )}
                        <Button variant="secondary" size="sm" fullWidth className="!rounded-xl text-[10px] font-black uppercase tracking-tighter" onClick={() => navigate('/gm/alerts')}>
                            Manage Operational Alerts &rarr;
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default GMDashboard;
