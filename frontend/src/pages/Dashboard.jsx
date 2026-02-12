import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState({ daily: {}, monthly: {} })
  const [usages, setUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.get('/api/usage')
        const usagesData = (data && data.usages) || []
        if (!mounted) return
        setUsages(usagesData)

        const daily = {}
        const monthly = {}
        usagesData.forEach(u => {
          const d = new Date(u.usage_date || u.date || u.createdAt)
          const dayKey = d.toISOString().slice(0, 10)
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          daily[dayKey] = (daily[dayKey] || 0) + Number(u.usage_value || u.amount || 0)
          monthly[monthKey] = (monthly[monthKey] || 0) + Number(u.usage_value || u.amount || 0)
        })
        if (!mounted) return
        setSummary({ daily, monthly })
      } catch (err) {
        if (!mounted) return
        setError(err.message || String(err))
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  if (loading) return <Loading />
  if (error) return <div className="error">{error}</div>

  const dailyLabels = Object.keys(summary.daily).sort()
  const dailyData = dailyLabels.map(l => summary.daily[l])
  const monthlyLabels = Object.keys(summary.monthly).sort()
  const monthlyData = monthlyLabels.map(l => summary.monthly[l])
  const totalUsage = usages.reduce((s, u) => s + (Number(u.usage_value || u.amount) || 0), 0)
  const recentCount = usages.length

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Overview of resource consumption</p>
        </div>
        <div>
          <button className="primary-btn" onClick={() => navigate('/usage/new')}>+ Add Usage</button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{totalUsage}</div>
          <div className="stat-label">Total Usage</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{recentCount}</div>
          <div className="stat-label">Records</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{monthlyLabels.length}</div>
          <div className="stat-label">Months</div>
        </div>
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>Daily Usage</h3>
          {dailyLabels.length > 0 ? (
            <Line data={{ labels: dailyLabels, datasets: [{ label: 'Usage', data: dailyData, borderColor: 'var(--primary)', backgroundColor: 'rgba(47,107,95,0.08)' }] }} />
          ) : (
            <div className="empty-state">No usage data yet. Add a usage record to see daily charts and alerts.</div>
          )}
        </div>

        <div className="card">
          <h3>Monthly Usage</h3>
          {monthlyLabels.length > 0 ? (
            <Bar data={{ labels: monthlyLabels, datasets: [{ label: 'Usage', data: monthlyData, backgroundColor: 'rgba(47,107,95,0.6)' }] }} />
          ) : (
            <div className="empty-state">No monthly aggregates yet. Records will appear here as you add usage.</div>
          )}
        </div>
      </div>
    </div>
  )
}
