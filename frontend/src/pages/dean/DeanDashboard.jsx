import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
    Activity, Bell, RefreshCw, TrendingUp, PieChart as PieChartIcon,
import {
        Activity, Bell, RefreshCw, TrendingUp, PieChart as PieChartIcon,
        Settings, AlertTriangle, Building2, MessageSquare, ShieldCheck
    } from 'lucide-react';
import Card from '../../components/common/Card';
import MetricCard from '../../components/common/MetricCard';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DonutChart from '../../components/analytics/DonutChart';
import { useResources } from '../../hooks/useResources';

const DeanDashboard = () => {
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
                setSummaryData(data || {});
                setTrendData(data.trendsOverTime || []);
                setActiveAlerts(data.activeCampusAlerts || 0);
                setTotalBlocks(data.totalBlocks || 0);
                setCriticalAlerts(data.criticalAlerts || []);
                setRecentComplaints(data.recentComplaints || []);
            }
        } catch (err) {
            console.error('Dean Dashboard Error:', err.response?.data || err.message);
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
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
    const trendDataSafe = Array.isArray(trendData) ? trendData : [];

    const distributionData = Object.entries(summary)
        .map(([name, data]) => ({ name, value: typeof data === 'number' ? data : data?.total || 0 }))
        .filter(d => typeof d.value === 'number' && d.value > 0);

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto text-slate-900 dark:text-white">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Dean Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1 dark:text-slate-400">
                        Operational resource intelligence and incident management
                    </p>
                </div>
                <div className="flex items-center gap-3">
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
                    value={summaryData?.totalResources || resources?.length || 0}
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
                />
                <MetricCard
                    icon={<Building2 size={22} className="text-indigo-500" />}
                    label="Total Blocks"
                    value={totalBlocks}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {Object.entries(summary || {}).map(([name, val]) => {
                    const resource = (resources || []).find(r => r.name === name) || {};
                    const totalValue = typeof val === 'number' ? val : val?.total || 0;
                    return (
                        <MetricCard
                            key={name}
                            icon={<span className="text-xl" style={{ color: resource.color }}>{resource.icon || '📊'}</span>}
                            label={name}
                            value={totalValue > 0 ? `${totalValue.toLocaleString()} ${resource.unit || ''}` : 'No data'}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2" title="Resource Consumption Trends" icon={<TrendingUp size={20} />}>
                    <div className="h-[350px] mt-6">
                        {trendDataSafe.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendDataSafe}>
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
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#3B82F6"
                                        fill="#3B82F6"
                                        fillOpacity={0.05}
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                    />
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
                            <DonutChart
                                data={distributionData.map(d => ({ resource: d.name, value: d.value }))}
                                resources={resources}
                                height={320}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                <p>No data to display in breakdown</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Bottom Section: Alerts & Complaints */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Critical Incidents" icon={<AlertTriangle size={20} className="text-rose-500" />}>
                    <div className="space-y-4 mt-4">
                        {(criticalAlerts || []).length > 0 ? (
                            (criticalAlerts).map(alert => (
                                <div key={alert._id} className="flex items-center justify-between p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 group hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-rose-500 shadow-sm">
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
                                No critical issues detected
                            </div>
                        )}
                        <Button variant="secondary" size="sm" fullWidth className="!rounded-xl text-[10px] font-black uppercase tracking-tighter" onClick={() => navigate('/dean/alerts')}>
                            Manage Operational Alerts &rarr;
                        </Button>
                    </div>
                </Card>

                <Card title="Latest Grievances" icon={<MessageSquare size={20} className="text-indigo-500" />}>
                    <div className="space-y-4 mt-4">
                        {(recentComplaints || []).length > 0 ? (
                            (recentComplaints).map(complaint => (
                                <div key={complaint._id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 group hover:shadow-sm transition-all">
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
                                No pending grievances
                            </div>
                        )}
                        <Button variant="secondary" size="sm" fullWidth className="!rounded-xl text-[10px] font-black uppercase tracking-tighter" onClick={() => navigate('/dean/complaints')}>
                            Review Student Complaints &rarr;
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default DeanDashboard;
