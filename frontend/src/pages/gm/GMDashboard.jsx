import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import {
    Zap, Droplets, Flame, Wind, Sun, Trash2,
    RefreshCw, TrendingUp, TrendingDown,
    PieChart as PieChartIcon, Activity, Bell
} from 'lucide-react';
import Card, { MetricCard } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { logger } from '../../utils/logger';

const GMDashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [summaryData, setSummaryData] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [summaryRes, trendRes] = await Promise.all([
                api.get('/api/usage/summary'),
                api.get('/api/usage/trends?range=7d')
            ]);

            if (summaryRes.data?.success) {
                setSummaryData(summaryRes.data.data);
            }
            if (trendRes.data?.success) {
                setTrendData(trendRes.data.data || []);
            }
        } catch (err) {
            logger.error('GM Dashboard Data Fetch Failed:', err);
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

    const totals = summaryData?.totals || {};
    const summary = summaryData?.summary || {};
    const alertsCount = summaryData?.alertsCount || 0;

    const getMetricData = (name) => {
        const data = summary[name] || {};
        return {
            value: data.total > 0 ? `${data.total.toLocaleString()} ${data.unit}` : 'No data disponible',
            color: data.color || '#64748b',
            icon: name === 'Electricity' ? <Zap /> :
                name === 'Water' ? <Droplets /> :
                    name === 'LPG' ? <Flame /> :
                        name === 'Diesel' ? <Wind /> :
                            name === 'Solar' ? <Sun /> : <Trash2 />
        };
    };

    const distributionData = Object.entries(summary)
        .map(([name, data]) => ({ name, value: data.total }))
        .filter(d => d.value > 0);

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
                    <Badge variant={alertsCount > 0 ? "danger" : "success"} className="px-4 py-1 flex items-center gap-2">
                        <Bell size={14} /> {alertsCount} Active Alerts
                    </Badge>
                    <Button variant="secondary" size="sm" onClick={fetchData}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {Object.keys(summary).map(name => {
                    const metric = getMetricData(name);
                    return (
                        <MetricCard
                            key={name}
                            icon={metric.icon}
                            label={name}
                            value={metric.value}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2" title="Resource Consumption Trends" icon={<TrendingUp size={20} />}>
                    <div className="h-[350px] mt-6">
                        {trendData.length > 0 ? (
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
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                    {Object.keys(summary).map(name => (
                                        <Area
                                            key={name}
                                            type="monotone"
                                            dataKey={name}
                                            stroke={summary[name]?.color}
                                            fill={summary[name]?.color}
                                            fillOpacity={0.1}
                                            strokeWidth={3}
                                            dot={false}
                                        />
                                    ))}
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
                        {distributionData.length > 0 ? (
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
                                            <Cell key={`cell-${index}`} fill={summary[entry.name]?.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
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
