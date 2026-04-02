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

const RESOURCE_COLORS = {
    Electricity: '#eab308',
    Water: '#3b82f6',
    Diesel: '#1e3a8a',
    Food: '#16a34a',
    LPG: '#dc2626',
    Waste: '#0d9488',
    Petrol: '#7c3aed',
    Default: '#64748b'
};

export default function TrendChart({ data, resources, title, height = 300 }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    if (!data || data.length === 0 || !data[0]?.data) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px]" style={{ color: 'var(--text-secondary)' }}>
                <p className="text-sm font-medium opacity-50 uppercase tracking-widest">No data available</p>
            </div>
        );
    }

    const labels = data[0]?.data?.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }) || [];

    const datasets = data.map((trend) => {
        const resourceName = trend.resource || 'Unknown';
        const color = RESOURCE_COLORS[resourceName] || RESOURCE_COLORS.Default;
        const resourceMeta = resources?.find(r => r.name === resourceName);
        const unit = resourceMeta?.unit || '';

        return {
            label: resourceName,
            data: trend.data.map(d => d.value || d.total || 0),
            borderColor: color,
            backgroundColor: (context) => {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return null;
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, color + '33'); // 20% opacity at top
                gradient.addColorStop(1, color + '00'); // 0% opacity at bottom
                return gradient;
            },
            borderWidth: 2.5,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            unit // store unit for tooltip
        };
    });

    const chartData = { labels, datasets };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    color: isDark ? '#94a3b8' : '#64748b',
                    font: { size: 12, weight: '600', family: 'Inter, sans-serif' }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: isDark ? '#1e293b' : '#fff',
                titleColor: isDark ? '#f1f5f9' : '#0f172a',
                bodyColor: isDark ? '#94a3b8' : '#475569',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                titleFont: { size: 13, weight: '700' },
                bodyFont: { size: 12, weight: '500' },
                callbacks: {
                    label: function (context) {
                        const val = context.parsed.y;
                        const unit = context.dataset.unit || '';
                        return ` ${context.dataset.label}: ${val.toLocaleString()} ${unit}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                    drawBorder: false
                },
                ticks: {
                    color: isDark ? '#64748b' : '#94a3b8',
                    font: { size: 11, weight: '500' },
                    callback: (value) => value >= 1000 ? (value / 1000) + 'k' : value
                }
            },
            x: {
                grid: { display: false, drawBorder: false },
                ticks: {
                    color: isDark ? '#64748b' : '#94a3b8',
                    font: { size: 11, weight: '500' }
                }
            }
        },
        interaction: { mode: 'index', intersect: false }
    };

    return (
        <div className="w-full" style={{ height }}>
            <Line data={chartData} options={options} />
        </div>
    );
}
