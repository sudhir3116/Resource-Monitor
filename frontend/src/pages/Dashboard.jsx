import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState({ daily: {}, monthly: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/usage')
      const usages = data.usages || []

      const daily = {}
      const monthly = {}

      usages.forEach(u => {
        const d = new Date(u.usage_date)
        const dayKey = d.toISOString().slice(0,10)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        daily[dayKey] = (daily[dayKey] || 0) + Number(u.usage_value)
        monthly[monthKey] = (monthly[monthKey] || 0) + Number(u.usage_value)
      })

      setSummary({ daily, monthly })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  if (loading) return <Loading />
  if (error) return <div className="error">{error}</div>

  const dailyLabels = Object.keys(summary.daily).sort()
  const dailyData = dailyLabels.map(l => summary.daily[l])
  const monthlyLabels = Object.keys(summary.monthly).sort()
  const monthlyData = monthlyLabels.map(l => summary.monthly[l])

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Dashboard</h2>
        <div>
          <button className="btn-ghost" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="card">
        <h3>Daily Usage</h3>
        {dailyLabels.length ? (
          <Line data={{ labels: dailyLabels, datasets: [{ label: 'Usage', data: dailyData, borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,0.1)' }] }} />
        ) : <p>No data</p>}
      </div>

      <div className="card">
        <h3>Monthly Usage</h3>
        {monthlyLabels.length ? (
          <Bar data={{ labels: monthlyLabels, datasets: [{ label: 'Usage', data: monthlyData, backgroundColor: 'rgba(15,118,110,0.6)' }] }} />
        ) : <p>No data</p>}
      </div>
    </div>
  )
}
