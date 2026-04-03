import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { getSocket } from '../utils/socket';
import { AlertTriangle, Plus, Activity, TrendingUp, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import { useResources } from '../hooks/useResources';

export default function WardenDashboard() {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { resources } = useResources();  // Get active resources from single source
    const blockName = user?.block?.name || user?.blockName || 'Your Block';

    const fetchStats = useCallback(async () => {
        try {
            const [summaryRes, alertsRes] = await Promise.allSettled([
                api.get('/api/usage/summary'),
                api.get('/api/alerts?status=OPEN&limit=5').catch(() => ({ data: { total: 0 } }))
            ]);

            if (summaryRes.status === 'fulfilled') {
                setSummaryData(summaryRes.value.data?.data || null);
            }
        } catch (err) {
            logger.error('Failed to fetch warden dashboard', err);
            addToast('Failed to load dashboard data', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchStats();
        const socket = getSocket();
        const refresh = () => fetchStats();

        if (socket) {
            socket.on('dashboard:refresh', refresh);
            socket.on('dashboard:usage_added', refresh);
            socket.on('usage:added', refresh);
            socket.on('alerts:refresh', refresh);
        }

        window.addEventListener('usage:added', refresh);

        return () => {
            if (socket) {
                socket.off('dashboard:refresh', refresh);
                socket.off('dashboard:usage_added', refresh);
                socket.off('usage:added', refresh);
                socket.off('alerts:refresh', refresh);
            }
            window.removeEventListener('usage:added', refresh);
        };
    }, [fetchStats]);

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

    const summary = summaryData?.summary || {};
    const alertsCount = summaryData?.alertsCount || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>{blockName} Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Monitor resource usage for your assigned block</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/warden/usage')}>
                        View Detailed Usage <ArrowRight size={14} className="ml-1" />
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => navigate('/warden/usage/new')}>
                        <Plus size={16} className="mr-2" /> Log Usage
                    </Button>
                </div>
            </div>

            {/* Alert + Resource Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    icon={<AlertTriangle size={20} />}
                    label="Active Alerts"
                    value={<span style={{ color: alertsCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{alertsCount}</span>}
                />
                {(Array.isArray(resources) ? resources : []).slice(0, 3).map(res => {
                    const data = summary[res.name] || {};
                    return (
                        <MetricCard
                            key={res.name}
                            icon={<span style={{ fontSize: '18px' }}>{res.icon || '📊'}</span>}
                            label={res.name}
                            value={
                                <>
                                    {data.total > 0 ? data.total.toLocaleString() : 'No data'}
                                    {data.total > 0 && <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>{res.unit}</span>}
                                </>
                            }
                        />
                    );
                })}
            </div>

            {/* All Resource Cards */}
            {Object.entries(summary || {}).length > 0 ? (
                <div>
                    <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                        <TrendingUp size={20} className="inline mr-2 text-blue-500" />
                        Resource Summary
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(summary || {}).map(([resName, data]) => {
                            const resource = (Array.isArray(resources) ? resources : []).find(r => r.name === resName);
                            const icon = resource?.icon || '📊';
                            const color = resource?.color || '#64748b';
                            const pct = data?.dailyLimit > 0
                                ? Math.min(Math.round((data?.total / data?.dailyLimit) * 100), 200)
                                : 0;
                            const pctColor = pct >= 150 ? '#EF4444' : pct >= 100 ? '#F97316' : pct >= 80 ? '#F59E0B' : '#10B981';

                            return (
                                <Card key={resName} className="p-4" style={{ borderLeft: `3px solid ${color}` }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
                                            <span style={{ fontSize: '18px' }}>{icon}</span> {resName}
                                        </span>
                                        {pct > 0 && (
                                            <span className="text-xs font-bold" style={{ color: pctColor }}>
                                                {pct}%
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {data?.total > 0 ? data.total.toLocaleString() : 'No data'}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        {data?.unit}
                                        {data?.dailyLimit > 0 && ` / ${data.dailyLimit} daily limit`}
                                    </p>
                                    {pct > 0 && (
                                        <div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor }}
                                            />
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <EmptyState
                    title="No Usage Data"
                    description="No resource usage has been recorded for your block yet. Start by logging usage."
                    action={
                        <Button variant="primary" onClick={() => navigate('/warden/usage/new')}>
                            <Plus size={16} className="mr-2" /> Log First Usage
                        </Button>
                    }
                />
            )}

            {/* Quick Links */}
            <Card>
                <div className="flex flex-wrap gap-3">
                    <Link to="/warden/usage">
                        <Button variant="secondary" size="sm">📊 View All Usage</Button>
                    </Link>
                    <Link to="/warden/complaints">
                        <Button variant="secondary" size="sm">📋 Manage Complaints</Button>
                    </Link>
                    <Link to="/warden/daily-report">
                        <Button variant="secondary" size="sm">📄 Daily Report</Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
