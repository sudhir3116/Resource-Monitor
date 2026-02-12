import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'
import UsageFilter from '../components/UsageFilter'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()

  // State for usages
  const [usages, setUsages] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Derive filters directly from URL
  const filters = useMemo(() => ({
    resource: searchParams.get('resource') || '',
    category: searchParams.get('category') || '',
    start: searchParams.get('start') || '',
    end: searchParams.get('end') || '',
    sort: searchParams.get('sort') || 'usage_date:desc'
  }), [searchParams])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch filtered usages
      const params = new URLSearchParams(filters)
      // Clean empty params
      for (const [key, value] of params.entries()) {
        if (!value) params.delete(key)
      }

      const usageRes = await api.get(`/api/usage?${params.toString()}`)
      const usageData = (usageRes && usageRes.usages) || []
      setUsages(usageData)

      // 2. Fetch Intelligent Stats (Predictive, Score, Alerts)
      const statsRes = await api.get('/api/usage/stats')
      if (statsRes) {
        setDashboardStats(statsRes)
      }

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load dashboard data')
      addToast(err.message || 'Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Reload when filters change (URL changes)
  useEffect(() => {
    fetchDashboardData()
  }, [filters])

  const handleFilterChange = (newFilters) => {
    // Update URL params
    const nextParams = {}
    Object.keys(newFilters).forEach(key => {
      if (newFilters[key]) nextParams[key] = newFilters[key]
    })
    setSearchParams(nextParams)
  }

  // Memoize Chart Data Calculation
  const { dailyLabels, dailyData, monthlyLabels, monthlyData } = useMemo(() => {
    const daily = {}
    const monthly = {}
    usages.forEach(u => {
      const d = new Date(u.usage_date || u.date)
      const dayKey = d.toISOString().slice(0, 10)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      daily[dayKey] = (daily[dayKey] || 0) + Number(u.usage_value || u.amount || 0)
      monthly[monthKey] = (monthly[monthKey] || 0) + Number(u.usage_value || u.amount || 0)
    })

    return {
      dailyLabels: Object.keys(daily).sort(),
      dailyData: Object.keys(daily).sort().map(l => daily[l]),
      monthlyLabels: Object.keys(monthly).sort(),
      monthlyData: Object.keys(monthly).sort().map(l => monthly[l])
    }
  }, [usages])


  if (loading && !usages.length) return <Loading />

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Sustainable Resource Monitoring & Insights</p>
        </div>
        <div>
          <button className="primary-btn" onClick={() => navigate('/usage/new')}>+ Add Usage</button>
        </div>
      </div>

      {/* Advanced Filter Bar - Controlled by URL params passed as filters prop */}
      <UsageFilter filters={filters} onFilterChange={handleFilterChange} />

      {error && <div className="form-error" style={{ marginBottom: 20 }}>{error}</div>}

      <div className="dashboard-grid">

        {/* 1. Sustainability Score Card */}
        <div className="stat-card center" style={{ textAlign: 'center' }}>
          <h3 style={{ width: '100%', textAlign: 'left', marginBottom: 20 }}>Sustainability Score</h3>
          {dashboardStats ? (
            <div>
              <div className={`score-indicator ${dashboardStats.sustainabilityScore >= 85 ? 'excellent' : dashboardStats.sustainabilityScore >= 60 ? 'moderate' : 'poor'}`}>
                {dashboardStats.sustainabilityScore}
              </div>
              <div className="score-label">
                {dashboardStats.sustainabilityScore >= 85 ? 'Excellent' : dashboardStats.sustainabilityScore >= 60 ? 'Moderate' : 'Needs Improvement'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Based on monthly usage & spikes</div>
            </div>
          ) : (
            <div className="empty-state">Loading...</div>
          )}
        </div>

        {/* 2. Predictive Usage Card */}
        <div className="stat-card">
          <h3>Monthly Estimates</h3>
          {dashboardStats && dashboardStats.stats ? (
            Object.keys(dashboardStats.stats).length > 0 ? (
              Object.entries(dashboardStats.stats).map(([resource, data]) => (
                <div key={resource} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>{resource}</strong>
                    <span className={`badge ${data.current > data.predicted ? 'badge-danger' : 'badge-success'}`}>
                      {data.current > data.predicted ? 'High' : 'Normal'}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>Current:</span>
                    <strong>{data.current} <span style={{ fontSize: 10, fontWeight: 400 }}>units</span></strong>
                  </div>
                  <div className="stat-row">
                    <span>Predicted:</span>
                    <strong>{data.predicted} <span style={{ fontSize: 10, fontWeight: 400 }}>units</span></strong>
                  </div>
                </div>
              ))
            ) : <EmptyState icon="📊" title="No Estimates" description="Not enough data yet." />
          ) : (
            <div className="empty-state">Loading...</div>
          )}
        </div>

        {/* 3. Recent Alerts Card */}
        <div className="stat-card">
          <h3>Recent Alerts</h3>
          {dashboardStats && dashboardStats.recentAlerts && dashboardStats.recentAlerts.length > 0 ? (
            <div>
              {dashboardStats.recentAlerts.map(alert => (
                <div key={alert._id} className={`alert-item ${alert.status === 'danger' ? 'danger' : 'warning'}`}>
                  <div className="alert-message">{alert.message}</div>
                  <span className="alert-date">{new Date(alert.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <Link to="/alerts" style={{ fontSize: 13 }}>View All Alerts</Link>
              </div>
            </div>
          ) : (
            <EmptyState icon="✅" title="No Alerts" description="Everything looks good!" />
          )}
        </div>
      </div>

      {/* Chart Section */}
      <div className="card-grid">
        <div className="card">
          <h3>Daily Trends</h3>
          {dailyLabels.length > 0 ? (
            <Line data={{
              labels: dailyLabels,
              datasets: [{
                label: 'Usage Value',
                data: dailyData,
                borderColor: '#2F6B5F',
                backgroundColor: 'rgba(47,107,95,0.1)',
                tension: 0.3,
                fill: true
              }]
            }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          ) : (
            <EmptyState title="No Daily Data" description="Try adjusting your filters." />
          )}
        </div>

        <div className="card">
          <h3>Monthly Overview</h3>
          {monthlyLabels.length > 0 ? (
            <Bar data={{
              labels: monthlyLabels,
              datasets: [{
                label: 'Total Usage',
                data: monthlyData,
                backgroundColor: '#2F6B5F',
                borderRadius: 4
              }]
            }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          ) : (
            <EmptyState title="No Monthly Data" description="Check back later." />
          )}
        </div>
      </div>
    </div>
  )
}
