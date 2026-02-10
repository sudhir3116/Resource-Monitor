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

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between'}}>
        <h2>Reports</h2>
        <button onClick={downloadCSV} className="btn">Download CSV</button>
      </div>
      {loading ? <Loading /> : error ? <div className="error">{error}</div> : (
        <table className="usage-table">
          <thead><tr><th>Resource</th><th>Value</th><th>Date</th><th>Notes</th></tr></thead>
          <tbody>{usages.map(u=> <tr key={u._id}><td>{u.resource_type}</td><td>{u.usage_value}</td><td>{new Date(u.usage_date).toLocaleString()}</td><td>{u.notes}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  )
}
