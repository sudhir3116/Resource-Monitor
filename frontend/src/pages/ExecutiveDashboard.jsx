import React, { useEffect, useState, useContext } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import api from '../services/api';
import { Download, Zap, Droplets, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import Card, { MetricCard } from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import { logger } from '../utils/logger';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function ExecutiveDashboard() {
    const [stats, setStats] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [leaderboard, setLeaderboard] = useState(null);
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    useEffect(() => {
        async function fetchStats() {
            try {
                setLoading(true);
                const [dashboardRes, leaderboardRes] = await Promise.all([
                    api.get('/api/dashboard/executive'),
                    api.get('/api/analytics/leaderboard').catch(() => ({ data: { leaderboard: [] } }))
                ]);

                setStats(dashboardRes.data.data || dashboardRes.data);

                if (leaderboardRes.data?.leaderboard) {
                    setLeaderboard(leaderboardRes.data);
                }
            } catch (err) {
                logger.error("Failed to fetch executive dashboard", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    // Refetch electricity trend whenever `days` changes
    useEffect(() => {
        async function fetchTrend() {
            try {
                const range = days === 30 ? '30days' : '7days';
                const res = await api.get(`/api/usage/trends?resource=Electricity&range=${range}`);
                setTrendData(res.data?.data || []);
            } catch (err) {
                logger.error('Failed to fetch electricity trend', err);
                setTrendData([]);
            }
        }
        fetchTrend();
    }, [days]);

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
        return null;
    }

    const { trends, financial, blockRanking = [] } = stats;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
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
                beginAtZero: true,
                grid: {
                    color: isDark ? '#334155' : '#e2e8f0',
                    drawBorder: false,
                },
                ticks: {
                    color: isDark ? '#64748b' : '#64748b',
                    font: { size: 11 }
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    color: isDark ? '#64748b' : '#64748b',
                    font: { size: 11 }
                }
            }
        }
    };

    // trendData is now [{date:'2026-02-20', total:450}, ...]
    const elecLabels = trendData.map(d =>
        new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    );
    const elecValues = trendData.map(d => d.total);
    const elecMax = Math.max(...elecValues, 0);

    const electricityData = {
        labels: elecLabels,
        datasets: [{
            label: 'Electricity (kWh)',
            data: elecValues,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: isDark ? '#0f172a' : '#ffffff',
            pointBorderColor: '#2563EB',
            pointBorderWidth: 2,
            borderWidth: 2,
        }],
    };

    const chartOptionsWithScale = {
        ...chartOptions,
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                beginAtZero: true,
                suggestedMax: elecMax > 0 ? elecMax * 1.15 : 10,
            }
        }
    };

    const resourceData = {
        labels: ['Electricity', 'Water'],
        datasets: [{
            data: [trends.electricity.current, trends.water.current],
            backgroundColor: ['#F59E0B', '#3B82F6'],
            borderWidth: 0,
        }]
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Executive Overview</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Campus-wide resource analytics and financial reporting
                    </p>
                </div>
                <Button variant="secondary">
                    <Download size={16} className="mr-2" />
                    Export Report
                </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    icon={<DollarSign size={20} />}
                    label="Total Cost"
                    value={<span style={{ color: 'var(--color-success)' }}>₹{parseFloat(financial.estimatedCost).toLocaleString()}</span>}
                />

                <MetricCard
                    icon={<Zap size={20} />}
                    label="Total Electricity"
                    value={<>{trends.electricity.current.toLocaleString()} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>kWh</span></>}
                    change={trends.electricity.percentageChange}
                />

                <MetricCard
                    icon={<Droplets size={20} />}
                    label="Total Water"
                    value={<>{trends.water.current.toLocaleString()} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>L</span></>}
                    change={trends.water.percentageChange}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart */}
                <Card
                    title="Electricity Trend"
                    description={days === 7 ? "Last 7 days usage pattern" : "Last 30 days usage pattern"}
                    action={
                        <select
                            className="text-sm p-1 rounded border dark:bg-slate-800 dark:border-slate-700"
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                        >
                            <option value={7}>7 Days</option>
                            <option value={30}>30 Days</option>
                        </select>
                    }
                >
                    <div className="h-[300px]">
                        {trendData.length === 0 ? (
                            <EmptyState title="No data available" description="No electricity usage recorded in this period" />
                        ) : (
                            <Line data={electricityData} options={chartOptionsWithScale} />
                        )}
                    </div>
                </Card>

                {/* Resource Distribution */}
                <Card title="Resource Distribution" description="Current month breakdown">
                    <div className="h-[300px] flex items-center justify-center">
                        <div className="w-full max-w-[250px]">
                            <Pie data={resourceData} options={{ ...chartOptions, scales: undefined }} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Block Performance Table */}
            <Card title="Hostel Leaderboard" description="Efficiency Index Ranking">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top 3 */}
                    <div>
                        <h3 className="font-semibold mb-3 text-green-500">🏆 Top 3 Efficient Blocks</h3>
                        <div className="space-y-3">
                            {leaderboard?.top3?.map((block, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
                                            {idx + 1}
                                        </div>
                                        <span className="font-medium">{block.blockName}</span>
                                    </div>
                                    <span className="font-bold text-green-500">{block.score}%</span>
                                </div>
                            )) || <p className="text-sm text-slate-500">No data available</p>}
                        </div>
                    </div>

                    {/* Bottom 3 */}
                    <div>
                        <h3 className="font-semibold mb-3 text-red-500">⚠️ Needs Improvement</h3>
                        <div className="space-y-3">
                            {leaderboard?.bottom3?.map((block, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
                                            !
                                        </div>
                                        <span className="font-medium">{block.blockName}</span>
                                    </div>
                                    <span className="font-bold text-red-500">{block.score}%</span>
                                </div>
                            )) || <p className="text-sm text-slate-500">No data available</p>}
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Block Name</th>
                                    <th className="text-center">Efficiency Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard?.leaderboard?.map((block, idx) => (
                                    <tr key={idx}>
                                        <td className="w-16">
                                            #{idx + 1}
                                        </td>
                                        <td className="font-semibold">
                                            {block.blockName}
                                        </td>
                                        <td className="text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${block.score >= 80 ? 'bg-green-100 text-green-700' :
                                                block.score >= 60 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {block.score}% (Grade {block.score >= 90 ? 'A' : block.score >= 80 ? 'B' : block.score >= 70 ? 'C' : block.score >= 60 ? 'D' : 'F'})
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>
        </div>
    );
}
