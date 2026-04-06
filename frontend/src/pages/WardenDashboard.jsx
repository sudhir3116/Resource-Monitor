import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { getSocket } from '../utils/socket';
import {
    AlertTriangle, Plus, Activity, TrendingUp, ArrowRight,
    RefreshCw, Bell, ClipboardList, FileText, BarChart2,
    Zap, Droplets, CheckCircle, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { logger } from '../utils/logger';
import { useResources } from '../hooks/useResources';
import { safe } from '../utils/safe';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function WardenDashboard() {
    const [summaryData, setSummaryData] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [recentAlerts, setRecentAlerts] = useState([]);
    const [recentUsages, setRecentUsages] = useState([]);
    const [todayReportDone, setTodayReportDone] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { resources } = useResources();

    const blockName  = user?.block?.name || user?.blockName || 'Your Block';
    const blockId    = user?.block?._id || (typeof user?.block === 'string' ? user?.block : null);

    // ── Fetch all dashboard data ─────────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        if (authLoading) return;
        
        if (!blockId) {
            setLoading(false);
            setError('No block assigned to your account. Please contact the administrator.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const blockQ = `blockId=${blockId}`;
            // Backend stores alert status as 'Active' (not 'pending'), 'Investigating', 'Escalated'
            const [summaryRes, trendRes, alertsRes, usageRes, reportRes] = await Promise.allSettled([
                api.get(`/api/usage/summary?${blockQ}`),
                api.get(`/api/usage/trends?range=7d&${blockQ}`),
                api.get(`/api/alerts?limit=5`),   // block-scoping done by backend for warden
                api.get(`/api/usage?limit=6&${blockQ}`),
                api.get('/api/daily-reports/today/check').catch(() => ({ data: { data: { submitted: false } } }))
            ]);

            if (summaryRes.status === 'fulfilled') {
                setSummaryData(summaryRes.value.data?.data || null);
            }

            if (trendRes.status === 'fulfilled') {
                const raw = trendRes.value.data?.data;
                setTrendData(Array.isArray(raw) ? raw : []);
            }

            if (alertsRes.status === 'fulfilled') {
                // Backend returns `alerts` (legacy) and `data` keys
                const arr = alertsRes.value.data?.alerts || alertsRes.value.data?.data || [];
                setRecentAlerts(Array.isArray(arr) ? arr.slice(0, 5) : []);
            }

            if (usageRes.status === 'fulfilled') {
                const arr = usageRes.value.data?.data || usageRes.value.data?.usages || [];
                setRecentUsages(Array.isArray(arr) ? arr.slice(0, 6) : []);
            }

            if (reportRes.status === 'fulfilled') {
                setTodayReportDone(reportRes.value.data?.data?.submitted || false);
            }

        } catch (err) {
            logger.error('WardenDashboard fetch error', err);
            setError('Failed to load dashboard data. Check your network or reload.');
        } finally {
            setLoading(false);
        }
    }, [blockId, authLoading]);

    useEffect(() => {
        fetchStats();

        const socket = getSocket();
        const refresh = () => fetchStats();

        if (socket) {
            socket.on('dashboard:refresh', refresh);
            socket.on('usage:added', refresh);
            socket.on('alerts:refresh', refresh);
        }
        window.addEventListener('usage:added', refresh);

        return () => {
            if (socket) {
                socket.off('dashboard:refresh', refresh);
                socket.off('usage:added', refresh);
                socket.off('alerts:refresh', refresh);
            }
            window.removeEventListener('usage:added', refresh);
        };
    }, [fetchStats]);

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (authLoading || (loading && !summaryData)) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between pb-4">
                    <div className="h-10 w-72 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700" />
                    <div className="h-10 w-32 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700" />
                    ))}
                </div>
                <div className="h-72 rounded-xl animate-pulse bg-slate-200 dark:bg-slate-700" />
            </div>
        );
    }

    // ── Error / No-block state ────────────────────────────────────────────────
    if (error && !summaryData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4">
                <AlertTriangle className="text-amber-500" size={40} />
                <p className="text-slate-600 dark:text-slate-400 font-semibold text-center max-w-md">{error}</p>
                <Button onClick={fetchStats} variant="secondary">
                    <RefreshCw size={14} className="mr-2" /> Retry
                </Button>
            </div>
        );
    }

    // alertsCount: prefer the summary field (accurate total), fall back to list length
    const summary     = summaryData?.summary || {};
    const alertsCount = summaryData?.alertsCount ?? recentAlerts.length;

    const chartColors = (Array.isArray(resources) ? resources : []).reduce((acc, r) => {
        acc[r.name] = r.color || '#64748b';
        return acc;
    }, {});

    // Resource metric cards — dynamically render all active resources
    const resourceCards = Array.isArray(resources) ? resources : [];

    const renderResIcon = (type, resList) => {
        const res = (resList || []).find(r => r.name?.toLowerCase() === type?.toLowerCase());
        const icon = res?.icon || res?.emoji || '📊';
        const color = res?.color || '#3B82F6';

        // Robust check for Lucide icon string vs emoji
        if (typeof icon === 'string' && icon.length <= 4) {
            return <span className="text-lg leading-none" style={{ color }}>{icon}</span>;
        }

        switch (type?.toLowerCase()) {
            case 'water': return <Droplets size={16} className="text-blue-500" />;
            case 'electricity': return <Zap size={16} className="text-yellow-500" />;
            case 'gas': case 'lpg': return <Flame size={16} className="text-orange-500" />;
            default: return <Activity size={16} className="text-slate-400" />;
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 pb-10">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="success" className="animate-pulse !py-0.5 !px-1.5 text-[8px] uppercase tracking-tighter">Live</Badge>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operational Overview</span>
                    </div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-2xl">🏠</span> {blockName}
                    </h1>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Review live metrics and manage compliance for your assigned block
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/warden/usage')}>
                        View All Usage <ArrowRight size={14} className="ml-1" />
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => navigate('/warden/usage/new')}>
                        <Plus size={16} className="mr-1" /> Log Usage
                    </Button>
                    <button
                        onClick={fetchStats}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''} text-slate-500`} />
                    </button>
                </div>
            </div>

            {/* ── Metric Cards ─────────────────────────────────────────── */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {/* Alerts card */}
                <MetricCard
                    icon={<Bell size={20} />}
                    label="Active Alerts"
                    value={<span style={{ color: alertsCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{safe(alertsCount)}</span>}
                />
                {/* Per-resource metric cards */}
                {resourceCards.map(res => {
                    const data = summary[res.name] || {};
                    return (
                        <MetricCard
                            key={res.name}
                            icon={renderResIcon(res.name, resources)}
                            label={res.name}
                            value={
                                <>
                                    {data.total > 0
                                        ? <>{safe(data.total).toLocaleString()} <span className="text-sm font-normal opacity-60">{res.unit}</span></>
                                        : 'No data'}
                                </>
                            }
                        />
                    );
                })}
            </div>

            {/* ── Resource Summary with Progress Bars ──────────────────── */}
            {Object.keys(summary).length > 0 && (
                <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                        style={{ color: 'var(--text-secondary)' }}>
                        <TrendingUp size={16} /> Resource Consumption
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(summary).map(([resName, data]) => {
                            const resource = (Array.isArray(resources) ? resources : []).find(r => r.name === resName);
                            const color    = resource?.color || '#64748b';
                            const pct      = data?.monthlyLimit > 0
                                ? Math.min(Math.round((data.total / data.monthlyLimit) * 100), 200)
                                : 0;
                            const pctColor = pct >= 150 ? '#EF4444'
                                : pct >= 100 ? '#F97316'
                                : pct >= 80  ? '#F59E0B'
                                : '#10B981';

                            return (
                                <Card key={resName} style={{ borderLeft: `3px solid ${color}` }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-slate-200/40 dark:border-slate-700/30" style={{ backgroundColor: `${color}15` }}>
                                                {renderResIcon(resName, resources)}
                                            </div>
                                            <span className="text-sm font-bold" style={{ color }}>{resName}</span>
                                        </div>
                                        {pct > 0 && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: pctColor + '20', color: pctColor }}>
                                                {pct}%
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                                        {data?.total > 0 ? data.total.toLocaleString() : '—'}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        {data?.unit}
                                        {data?.monthlyLimit > 0 && ` · ${data.monthlyLimit} monthly limit`}
                                    </p>
                                    {pct > 0 && (
                                        <div className="w-full h-1.5 rounded-full mt-3 overflow-hidden"
                                            style={{ backgroundColor: 'var(--bg-hover)' }}>
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor }}
                                            />
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Trend Chart ──────────────────────────────────────────── */}
            <Card title="7-Day Usage Trend" icon={<BarChart2 size={18} />}>
                <div className="h-[260px] mt-4">
                    {trendData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Activity size={40} className="opacity-20 mb-2" />
                            <p className="text-sm">No trend data for the past 7 days</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    {(Array.isArray(resources) ? resources : []).map(r => (
                                        <linearGradient key={r.name}
                                            id={`warden-grad-${r.name.replace(/[^a-zA-Z0-9]/g, '_')}`}
                                            x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor={r.color} stopOpacity={0.15} />
                                            <stop offset="95%" stopColor={r.color} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="date"
                                    tickFormatter={v => new Date(v).toLocaleDateString(undefined, { weekday: 'short' })}
                                    fontSize={10} stroke="var(--text-secondary)" />
                                <YAxis fontSize={10} stroke="var(--text-secondary)" />
                                <Tooltip contentStyle={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px'
                                }} />
                                <Legend iconType="circle" />
                                {(Array.isArray(resources) ? resources : []).map(r => (
                                    <Area key={r.name}
                                        type="monotone"
                                        dataKey={r.name}
                                        name={r.name}
                                        stroke={r.color}
                                        fill={`url(#warden-grad-${r.name.replace(/[^a-zA-Z0-9]/g, '_')})`}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            {/* ── Bottom Row: Alerts + Recent Usage ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent Alerts */}
                <Card title="Active Alerts" icon={<Bell size={18} />}
                    description="Threshold violations for your block">
                    <div className="space-y-3 mt-4">
                        {recentAlerts.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 text-slate-400">
                                <CheckCircle size={32} className="text-emerald-400 opacity-60" />
                                <p className="text-sm">No active alerts — all clear!</p>
                            </div>
                        ) : (
                            recentAlerts.map(alert => {
                                const sevLower = (alert.severity || 'medium').toLowerCase();
                                const isActive = ['active', 'pending'].includes((alert.status || '').toLowerCase());
                                const isInvestigating = (alert.status || '').toLowerCase() === 'investigating';
                                const sevColor = sevLower === 'critical' ? 'border-red-500/20 bg-red-500/5'
                                    : sevLower === 'high' ? 'border-orange-500/20 bg-orange-500/5'
                                    : 'border-rose-500/10 bg-rose-500/5';
                                return (
                                    <div key={alert._id}
                                        className={`p-3 rounded-xl border flex flex-col gap-2 ${sevColor}`}>
                                        <div className="flex items-start gap-3">
                                             <div className="mt-0.5 shrink-0 flex items-center justify-center h-6 w-6 rounded-md bg-white/50 dark:bg-black/20">
                                                 {renderResIcon(alert.resourceType, resources)}
                                             </div>
                                             <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold truncate">
                                                    {alert.resourceType || 'Unknown'} — <span className="capitalize">{alert.severity || 'Warning'}</span>
                                                </p>
                                                <p className="text-xs text-slate-500 line-clamp-1">{alert.message}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap pl-5">
                                            <Badge variant={sevLower === 'critical' ? 'danger' : sevLower === 'high' ? 'warning' : 'warning'} className="text-[9px]">
                                                {alert.severity || 'Warning'}
                                            </Badge>
                                            <Badge variant={isActive ? 'warning' : isInvestigating ? 'primary' : 'default'} className="text-[9px]">
                                                {alert.status || 'Active'}
                                            </Badge>
                                            {/* Warden can flag alert as Investigating */}
                                            {isActive && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.put(`/api/alerts/${alert._id}/investigate`);
                                                            await fetchStats();
                                                        } catch (e) {
                                                            logger.error('investigate failed', e);
                                                        }
                                                    }}
                                                    className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 underline underline-offset-2"
                                                >
                                                    Mark Investigating
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <Button variant="link" size="sm" className="w-full text-blue-500 text-xs"
                            onClick={() => navigate('/warden/alerts')}>
                            View All Alerts →
                        </Button>
                    </div>
                </Card>

                {/* Recent Usage Logs */}
                <Card title="Recent Usage Logs" icon={<Activity size={18} />}
                    description="Latest entries logged for this block">
                    <div className="space-y-2 mt-4">
                        {recentUsages.length === 0 ? (
                            <EmptyState
                                title="No Usage Records"
                                description="No usage has been logged yet. Start by adding one."
                                action={
                                    <Button variant="primary" size="sm" onClick={() => navigate('/warden/usage/new')}>
                                        <Plus size={14} className="mr-1" /> Log First Usage
                                    </Button>
                                }
                            />
                        ) : (
                            recentUsages.map(u => (
                                <div key={u._id}
                                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div 
                                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200/40 dark:border-slate-700/30"
                                            style={{ backgroundColor: ((resources || []).find(r => r.name?.toLowerCase() === u.resource_type?.toLowerCase())?.color || '#3B82F6') + '15' }}
                                        >
                                            {renderResIcon(u.resource_type, resources)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">{u.resource_type}</p>
                                            <p className="text-xs text-slate-400">
                                                {new Date(u.usage_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black ml-3 text-right shrink-0">
                                        {(u.usage_value || 0).toLocaleString()}
                                        <span className="text-xs font-normal text-slate-400 ml-1">{u.unit}</span>
                                    </span>
                                </div>
                            ))
                        )}
                        <Button variant="link" size="sm" className="w-full text-blue-500 text-xs"
                            onClick={() => navigate('/warden/usage')}>
                            Full Usage History →
                        </Button>
                    </div>
                </Card>
            </div>

            {/* ── Daily Report CTA ─────────────────────────────────────── */}
            <Card className={todayReportDone
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30'
            }>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        {todayReportDone
                            ? <CheckCircle className="text-emerald-500" size={28} />
                            : <Clock className="text-amber-500" size={28} />
                        }
                        <div>
                            <p className="font-bold text-sm">
                                {todayReportDone ? "Today's Report Submitted ✓" : "Daily Report Pending"}
                            </p>
                            <p className="text-xs text-slate-500">
                                {todayReportDone
                                    ? "Your block's daily compliance log has been submitted."
                                    : "Submit before end of day to ensure compliance tracking."}
                            </p>
                        </div>
                    </div>
                    {!todayReportDone && (
                        <Button variant="primary" size="sm" onClick={() => navigate('/warden/daily-report')}>
                            <ClipboardList size={14} className="mr-2" /> Submit Now
                        </Button>
                    )}
                    {todayReportDone && (
                        <Button variant="secondary" size="sm" onClick={() => navigate('/warden/daily-report')}>
                            <FileText size={14} className="mr-2" /> View History
                        </Button>
                    )}
                </div>
            </Card>

            {/* ── Quick Actions ─────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="secondary" size="sm" onClick={() => navigate('/warden/usage/new')}>
                    <Plus size={14} className="mr-1" /> Log Usage
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/warden/complaints')}>
                    📋 Manage Complaints
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/warden/notices')}>
                    📌 Notice Board
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/warden/alerts')}>
                    🔔 All Alerts
                </Button>
            </div>
        </div>
    );
}
