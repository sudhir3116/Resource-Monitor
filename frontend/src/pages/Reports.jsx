import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'

export default function Reports(){
  const [usages, setUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{ load() }, [])
  async function load(){ setLoading(true); try{ const d = await api.get('/api/usage'); setUsages(d.usages||[]) }catch(e){ setError(e.message) } finally{ setLoading(false) } }

  function downloadCSV(){
    // trigger backend CSV export
    const token = localStorage.getItem('token')
    const url = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api/reports/usages/csv'
    const a = document.createElement('a')
    a.href = url
    if (token) a.setAttribute('data-token', token)
    // Use fetch to get blob then download (to attach Authorization)
    fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
      .then(r => r.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = u
        link.download = 'usages.csv'
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(u)
      })
  }
 
  function exportClientCSV(){
    if(!usages || !usages.length) return
    const keys = ['resource_type','usage_value','usage_date','notes']
    const rows = usages.map(u => keys.map(k => JSON.stringify(u[k] ?? '')).join(','))
    const csv = [keys.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'usages-export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
 
  function printReport(){
    window.print()
  }

  const totalRecords = usages.length
  const totalUsage = usages.reduce((s,u)=> s + (Number(u.usage_value)||0), 0)
  const uniqueResources = Array.from(new Set(usages.map(u=>u.resource_type))).length
 
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Reports</h2>
          <div className="muted">Professional, exportable reports for your usage data</div>
        </div>
        <div className="report-actions">
          <button onClick={downloadCSV} className="btn small">Download CSV</button>
          <button onClick={exportClientCSV} className="btn secondary small">Export (client)</button>
          <button onClick={printReport} className="btn small">Print</button>
        </div>
      </div>
 
      {loading ? <Loading /> : error ? <div className="error">{error}</div> : (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
            <div className="stat-card">
              <div className="stat-value">{totalRecords}</div>
              <div className="stat-label">Total Records</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalUsage}</div>
              <div className="stat-label">Total Usage</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{uniqueResources}</div>
              <div className="stat-label">Resource Types</div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="usage-table">
                <thead><tr><th>Resource</th><th>Value</th><th>Date</th><th>Notes</th></tr></thead>
                <tbody>{usages.map(u=> <tr key={u._id}><td>{u.resource_type}</td><td>{u.usage_value}</td><td>{new Date(u.usage_date).toLocaleString()}</td><td>{u.notes}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
