import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    Zap,
    Droplets,
    Flame,
    Wind,
    Trash2,
    Utensils,
    ArrowRight,
    Activity,
    TrendingUp,
    AlertTriangle
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { logger } from '../utils/logger';

export default function Resources() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await api.get('/api/usage/stats');
                setStats(res.data.stats || {});
            } catch (err) {
                logger.error('Failed to fetch resource stats', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    const resources = [
        {
            id: 'electricity',
            name: 'Electricity',
            icon: <Zap size={24} />,
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            unit: 'kWh',
            description: 'Grid consumption and phase balancing.'
        },
        {
            id: 'water',
            name: 'Water',
            icon: <Droplets size={24} />,
            color: 'text-blue-500',
            bg: 'bg-blue-50',
            unit: 'Liters',
            description: 'Water flow rates and storage levels.'
        },
        {
            id: 'food',
            name: 'Food',
            icon: <Utensils size={24} />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50',
            unit: 'kg',
            description: 'Mess hall consumption tracking.'
        },
        {
            id: 'lpg',
            name: 'LPG',
            icon: <Flame size={24} />,
            color: 'text-orange-500',
            bg: 'bg-orange-50',
            unit: 'kg',
            description: 'Gas cylinder usage monitoring.'
        },
        {
            id: 'diesel',
            name: 'Diesel',
            icon: <Wind size={24} />,
            color: 'text-slate-500',
            bg: 'bg-slate-50',
            unit: 'Liters',
            description: 'Generator fuel levels.'
        },
        {
            id: 'waste',
            name: 'Waste',
            icon: <Trash2 size={24} />,
            color: 'text-rose-500',
            bg: 'bg-rose-50',
            unit: 'kg',
            description: 'Waste generation and recycling.'
        }
    ];

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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {resources.map(res => (
                            <Card key={res.id}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${res.bg} ${res.color}`}>
                                        {res.icon}
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        ACTIVE
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{res.name}</h3>
                                <p className="text-sm text-slate-500 mb-6 h-10">
                                    {res.description}
                                </p>

                                <div className="flex justify-between items-end border-t pt-4 border-slate-100 dark:border-slate-800">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Usage</p>
                                        <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {stats?.[res.name]?.current || 0} <span className="text-sm font-normal text-slate-400">{res.unit}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Cost</p>
                                        <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                            ₹{stats?.[res.name]?.cost || 0}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4">
                                    <Button
                                        variant="secondary"
                                        className="w-full justify-center"
                                        onClick={() => navigate(`/usage/all?resource=${encodeURIComponent(res.name)}`)}
                                    >
                                        View Details <ArrowRight size={16} className="ml-2" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
