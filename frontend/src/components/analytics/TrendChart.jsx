import React from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function TrendChart({ data, resources, title, height = 300 }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border border-dashed border-slate-200 dark:border-white/5">
                <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.4em] text-xs">No Telemetry Stream Detected</p>
            </div>
        );
    }

    // Prepare chart data
    const labels = data[0]?.data?.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }) || [];

    const datasets = data.map((trend, index) => {
        const resource = (resources || []).find(r => r.name === trend.resource);
        const color = resource?.color || ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'][index % 6];
        const emoji = resource?.icon || resource?.emoji || '📊';
        return {
            label: `${emoji} ${resource?.name || trend.resource || 'UNKNOWN'}`,
            data: trend.data.map(d => d.value),
            borderColor: color,
            backgroundColor: color + '33', // gradient fill
            borderWidth: 4,
            tension: 0.45,
            fill: true,
            pointRadius: 6,
            pointHoverRadius: 10,
            pointBackgroundColor: color,
            pointBorderColor: isDark ? '#0f172a' : '#fff',
            pointBorderWidth: 3,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 4,
        };
    });

    const chartData = {
        labels,
        datasets
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 1200,
            easing: 'easeInOutQuart',
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    padding: 30,
                    color: isDark ? '#94a3b8' : '#64748b',
                    font: {
                        size: 13,
                        weight: 'bold',
                        family: 'Outfit'
                    }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                titleColor: isDark ? '#f8fafc' : '#0f172a',
                bodyColor: isDark ? '#94a3b8' : '#64748b',
                padding: 16,
                cornerRadius: 20,
                titleFont: {
                    size: 15,
                    weight: 'bold',
                    family: 'Outfit'
                },
                bodyFont: {
                    size: 13,
                    weight: 'bold',
                    family: 'Outfit'
                },
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                shadowColor: 'rgba(0,0,0,0.5)',
                callbacks: {
                    label: function (context) {
                        const label = context.dataset.label || '';
                        const value = context.parsed.y;
                        return `${label}: ${value?.toLocaleString?.() ?? value}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                    drawBorder: false
                },
                ticks: {
                    padding: 15,
                    color: isDark ? '#475569' : '#94a3b8',
                    font: {
                        size: 12,
                        weight: 'bold',
                        family: 'Outfit'
                    }
                }
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    padding: 15,
                    color: isDark ? '#475569' : '#94a3b8',
                    font: {
                        size: 12,
                        weight: 'bold',
                        family: 'Outfit'
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    return (
        <div className="p-8 pb-12">
            <div style={{ height, position: 'relative' }}>
                <Line data={chartData} options={options} />
            </div>
        </div>
    );
}
