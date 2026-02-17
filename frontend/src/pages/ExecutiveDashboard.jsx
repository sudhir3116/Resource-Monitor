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
import Button from '../components/common/Button';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function ExecutiveDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { theme } = useContext(ThemeContext);
    const isDark = theme === 'dark';

    useEffect(() => {
        async function fetchStats() {
            try {
                const response = await api.get('/api/dashboard/executive');
                setStats(response.data.data || response.data);
            } catch (err) {
                console.error("Failed to fetch executive dashboard", err);
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

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const electricityData = {
        labels: days,
        datasets: [{
            label: 'Electricity (kWh)',
            data: [1200, 1350, 1250, 1400, 1600, 1100, 1050],
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
                {/* Weekly Trend */}
                <Card title="Weekly Electricity Trend" description="Last 7 days usage pattern">
                    <div className="h-[300px]">
                        <Line data={electricityData} options={chartOptions} />
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
            <Card title="Block Performance" description="Per-capita consumption comparison">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Block</th>
                                <th className="text-right">Occupancy</th>
                                <th className="text-right">Per Capita</th>
                                <th className="text-center">Rating</th>
                            </tr>
                        </thead>
                        <tbody>
                            {blockRanking.map((block, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                                                <span className="text-sm font-semibold">
                                                    {block.name.charAt(0)}
                                                </span>
                                            </div>
                                            <span className="font-semibold">{block.name}</span>
                                        </div>
                                    </td>
                                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                                        1,000 students
                                    </td>
                                    <td className="text-right font-semibold">
                                        {block.perCapita} <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>kWh</span>
                                    </td>
                                    <td className="text-center">
                                        <span className={`badge ${block.perCapita < 100
                                            ? 'badge-success'
                                            : block.perCapita < 150
                                                ? 'badge-warning'
                                                : 'badge-danger'
                                            }`}>
                                            {block.perCapita < 100 ? 'A+' : block.perCapita < 150 ? 'C' : 'F'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 pt-4 border-t text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    Showing {blockRanking.length} of {blockRanking.length} blocks
                </div>
            </Card>
        </div>
    );
}
