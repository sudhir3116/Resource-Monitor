import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Activity, Leaf, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { logger } from '../../utils/logger';
import Button from '../../components/common/Button';
import { useResources } from '../../hooks/useResources';

const StudentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState({});
  const [trends, setTrends] = useState([]);
  const [complaintCount, setComplaintCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { theme } = useContext(ThemeContext);
  const { resources } = useResources();  // Get active resources from single source

  const fetchData = useCallback(async () => {
    if (authLoading || !user) return;

    setLoading(true);
    setError(null);

    try {
      const [summaryRes, trendsRes, complaintsRes] = await Promise.allSettled([
        api.get('/api/usage/summary'),
        api.get('/api/usage/trends?range=30d'),
        api.get('/api/complaints')
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data?.data?.summary || {});
      } else {
        logger.error('Summary fetch failed:', summaryRes.reason?.message);
      }

      if (trendsRes.status === 'fulfilled') {
        const data = trendsRes.value.data?.data;
        setTrends(Array.isArray(data) ? data : []);
      } else {
        logger.error('Trends fetch failed:', trendsRes.reason?.message);
      }

      if (complaintsRes.status === 'fulfilled') {
        const complaints =
          complaintsRes.value.data?.data ||
          complaintsRes.value.data?.complaints ||
          [];
        setComplaintCount(Array.isArray(complaints) ? complaints.length : 0);
      }

    } catch (err) {
      logger.error('Student dashboard error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    fetchData();
    const refresh = () => fetchData();
    window.addEventListener('usage:added', refresh);
    return () => window.removeEventListener('usage:added', refresh);
  }, [fetchData]);

  const getResourceMeta = (type) => {
    const match = (Array.isArray(resources) ? resources : []).find(r => r?.name === type);
    return {
      icon: match?.icon || '📊',
      color: match?.color || '#64748b',
      unit: match?.unit || 'units',
    };
  };

  const displayValue = (name) => {
    const data = summary[name];
    if (!data || data.total === 0) return 'No data available';
    return `${data.total.toLocaleString()} ${data.unit || ''}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          title="Dashboard Error"
          description={error}
          action={<Button onClick={fetchData}>Retry</Button>}
        />
      </div>
    );
  }

  const sustainabilityScore = (() => {
    const totals = Object.values(summary || {}).map(v => Number(v?.total || 0));
    const any = totals.some(v => v > 0);
    return any ? 85 : 0;
  })();

  const sustainabilityColor = (score) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            🏠 Welcome, {user?.name || 'Student'}
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time sustainability tracking for your hostel block
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1">
            Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Badge>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Array.isArray(resources) ? resources : []).map((r) => {
          const name = r?.name;
          if (!name) return null;
          const data = summary?.[name] || {};
          const meta = getResourceMeta(name);
            const pct = data.dailyThreshold && data.total > 0
              ? Math.round((data.total / data.dailyThreshold) * 100)
              : 0;

            return (
              <Card key={name} className="p-4"
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: meta.color
                }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{meta.icon || '📊'}</span>
                  <span className="font-medium text-sm"
                    style={{
                      color: 'var(--text-primary)'
                    }}>
                    {name}
                  </span>
                </div>
                <p className="text-2xl font-bold"
                  style={{ color: 'var(--text-primary)' }}>
                  {data.total > 0
                    ? data.total.toLocaleString()
                    : 'No data'}
                </p>
                <p className="text-xs mt-1"
                  style={{
                    color: 'var(--text-secondary)'
                  }}>
                  {data.unit}
                  {data.dailyThreshold > 0 &&
                    ` / ${data.dailyThreshold} daily limit`}
                </p>
                {data.dailyThreshold > 0 &&
                  data.total > 0 && (
                    <div className="w-full h-1 rounded-full mt-2 overflow-hidden"
                      style={{
                        backgroundColor: 'var(--bg-secondary)'
                      }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: meta.color
                        }}
                      />
                    </div>
                  )}
              </Card>
            );
        })}
      </div>

      {Object.keys(summary).length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            No resource data for your block yet
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-emerald-500">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sustainability Score</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${sustainabilityColor(sustainabilityScore)}`}>
                {sustainabilityScore}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${sustainabilityScore}%` }}
              />
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-blue-500">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Complaints</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-blue-600">{complaintCount}</span>
              <span className="text-slate-400 text-sm">submitted</span>
            </div>
          </div>
        </Card>

        <Card className="border-l-4 border-purple-500">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Block</span>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {user?.blockName || user?.block || 'Not assigned'}
            </div>
            <p className="text-[11px] text-slate-400">Your assigned hostel block</p>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2">
          <Card title="Monthly Resource Trends" description="Last 30 days usage across all resources">
            <div className="h-[300px] w-full mt-4">
              {trends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <span className="text-4xl mb-2">📊</span>
                  <p className="text-sm italic">No trend data available yet</p>
                  <p className="text-xs mt-1">Data will appear once usage is recorded</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-secondary)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => {
                        try {
                          return new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        } catch { return val; }
                      }}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend />
                    {(Array.isArray(resources) ? resources : []).map(r => (
                      <Line
                        key={r?.name}
                        type="monotone"
                        dataKey={r?.name}
                        stroke={r?.color || '#64748b'}
                        strokeWidth={2}
                        dot={false}
                        name={r?.name}
                        connectNulls={true}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Tips */}
        <div>
          <Card className="bg-slate-900 text-white border-0 shadow-xl h-full">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Leaf className="text-emerald-500" size={18} />
              Sustainability Tips
            </h4>
            <div className="space-y-4">
              {[
                'Switch off fans and lights when leaving the room.',
                'Report any water leaks in common areas immediately.',
                'Use stairs instead of lifts for floors 1–3.',
                'Carry your own reusable water bottle to reduce waste.'
              ].map((tip, idx) => (
                <div key={idx} className="flex gap-3 text-sm text-slate-300">
                  <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-500 shrink-0">
                    {idx + 1}
                  </div>
                  <p className="leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
