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
import { logger } from '../utils/logger';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// Format date label for display
const formatDateLabel = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function AnalyticsPage() {
    const [period, setPeriod] = useState('daily');
    const [range, setRange] = useState('7days');
    const [loading, setLoading] = useState(true);
    const [chartsLoading, setChartsLoading] = useState(false);
    const [summary, setSummary] = useState(null);
    const [electricityTrend, setElectricityTrend] = useState([]);
    const [waterTrend, setWaterTrend] = useState([]);
    const [error, setError] = useState(null);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    // Fetch summary stats (period-dependent)
    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await api.get(`/api/analytics/summary?period=${period}`);
                setSummary(res.data);
            } catch (err) {
                logger.error('Summary fetch error:', err);
            }
        };
        fetchSummary();
    }, [period]);

    // Fetch trend chart data (range-dependent)
    useEffect(() => {
        const fetchTrends = async () => {
            try {
                setChartsLoading(true);
                setError(null);
                const [elecRes, waterRes] = await Promise.all([
                    api.get(`/api/usage/trends?resource=Electricity&range=${range}`),
                    api.get(`/api/usage/trends?resource=Water&range=${range}`)
                ]);
                setElectricityTrend(elecRes.data?.data || []);
                setWaterTrend(waterRes.data?.data || []);
            } catch (err) {
                logger.error('Trends fetch error:', err);
                setError('Failed to load trend data.');
                setElectricityTrend([]);
                setWaterTrend([]);
            } finally {
                setChartsLoading(false);
                setLoading(false);
            }
        };
        fetchTrends();
    }, [range]);

    const chartOptions = (maxVal = 0) => ({
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
                callbacks: {
                    label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} ${ctx.dataset.unit || ''}`
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                suggestedMax: maxVal > 0 ? maxVal * 1.15 : 10,
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
    });

    if (loading) {
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

    // Build chart datasets from API response: [{date, total}]
    const elecLabels = electricityTrend.map(d => formatDateLabel(d.date));
    const elecValues = electricityTrend.map(d => d.total);
    const elecMax = Math.max(...elecValues, 0);

    const waterLabels = waterTrend.map(d => formatDateLabel(d.date));
    const waterValues = waterTrend.map(d => d.total);
    const waterMax = Math.max(...waterValues, 0);

    const electricityChartData = {
        labels: elecLabels,
        datasets: [{
            label: 'Electricity (kWh)',
            unit: 'kWh',
            data: elecValues,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: isDark ? '#0f172a' : '#ffffff',
            pointBorderColor: '#2563EB',
            pointBorderWidth: 2,
            borderWidth: 2,
        }]
    };

    const waterChartData = {
        labels: waterLabels,
        datasets: [{
            label: 'Water (L)',
            unit: 'L',
            data: waterValues,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: '#3B82F6',
            borderRadius: 4,
            borderWidth: 1,
        }]
    };

    // Avg values for metric cards (computed from trend data)
    const avgElec = elecValues.length > 0
        ? Math.round(elecValues.reduce((s, v) => s + v, 0) / elecValues.length)
        : 0;
    const avgWater = waterValues.length > 0
        ? Math.round(waterValues.reduce((s, v) => s + v, 0) / waterValues.length)
        : 0;

    const rangeLabels = { '7days': '7 Days', '30days': '30 Days', 'monthly': 'This Month' };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Analytics &amp; Trends</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Detailed resource consumption analysis over time
                    </p>
                </div>

                {/* Period selector (affects summary cards) */}
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
                    value={summary?.current?.total?.toLocaleString() || 0}
                    change={summary?.percentageChange}
                />
                <MetricCard
                    icon={<Database size={20} />}
                    label="Records"
                    value={summary?.current?.records?.toLocaleString() || 0}
                />
                <MetricCard
                    icon={<Zap size={20} />}
                    label={`Avg Electricity (${rangeLabels[range]})`}
                    value={<>{avgElec} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>kWh</span></>}
                />
                <MetricCard
                    icon={<Droplets size={20} />}
                    label={`Avg Water (${rangeLabels[range]})`}
                    value={<>{avgWater} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>L</span></>}
                />
            </div>

            {/* Range selector for charts */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Chart Range:</span>
                <div className="flex gap-2">
                    {[['7days', '7 Days'], ['30days', '30 Days'], ['monthly', 'This Month']].map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => setRange(val)}
                            id={`range-btn-${val}`}
                            className={`px-3 py-1 rounded-md text-sm font-medium border transition-all ${range === val
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                }`}
                            style={{ borderColor: range === val ? '#2563EB' : 'var(--border)' }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {chartsLoading && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Loading charts…
                    </span>
                )}
            </div>

            {error && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                    {error}
                </div>
            )}

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card
                    title="Electricity Consumption Trend"
                    description={`${rangeLabels[range]} usage pattern`}
                >
                    <div className="h-[350px]">
                        {chartsLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent" />
                            </div>
                        ) : electricityTrend.length === 0 ? (
                            <EmptyState title="No data available" description="No electricity usage recorded in this period" />
                        ) : (
                            <Line data={electricityChartData} options={chartOptions(elecMax)} />
                        )}
                    </div>
                </Card>

                <Card
                    title="Water Usage Analysis"
                    description={`${rangeLabels[range]} volume comparison`}
                >
                    <div className="h-[350px]">
                        {chartsLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent" />
                            </div>
                        ) : waterTrend.length === 0 ? (
                            <EmptyState title="No data available" description="No water usage recorded in this period" />
                        ) : (
                            <Bar data={waterChartData} options={chartOptions(waterMax)} />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
