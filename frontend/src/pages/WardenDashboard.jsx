import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Zap, Droplets, AlertTriangle, Plus, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card, { MetricCard } from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { exportToCSV } from '../utils/export';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';

export default function WardenDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    const [budget, setBudget] = useState(null);
    const [efficiency, setEfficiency] = useState(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                const [dashboardRes, budgetRes, leaderboardRes] = await Promise.all([
                    api.get('/api/dashboard/warden'),
                    api.get('/api/analytics/budget').catch(() => ({ data: { budgets: [] } })),
                    api.get('/api/analytics/leaderboard').catch(() => ({ data: { leaderboard: [] } }))
                ]);

                const dashboardData = dashboardRes.data.data || dashboardRes.data;
                setStats(dashboardData);

                if (budgetRes.data?.budgets?.length > 0) {
                    setBudget(budgetRes.data.budgets[0]);
                }

                if (leaderboardRes.data?.leaderboard?.length > 0) {
                    // Try to find warden's block score in leaderboard
                    // Usually Warden only manages 1 block, or match by name/id if available.
                    setEfficiency(leaderboardRes.data.leaderboard[0]);
                }
            } catch (err) {
                logger.error("Failed to fetch warden dashboard", err);
                addToast("Failed to load dashboard data", "error");
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    const handleExportCSV = () => {
        if (!stats?.todayUsage || stats.todayUsage.length === 0) {
            addToast('No usage data to export', 'warning');
            return;
        }

        const data = stats.todayUsage.map(u => ({
            Resource: u._id,
            TotalConsumption: u.total,
            Unit: u._id === 'Electricity' ? 'kWh' : 'Liters',
            Date: new Date().toLocaleDateString()
        }));

        exportToCSV(data, `warden_daily_report_${new Date().toISOString().split('T')[0]}.csv`);
        addToast('Report exported successfully');
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 rounded" style={{ backgroundColor: 'var(--bg-hover)', width: '200px' }}></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <EmptyState
                title="No Data Available"
                description="Unable to load dashboard data"
            />
        );
    }

    const { electricity, water, activeAlerts, todayUsage = [] } = stats;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Block Management</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Monitor and manage resource usage for your assigned block
                    </p>
                </div>
                <Link to="/usage/new">
                    <Button variant="primary">
                        <Plus size={16} className="mr-2" />
                        Add Usage
                    </Button>
                </Link>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    icon={<AlertTriangle size={20} />}
                    label="Active Alerts"
                    value={<span style={{ color: 'var(--color-danger)' }}>{activeAlerts || 0}</span>}
                />

                <MetricCard
                    icon={<Zap size={20} />}
                    label="Electricity"
                    value={<>{electricity?.current?.toLocaleString() || 0} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>kWh</span></>}
                    change={electricity?.percentageChange}
                />

                <MetricCard
                    icon={<Droplets size={20} />}
                    label="Water"
                    value={<>{water?.current?.toLocaleString() || 0} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>L</span></>}
                    change={water?.percentageChange}
                />

                {/* Budget remaining */}
                {budget && (
                    <MetricCard
                        icon={<span className="font-bold text-lg">₹</span>}
                        label="Remaining Budget"
                        value={<span style={{ color: budget.percentageUsed > 100 ? 'var(--color-danger)' : budget.percentageUsed > 80 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                            ₹{budget.remaining >= 0 ? budget.remaining.toLocaleString() : 0}
                        </span>}
                        change={budget.budget > 0 ? -budget.percentageUsed : 0}
                    />
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Usage */}
                <Card
                    title="Today's Usage"
                    action={
                        <Button variant="secondary" size="sm" onClick={handleExportCSV}>
                            <Download size={16} className="mr-2" />
                            Export
                        </Button>
                    }
                >
                    <div className="space-y-3">
                        {todayUsage.length > 0 ? (
                            todayUsage.map((usage, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-lg border"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: 'var(--bg-hover)' }}>
                                            {usage._id === 'Electricity' ? (
                                                <Zap size={20} style={{ color: 'var(--color-warning)' }} />
                                            ) : (
                                                <Droplets size={20} style={{ color: 'var(--color-primary)' }} />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {usage._id}
                                            </h4>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                {usage._id === 'Electricity' ? 'kWh' : 'Litres'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {usage.total?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyState
                                title="No usage recorded"
                                description="No usage data available for today"
                            />
                        )}
                    </div>
                </Card>

                {/* Block Performance */}
                <Card title="Block Performance" description="Overall efficiency metrics">
                    <div className="space-y-6">
                        {/* Overall Efficiency */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Overall Efficiency
                                </span>
                                <span className="text-sm font-semibold" style={{ color: efficiency?.score >= 80 ? 'var(--color-success)' : efficiency?.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                    {efficiency ? Math.round(efficiency.score) : 84}%
                                </span>
                            </div>
                            <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
                                <div
                                    className="h-full transition-all duration-500 rounded-full"
                                    style={{ width: `${efficiency ? efficiency.score : 84}%`, backgroundColor: efficiency?.score >= 80 ? 'var(--color-success)' : efficiency?.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}
                                />
                            </div>
                        </div>

                        {/* Sustainability Rating */}
                        <div className="p-4 rounded-lg border" style={{
                            borderColor: efficiency?.score >= 80 ? 'var(--color-success)' : efficiency?.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)',
                            backgroundColor: efficiency?.score >= 80 ? '#DCFCE7' : efficiency?.score >= 60 ? '#FEF3C7' : '#FEE2E2',
                        }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider mb-1"
                                        style={{ color: efficiency?.score >= 80 ? 'var(--color-success)' : efficiency?.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                        Sustainability Rating
                                    </p>
                                    <p className="text-3xl font-bold" style={{ color: efficiency?.score >= 80 ? 'var(--color-success)' : efficiency?.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                        {efficiency ? (efficiency.score >= 90 ? 'A+' : efficiency.score >= 80 ? 'A' : efficiency.score >= 70 ? 'B' : efficiency.score >= 60 ? 'C' : 'F') : 'A+'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: efficiency?.score >= 80 ? 'var(--color-success)' : efficiency?.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                        {efficiency ? (efficiency.score >= 80 ? 'Top tier' : efficiency.score >= 60 ? 'Average' : 'Needs attention') : 'Top tier'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Action */}
                        <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <Link to="/reports">
                                <Button variant="secondary" className="w-full justify-center">
                                    View Detailed Reports
                                </Button>
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
