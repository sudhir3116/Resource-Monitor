import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';
import { getSocket } from '../utils/socket';
import { Zap, Droplets, AlertTriangle, Plus, Download, Activity, Flame, Wind, Utensils, Trash2, TrendingUp, TrendingDown, Sun } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { MetricCard } from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { exportToCSV } from '../utils/export';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';

const RESOURCE_META = {
    Electricity: { icon: <Zap size={20} />, unit: 'kWh', color: 'text-amber-500' },
    Water: { icon: <Droplets size={20} />, unit: 'L', color: 'text-blue-500' },
    Solar: { icon: <Sun size={20} />, unit: 'kWh', color: 'text-yellow-500' },
    LPG: { icon: <Flame size={20} />, unit: 'kg', color: 'text-orange-500' },
    Diesel: { icon: <Wind size={20} />, unit: 'L', color: 'text-slate-500' },
    Waste: { icon: <Trash2 size={20} />, unit: 'kg', color: 'text-rose-500' },
};

export default function WardenDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dynamicResources, setDynamicResources] = useState([]);
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [budget, setBudget] = useState(null);
    const [efficiency, setEfficiency] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            const [configRes, dashboardRes, budgetRes, leaderboardRes] = await Promise.allSettled([
                api.get('/api/config/thresholds'),
                api.get('/api/dashboard/warden'),
                api.get('/api/analytics/budget'),
                api.get('/api/analytics/leaderboard')
            ]);

            if (configRes.status === 'fulfilled') {
                setDynamicResources((configRes.value.data.data || []).filter(r => r.isActive));
            }

            let dashboardData = null;
            if (dashboardRes.status === 'fulfilled') {
                dashboardData = dashboardRes.value.data.data || dashboardRes.value.data;
            }
            setStats(dashboardData);

            if (budgetRes.status === 'fulfilled') {
                const budgetsArr = budgetRes.value.data.data || budgetRes.value.data || [];
                if (Array.isArray(budgetsArr) && budgetsArr.length > 0) setBudget(budgetsArr[0]);
            }

            if (leaderboardRes.status === 'fulfilled') {
                const leaderboardsArr = leaderboardRes.value.data.data || leaderboardRes.value.data || [];
                if (Array.isArray(leaderboardsArr) && leaderboardsArr.length > 0) setEfficiency(leaderboardsArr[0]);
            }
        } catch (err) {
            logger.error("Failed to fetch warden dashboard", err);
            addToast("Failed to load dashboard data", "error");
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchStats();
        const socket = getSocket();
        if (socket) {
            socket.on('dashboard:refresh', fetchStats);
            socket.on('dashboard:usage_added', fetchStats);
            socket.on('dashboard:alert_created', fetchStats);
            socket.on('dashboard:alert_resolved', fetchStats);
        }
        return () => {
            if (socket) {
                socket.off('dashboard:refresh', fetchStats);
                socket.off('dashboard:usage_added', fetchStats);
                socket.off('dashboard:alert_created', fetchStats);
                socket.off('dashboard:alert_resolved', fetchStats);
            }
        };
    }, [fetchStats]);

    const handleExportCSV = () => {
        if (!stats?.todayUsage || stats.todayUsage.length === 0) {
            addToast('No usage data to export', 'warning');
            return;
        }

        const data = stats.todayUsage.map(u => {
            const config = dynamicResources.find(r => r.resource === u._id);
            return {
                Resource: u._id,
                TotalConsumption: u.total,
                Unit: config?.unit || RESOURCE_META[u._id]?.unit || 'units',
                Date: new Date().toLocaleDateString()
            };
        });

        exportToCSV(data, `warden_daily_report_${new Date().toISOString().split('T')[0]}.csv`);
        addToast('Report exported successfully');
    };

    const getResourceIcon = (type) => {
        return RESOURCE_META[type]?.icon || <Activity size={20} />;
    };

    const getResourceUnit = (type) => {
        const config = dynamicResources.find(r => r.resource === type);
        return config?.unit || RESOURCE_META[type]?.unit || 'units';
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 rounded" style={{ backgroundColor: 'var(--bg-hover)', width: '200px' }}></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!stats) {
        return <EmptyState title="No Data Available" description="Unable to load dashboard data" />;
    }

    const { activeAlerts, todayUsage = [] } = stats;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Block Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Monitor and manage resource usage for your assigned block</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/warden/usage')}>
                        View Detailed Usage &rarr;
                    </Button>
                    <Link to="/usage/new">
                        <Button variant="primary" size="sm">
                            <Plus size={16} className="mr-2" /> Add Usage
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<AlertTriangle size={20} />}
                    label="Active Alerts"
                    value={<span style={{ color: 'var(--color-danger)' }}>{activeAlerts || 0}</span>}
                />

                {dynamicResources.slice(0, 3).map(res => {
                    const data = stats[res.resource.toLowerCase()] || stats[res.resource] || { current: 0, percentageChange: 0 };
                    return (
                        <MetricCard
                            key={res._id}
                            icon={getResourceIcon(res.resource)}
                            label={res.resource}
                            value={<>{data.current?.toLocaleString() || 0} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{res.unit}</span></>}
                            change={data.percentageChange}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


                <Card title="Block Performance" description="Overall efficiency metrics">
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Overall Efficiency</span>
                                <span className="text-sm font-semibold" style={{ color: (efficiency?.score || 0) >= 80 ? 'var(--color-success)' : (efficiency?.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                    {efficiency ? Math.round(efficiency.score) : 84}%
                                </span>
                            </div>
                            <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
                                <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${efficiency ? efficiency.score : 84}%`, backgroundColor: (efficiency?.score || 0) >= 80 ? 'var(--color-success)' : (efficiency?.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                            </div>
                        </div>

                        <div className="p-4 rounded-lg border" style={{
                            borderColor: (efficiency?.score || 0) >= 80 ? 'var(--color-success)' : (efficiency?.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)',
                            backgroundColor: (efficiency?.score || 0) >= 80 ? 'rgba(34, 197, 94, 0.1)' : (efficiency?.score || 0) >= 60 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: (efficiency?.score || 0) >= 80 ? 'var(--color-success)' : (efficiency?.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>Sustainability Rating</p>
                                    <p className="text-3xl font-bold" style={{ color: (efficiency?.score || 0) >= 80 ? 'var(--color-success)' : (efficiency?.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                        {efficiency ? (efficiency.score >= 90 ? 'A+' : efficiency.score >= 80 ? 'A' : efficiency.score >= 70 ? 'B' : efficiency.score >= 60 ? 'C' : 'F') : 'A+'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: (efficiency?.score || 0) >= 80 ? 'var(--color-success)' : (efficiency?.score || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                        {efficiency ? (efficiency.score >= 80 ? 'Top tier' : efficiency.score >= 60 ? 'Average' : 'Needs attention') : 'Top tier'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <Link to="/analytics">
                                <Button variant="secondary" className="w-full justify-center">View Detailed Reports</Button>
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
