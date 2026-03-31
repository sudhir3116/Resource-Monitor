import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DonutChart({ data, resources, height = 260 }) {
  // data: [{ resource, value }]
  const chartData = {
    labels: data.map(d => {
      const r = resources.find(r => r.name === d.resource);
      return `${r?.icon || r?.emoji || '📊'} ${r?.name || d.resource}`;
    }),
    datasets: [
      {
        data: data.map(d => d.value),
        backgroundColor: data.map(d => {
          const r = resources.find(r => r.name === d.resource);
          return (r?.color || '#3B82F6') + 'CC'; // 80% opacity
        }),
        borderColor: data.map(d => {
          const r = resources.find(r => r.name === d.resource);
          return r?.color || '#3B82F6';
        }),
        borderWidth: 4,
        hoverOffset: 16,
        spacing: 6,
      },
    ],
  };

  const options = {
    cutout: '70%',
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          usePointStyle: true,
          font: { size: 13, weight: 'bold', family: 'Outfit' },
          color: '#64748b',
          padding: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const r = resources.find(r => r.name === data[context.dataIndex].resource);
            return `${r?.icon || r?.emoji || '📊'} ${r?.name || ''}: ${context.parsed} ${r?.unit || ''}`;
          },
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
    },
  };

  return (
    <div style={{ height }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
