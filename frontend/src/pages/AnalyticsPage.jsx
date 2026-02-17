import React, { useEffect, useState, useContext } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import api from '../services/api';
import { Download, Calendar, Activity, Database, Zap, Droplets } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import Card, { MetricCard } from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

export default function AnalyticsPage() {
    const [period, setPeriod] = useState('daily');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const [summaryRes, trendsRes] = await Promise.all([
                api.get(`/api/analytics/summary?period=${period}`),
                api.get('/api/analytics/trends?days=7')
            ]);

            setStats({
                summary: summaryRes.data,
                trends: trendsRes.data
            });
        } catch (err) {
            console.error('Analytics fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: isDark ? '#94a3b8' : '#64748b',
                    font: { family: 'Inter', size: 12 }
                }
            },
            tooltip: {
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                titleColor: isDark ? '#f1f5f9' : '#0f172a',
                bodyColor: isDark ? '#cbd5e1' : '#475569',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
            }
        },
        scales: {
            y: {
                grid: {
                    color: isDark ? '#334155' : '#e2e8f0',
                    drawBorder: false,
                },
                ticks: {
                    color: isDark ? '#94a3b8' : '#64748b',
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    color: isDark ? '#94a3b8' : '#64748b',
                }
            }
        }
    };

    if (loading && !stats) {
        return (
            <div className="space-y-6">
                <div className="h-8 rounded" style={{ backgroundColor: 'var(--bg-hover)', width: '200px' }}></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
                    ))}
                </div>
                <div className="h-96 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }}></div>
            </div>
        );
    }

    if (!stats) return <EmptyState title="No Data Available" />;

    const { summary, trends } = stats;

    const electricityData = {
        labels: trends.trends?.map(t => t.date) || [],
        datasets: [{
            label: 'Electricity (kWh)',
            data: trends.trends?.map(t => t.electricity) || [],
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.4
        }]
    };

    const waterData = {
        labels: trends.trends?.map(t => t.date) || [],
        datasets: [{
            label: 'Water (L)',
            data: trends.trends?.map(t => t.water) || [],
            backgroundColor: '#3B82F6',
            borderRadius: 4
        }]
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Analytics & Trends</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Detailed resource consumption analysis over time
                    </p>
                </div>

                <div className="flex bg-white dark:bg-slate-800 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
                    {['daily', 'weekly', 'monthly'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${period === p
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard
                    icon={<Activity size={20} />}
                    label="Total Usage"
                    value={summary.current?.total?.toLocaleString() || 0}
                    change={summary.trend}
                />
                <MetricCard
                    icon={<Database size={20} />}
                    label="Records"
                    value={summary.current?.records?.toLocaleString() || 0}
                />
                <MetricCard
                    icon={<Zap size={20} />}
                    label="Avg Electricity"
                    value="450 kWh" // Mock or calc from data
                />
                <MetricCard
                    icon={<Droplets size={20} />}
                    label="Avg Water"
                    value="120 L" // Mock or calc from data
                />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Electricity Consumption Trend" description="Daily usage pattern">
                    <div className="h-[350px]">
                        <Line data={electricityData} options={chartOptions} />
                    </div>
                </Card>

                <Card title="Water Usage Analysis" description="Daily volume comparison">
                    <div className="h-[350px]">
                        <Bar data={waterData} options={chartOptions} />
                    </div>
                </Card>
            </div>
        </div>
    );
}
