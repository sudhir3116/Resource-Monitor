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

// ── Resource metadata for display
const RESOURCE_METADATA = {
    'Electricity': {
        icon: <Zap size={24} />,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        description: 'Grid consumption and phase balancing.'
    },
    'Water': {
        icon: <Droplets size={24} />,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        description: 'Water flow rates and storage levels.'
    },
    'Solar': {
        icon: <Sun size={24} />,
        color: 'text-yellow-500',
        bg: 'bg-yellow-50',
        description: 'Solar panel energy generation.'
    },
    'LPG': {
        icon: <Flame size={24} />,
        color: 'text-orange-500',
        bg: 'bg-orange-50',
        description: 'Gas cylinder usage monitoring.'
    },
    'Diesel': {
        icon: <Wind size={24} />,
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        description: 'Generator fuel levels.'
    },
    'Waste': {
        icon: <Trash2 size={24} />,
        color: 'text-rose-500',
        bg: 'bg-rose-50',
        description: 'Waste generation and recycling.'
    }
};

export default function Resources() {
    const [stats, setStats] = useState(null);
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
                const res = await api.get('/api/usage/summary');
                const summary = res.data?.data?.summary || {};
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

    // ── Build resources with metadata merged for display, filtering only active
    const resources = useMemo(() => {
        return (Array.isArray(activeResources) ? activeResources : [])
            .filter(res => res?.isActive !== false)  // Safety: double-check isActive
            .map(res => ({
                id: res?.name?.toLowerCase().replace(/\s+/g, '-') || res?._id,
                name: res?.name,
                icon: RESOURCE_METADATA[res?.name]?.icon || <Activity size={24} />,
                color: RESOURCE_METADATA[res?.name]?.color || 'text-slate-500',
                bg: RESOURCE_METADATA[res?.name]?.bg || 'bg-slate-50',
                unit: res?.unit || 'units',
                description: RESOURCE_METADATA[res?.name]?.description || 'Resource monitoring'
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

            {/* Stats Overview */}
            {loading ? (
                <div className="py-20 text-center text-slate-500">Loading resources...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">System Status</p>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Operational</h3>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Efficiency</p>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Good</h3>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Active Alerts</p>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Low</h3>
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
                                        <div className={`p-4 rounded-2xl shadow-sm ${res.bg} ${res.color} group-hover:scale-110 transition-transform`}>
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
                                            Inspect Data <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
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
