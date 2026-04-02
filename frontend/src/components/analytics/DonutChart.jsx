import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

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

export default function DonutChart({ data, resources, height = 260 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full opacity-50 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        No data available
      </div>
    );
  }

  const totalValue = data.reduce((sum, item) => sum + (item.value || 0), 0);

  const chartData = {
    labels: data.map(d => d.resource),
    datasets: [
      {
        data: data.map(d => d.value || 0),
        backgroundColor: data.map(d => RESOURCE_COLORS[d.resource] || RESOURCE_COLORS.Default),
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 4,
        spacing: 4,
      },
    ],
  };

  const options = {
    cutout: '75%',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12, weight: '600', family: 'Inter, sans-serif' },
          color: '#64748b',
          padding: 15,
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = totalValue > 0 ? Math.round((value / totalValue) * 100) : 0;
                return {
                  text: `${label} ${percentage}%`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: 'transparent',
                  lineWidth: 0,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 13, weight: '700' },
        bodyFont: { size: 12, weight: '500' },
        callbacks: {
          label: function (context) {
            const value = context.parsed;
            const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
            return ` ${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
