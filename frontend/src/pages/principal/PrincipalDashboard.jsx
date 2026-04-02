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
import { getSocket } from '../../utils/socket';

const PrincipalDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const { resources } = useResources();
    const [summaryData, setSummaryData] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeAlerts, setActiveAlerts] = useState(0);
    const [totalBlocks, setTotalBlocks] = useState(0);
    const [criticalAlerts, setCriticalAlerts] = useState([]);
    const [recentComplaints, setRecentComplaints] = useState([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/api/dashboard');
            if (res.data?.success) {
                const data = res.data.data;
                setSummaryData(data);
                setTrendData(data.trendsOverTime || []);
                setActiveAlerts(data.activeCampusAlerts || 0);
                setTotalBlocks(data.totalBlocks || 0);
                setCriticalAlerts(data.criticalAlerts || []);
                setRecentComplaints(data.recentComplaints || []);
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

        const refresh = () => fetchData();
        const socket = getSocket();

        if (socket) {
            socket.on('usage:added', refresh);
            socket.on('dashboard:refresh', refresh);
            socket.on('usage:refresh', refresh);
        }

        return () => {
            if (socket) {
                socket.off('usage:added', refresh);
                socket.off('dashboard:refresh', refresh);
                socket.off('usage:refresh', refresh);
            }
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
            <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                <ShieldAlert size={48} className="text-rose-500 mb-4 opacity-20" />
                <p className="text-rose-500 font-semibold mb-4">{error}</p>
                <Button onClick={fetchData}>Retry</Button>
            </div>
        );
    }

    const summary = summaryData?.summary || {};
    const grandTotal = summaryData?.grandTotal || 0;
    const trendDataSafe = Array.isArray(trendData) ? trendData : [];

    const distributionData = Object.entries(summary)
        .map(([name, data]) => ({
            name,
            value: typeof data === 'number' ? data : (data?.total ?? data?.current ?? 0)
        }))
        .filter(d => d.value > 0);

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto text-slate-900 dark:text-white">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">
                        Principal Executive Desk
                    </h1>
                    <p className="text-slate-500 mt-1 dark:text-slate-400">
                        Campus-wide operational intelligence and resource distribution
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={activeAlerts > 0 ? "danger" : "success"} className="px-4 py-1 flex items-center gap-2">
                        <Bell size={14} /> {activeAlerts} Active Alerts
                    </Badge>
                    <Button variant="secondary" size="md" onClick={fetchData} className="!rounded-xl">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<Settings size={22} className="text-emerald-500" />}
                    label="Total Configured Resources"
                    value={summaryData?.totalResources || resources?.length || 0}
                />
                <MetricCard
                    icon={<Activity size={22} className="text-blue-500" />}
                    label="Campus Usage"
                    value={grandTotal > 0 ? grandTotal.toLocaleString() : '0'}
                />
                <MetricCard
                    icon={<AlertTriangle size={22} className="text-rose-500" />}
                    label="Active Alerts"
                    value={activeAlerts}
                />
                <MetricCard
                    icon={<Building2 size={22} className="text-indigo-500" />}
                    label="Monitored Blocks"
                    value={totalBlocks}
                />
            </div>

            {/* Resource Specific Cards (Like Dean) */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                <Card title="Executive Watchlist (Critical Alerts)" icon={<AlertTriangle size={20} className="text-rose-500" />}>
                    <div className="space-y-4 mt-4">
                        {(criticalAlerts || []).length > 0 ? (
                            criticalAlerts.map(alert => (
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
                                    <Badge variant="danger">{alert.severity}</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center opacity-30 italic text-sm">
                                <ShieldCheck size={32} className="mb-2" />
                                Campus operations are currently stable. No critical alerts.
                            </div>
                        )}
                        <Button variant="secondary" size="sm" fullWidth className="!rounded-xl text-[10px] font-black uppercase tracking-tighter" onClick={() => navigate('/principal/alerts')}>
                            Manage Operational Alerts &rarr;
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Bottom Row: Alerts and Complaints */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Executive Watchlist (Alerts)" icon={<AlertTriangle size={20} className="text-rose-500" />}>
                    <div className="space-y-4 mt-4">
                        {(criticalAlerts || []).length > 0 ? (
                            criticalAlerts.map(alert => (
                                <div key={alert._id} className="flex items-center justify-between p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-rose-500 shadow-sm">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-rose-100">{alert.title || alert.message}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{alert.block?.name || 'Campus'}</p>
                                        </div>
                                    </div>
                                    <Badge variant="danger">{alert.severity}</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center opacity-30 italic text-sm">
                                <ShieldCheck size={32} className="mb-2" />
                                All systems currently nominal
                            </div>
                        )}
                    </div>
                </Card>

                <Card title="Student Grievances" icon={<MessageSquare size={20} className="text-indigo-500" />}>
                    <div className="space-y-4 mt-4">
                        {(recentComplaints || []).length > 0 ? (
                            recentComplaints.map(complaint => (
                                <div key={complaint._id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-500 shadow-sm">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{complaint.title || complaint.subject}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">From: {complaint.userId?.name || 'Anonymous'}</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="font-black text-[9px]">{complaint.status}</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center opacity-30 italic text-sm">
                                <MessageSquare size={32} className="mb-2" />
                                No pending student grievances
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default PrincipalDashboard;
