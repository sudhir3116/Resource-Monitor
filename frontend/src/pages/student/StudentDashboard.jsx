import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Activity, Zap, Droplets, Leaf, TrendingUp } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const StudentDashboard = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [analytics, setAnalytics] = useState(null);
  const [hostelInfo, setHostelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!authLoading && user && user.role === 'student') {
      fetchStudentAnalytics();
      fetchHostelInfo();
    }
  }, [authLoading, user]);

  const fetchHostelInfo = async () => {
    try {
      const response = await api.get('/api/students/me');
      setHostelInfo(response.data.data);
    } catch (err) {
      console.error('Hostel info error:', err);
    }
  };

  const fetchStudentAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/student/usage-analytics');
      setAnalytics(response.data.data);
    } catch (err) {
      console.error('Analytics error:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getChartOptions = (color, unit) => ({
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
        padding: 10,
        cornerRadius: 8,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: isDark ? '#334155' : '#e2e8f0', drawBorder: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 }, unit: ` ${unit}` }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
      }
    }
  });

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchStudentAnalytics}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <p className="text-gray-400">No analytics data available</p>
      </div>
    );
  }

  const { resources, carbonFootprint, sustainabilityScore, block } = analytics;

  // Prepare chart data
  const getLast7DaysLabels = () => {
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
    return labels;
  };

  const labels = getLast7DaysLabels();

  const electricityData = {
    labels,
    datasets: [{
      label: 'Electricity (kWh)',
      data: resources?.Electricity?.trend || [],
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      tension: 0.4,
      fill: true,
      borderWidth: 2,
    }]
  };

  const waterData = {
    labels,
    datasets: [{
      label: 'Water (L)',
      data: resources?.Water?.trend || [],
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true,
      borderWidth: 2,
    }]
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          🏠 {block?.name} Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Your hostel block's resource usage and sustainability metrics
        </p>
      </div>

      {/* Hostel Information Card */}
      {hostelInfo && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            🏢 Hostel Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-700/50 pb-2">
                <span className="text-gray-400">Block Name</span>
                <span className="text-white font-semibold">{hostelInfo.block}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700/50 pb-2">
                <span className="text-gray-400">Room Number</span>
                <span className="text-white font-semibold">{hostelInfo.roomNumber}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700/50 pb-2">
                <span className="text-gray-400">Floor</span>
                <span className="text-white font-semibold">{hostelInfo.floor}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-700/50 pb-2">
                <span className="text-gray-400">Assigned Warden</span>
                <span className="text-white font-semibold text-blue-400">{hostelInfo.wardenName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700/50 pb-2">
                <span className="text-gray-400">Warden Email</span>
                <a href={`mailto:${hostelInfo.wardenEmail}`} className="text-blue-400 hover:underline font-semibold">
                  {hostelInfo.wardenEmail}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Electricity Card */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Electricity</p>
              <p className="text-3xl font-bold mt-2 text-yellow-400">
                {resources?.Electricity?.current?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">kWh today</p>
            </div>
            <Zap className="text-yellow-400 opacity-40" size={40} />
          </div>
        </div>

        {/* Water Card */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Water</p>
              <p className="text-3xl font-bold mt-2 text-blue-400">
                {resources?.Water?.current?.toFixed(1) || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">liters today</p>
            </div>
            <Droplets className="text-blue-400 opacity-40" size={40} />
          </div>
        </div>

        {/* Sustainability Score */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Sustainability</p>
              <p className={`text-3xl font-bold mt-2 ${sustainabilityScore >= 80 ? 'text-green-400' :
                sustainabilityScore >= 50 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                {sustainabilityScore}%
              </p>
              <p className="text-xs text-gray-500 mt-1">score</p>
            </div>
            <Leaf className={`opacity-40 ${sustainabilityScore >= 80 ? 'text-green-400' :
              sustainabilityScore >= 50 ? 'text-yellow-400' :
                'text-red-400'
              }`} size={40} />
          </div>
        </div>

        {/* Carbon Footprint */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Carbon Footprint</p>
              <p className="text-3xl font-bold mt-2 text-purple-400">
                {carbonFootprint}
              </p>
              <p className="text-xs text-gray-500 mt-1">kg CO₂</p>
            </div>
            <Activity className="text-purple-400 opacity-40" size={40} />
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Electricity Trend */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Electricity Trend (7 days)</h2>
          </div>
          <div className="h-64">
            <Line data={electricityData} options={getChartOptions('#F59E0B', 'kWh')} />
          </div>
        </div>

        {/* Water Trend */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Droplets size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Water Trend (7 days)</h2>
          </div>
          <div className="h-64">
            <Line data={waterData} options={getChartOptions('#3B82F6', 'L')} />
          </div>
        </div>
      </div>


      {/* Resource Summary */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Resource Summary (30 days)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(resources || {}).map(([resource, stats]) => (
            <div key={resource} className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">{resource}</p>
              <p className="text-xl font-bold text-white">
                {stats.total?.toFixed(1) || 0}
              </p>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Avg: {stats.average?.toFixed(1) || 0}</span>
                <span>Max: {stats.max?.toFixed(1) || 0}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-green-900/20 border border-green-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-green-400 mb-3">💡 Sustainability Tips</h3>
        <ul className="space-y-2 text-sm text-green-300">
          <li>• Turn off lights when leaving your room</li>
          <li>• Take shorter showers to conserve water</li>
          <li>• Use stairs instead of elevators when possible</li>
          <li>• Avoid peak energy usage hours (6-9 PM)</li>
          <li>• Report water leaks immediately to maintenance</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentDashboard;
