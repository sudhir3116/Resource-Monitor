import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useResources } from '../hooks/useResources';
import {
    Zap,
    Droplets,
    Flame,
    Wind,
    Trash2,
    Sun,
    ArrowRight,
    Activity,
    TrendingUp,
    AlertTriangle
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { getSocket } from '../utils/socket';
import { logger } from '../utils/logger';

// Dynamic resource metadata is now fetched via useResources hook and Managed in Admin Panel.


export default function Resources() {
    const [stats, setStats] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { resources: activeResources } = useResources(); // Only active, from hook

    const usageBasePath = user?.role === 'admin' ? '/admin/usage'
        : user?.role === 'warden' ? '/warden/usage'
            : user?.role === 'gm' ? '/gm/usage'
                : '/usage';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [summaryRes, alertsRes] = await Promise.all([
                    api.get('/api/usage/summary'),
                    api.get('/api/alerts?status=pending,investigating,escalated')
                ]);
                const summary = summaryRes.data?.data?.summary || summaryRes.data?.summary || {};
                const statsObj = {};
                Object.entries(summary).forEach(([name, data]) => {
                    statsObj[name] = {
                        current: data.total || 0,
                        unit: data.unit || 'units',
                        cost: data.total ? Math.round(data.total * 2.5) : 0,
                        monthlyLimit: data.monthlyLimit || 1000
                    };
                });
                setStats(statsObj);
                setAlerts(alertsRes.data?.alerts || alertsRes.data?.data || []);
            } catch (err) {
                logger.error('Failed to fetch resource stats', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        // Real-time synchronization
        const socket = getSocket();
        const refresh = () => fetchStats();

        if (socket) {
            socket.on('usage:refresh', refresh);
            socket.on('usage:new', refresh);
            socket.on('usage:added', refresh);
        }

        window.addEventListener('usage:added', refresh);

        return () => {
            if (socket) {
                socket.off('usage:refresh', refresh);
                socket.off('usage:new', refresh);
                socket.off('usage:added', refresh);
            }
            window.removeEventListener('usage:added', refresh);
        };
    }, []);

    // Helper to render icon/emoji from DB
    const renderIcon = (icon) => {
        if (!icon) return <Activity size={24} />;
        if (typeof icon === 'string' && icon.length < 5) return <span className="text-2xl leading-none">{icon}</span>;
        return <Activity size={24} />; // Default generic icon
    };

    // ── Build resources with metadata merged for display, filtering only active
    const resources = useMemo(() => {
        return (Array.isArray(activeResources) ? activeResources : [])
            .map(res => ({
                id: res?._id,
                name: res?.name,
                icon: renderIcon(res?.icon),
                color: res?.color || '#64748b',
                bg: (res?.color || '#64748b') + '15', // light transparency
                unit: res?.unit || 'units',
                description: res?.description || 'Real-time resource monitoring'
            })) || [];
    }, [activeResources]);

    return (

        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 style={{ color: 'var(--text-primary)' }}>Resources Overview</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Monitor consumption status across all utility nodes
                </p>
            </div>

            {/* Top KPI Cards */}
            {loading ? (
                <div className="py-20 text-center text-slate-500">Loading resources...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <Card>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📊</span>
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">Today’s Total Usage</div>
                                    <div className="text-xl font-black">{Object.values(stats || {}).reduce((acc, s) => acc + (s.current || 0), 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">💸</span>
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">Today’s Total Cost</div>
                                    <div className="text-xl font-black">₹{Object.values(stats || {}).reduce((acc, s) => acc + (s.cost || 0), 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🚨</span>
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase">Active Alerts</div>
                                    <div className="text-xl font-black">{alerts?.length || 0}</div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
                        {resources.map(res => {
                            const stat = stats?.[res.name] || { current: 0, unit: res.unit, cost: 0 };
                            const usage = stat.current || 0;
                            const limit = stat.monthlyLimit || 1000;
                            const percentage = (usage / limit) * 100;

                            // Visual indicator logic
                            const statusColor = percentage > 100 ? 'text-rose-600'
                                : percentage > 80 ? 'text-amber-500'
                                    : 'text-emerald-500';

                            const statusBg = percentage > 100 ? 'bg-rose-50'
                                : percentage > 80 ? 'bg-amber-50'
                                    : 'bg-emerald-50';

                            return (
                                <Card key={res.id} className="hover:shadow-xl transition-all duration-300 border-t-4 border-blue-600 group">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform flex items-center justify-center" style={{ backgroundColor: res.bg, color: res.color }}>
                                            {res.icon}
                                        </div>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${statusBg} ${statusColor}`}>
                                            {percentage > 100 ? 'High' : percentage > 80 ? 'Medium' : 'Optimal'}
                                        </span>
                                    </div>

                                    <h3 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>{res.name}</h3>
                                    <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                                        {res.description}
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Consumption</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-3xl font-black tracking-tighter ${statusColor}`}>
                                                    {usage.toLocaleString()}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400 capitalize">{stat.unit || res.unit}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Accrued Cost</p>
                                            <div className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                                                ₹{Math.round(stat.cost || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <Button
                                            variant="primary"
                                            className="w-full justify-center h-12 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/10 group-hover:shadow-blue-600/20"
                                            onClick={() => navigate(`${usageBasePath}/all?resource=${encodeURIComponent(res.name)}`)}
                                        >
                                            View Details
                                            <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
