import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Zap, Droplets, Leaf, TrendingUp, TrendingDown } from 'lucide-react';
import Card, { MetricCard } from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';

export default function StudentDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const response = await api.get('/api/dashboard/student');
                setStats(response.data.data || response.data);
            } catch (err) {
                console.error("Failed to fetch student dashboard", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

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

    const { personalUsage = [] } = stats || {};

    // Calculate metrics
    const totalElec = personalUsage.find(p => p._id === 'Electricity')?.total || 0;
    const totalWater = personalUsage.find(p => p._id === 'Water')?.total || 0;
    const carbonFootprint = (totalElec * 0.85 + totalWater * 0.12).toFixed(1);
    const score = Math.max(0, Math.min(100, 100 - (totalElec / 5) * 10));

    const getScoreColor = (score) => {
        if (score >= 80) return 'var(--color-success)';
        if (score >= 60) return 'var(--color-primary)';
        if (score >= 40) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    const getScoreBadge = (score) => {
        if (score >= 80) return { text: 'Excellent', variant: 'success' };
        if (score >= 60) return { text: 'Good', variant: 'primary' };
        if (score >= 40) return { text: 'Fair', variant: 'warning' };
        return { text: 'Needs Improvement', variant: 'danger' };
    };

    const scoreBadge = getScoreBadge(score);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 style={{ color: 'var(--text-primary)' }}>My Usage Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Track your resource consumption and sustainability metrics
                </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    icon={<Zap size={20} />}
                    label="Electricity"
                    value={<>{totalElec} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>kWh</span></>}
                />

                <MetricCard
                    icon={<Droplets size={20} />}
                    label="Water"
                    value={<>{totalWater} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>L</span></>}
                />

                <MetricCard
                    icon={<Leaf size={20} />}
                    label="Sustainability Score"
                    value={<span style={{ color: getScoreColor(score) }}>{Math.round(score)}</span>}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Details */}
                <Card title="Sustainability Performance" description="Your environmental impact this month">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }}>Current Score</span>
                            <span className="font-semibold" style={{ color: getScoreColor(score) }}>
                                {Math.round(score)}%
                            </span>
                        </div>
                        <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
                            <div
                                className="h-full transition-all duration-500 rounded-full"
                                style={{
                                    width: `${score}%`,
                                    backgroundColor: getScoreColor(score)
                                }}
                            />
                        </div>
                        <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <span className={`badge badge-${scoreBadge.variant}`}>
                                {scoreBadge.text}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Carbon Footprint */}
                <Card title="Carbon Footprint" description="This month">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {carbonFootprint}
                        </span>
                        <span className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                            kg CO₂
                        </span>
                    </div>
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2 text-sm">
                            <TrendingDown size={16} style={{ color: 'var(--color-success)' }} />
                            <span style={{ color: 'var(--color-success)' }}>
                                12% lower than average
                            </span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Tips */}
            <Card title="Quick Tips" description="Improve your sustainability score">
                <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-start gap-2">
                        <span style={{ color: 'var(--color-success)' }}>•</span>
                        <span>Turn off AC when leaving your room to save electricity</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span style={{ color: 'var(--color-success)' }}>•</span>
                        <span>Take shorter showers to reduce water consumption</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span style={{ color: 'var(--color-success)' }}>•</span>
                        <span>Unplug chargers when not in use</span>
                    </li>
                </ul>
            </Card>
        </div>
    );
}
