import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'

export default function AlertsList(){
  const [rules, setRules] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{ load() }, [])
  async function load(){
    setLoading(true)
    try{
      const res = await api.get('/api/alerts')
      // API returns { rules, logs } (logs may also be available via /logs/all)
      const fetchedRules = res.rules || []
      let fetchedLogs = res.logs || []
      if (!fetchedLogs || !fetchedLogs.length) {
        try {
          const fallback = await api.get('/api/alerts/logs/all')
          fetchedLogs = fallback.logs || fetchedLogs
        } catch (e) {
          // ignore fallback errors
        }
      }
      setRules(fetchedRules)
      setLogs(fetchedLogs)
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  async function remove(id){ if(!confirm('Delete?')) return; await api.del(`/api/alerts/${id}`); setRules(rs=>rs.filter(x=>x._id!==id)) }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h2>Alert Rules</h2>
        <Link to="/alerts/new" className="btn">New Rule</Link>
      </div>

      {loading ? <Loading /> : error ? <div className="error">{error}</div> : (
        <>
          <div className="card">
            <table className="usage-table">
              <thead><tr><th>Resource</th><th>Threshold</th><th>Comparison</th><th>Active</th><th></th></tr></thead>
              <tbody>{rules.map(r=> (
                <tr key={r._id}>
                  <td>{r.resource_type}</td>
                  <td>{r.threshold_value}</td>
                  <td>{r.comparison}</td>
                  <td>{String(r.active)}</td>
                  <td>
                    <Link to={`/alerts/${r._id}/edit`} className="btn-ghost">Edit</Link>
                    <button onClick={()=>remove(r._id)} className="btn-ghost">Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <h2 style={{marginTop:20}}>Alert History</h2>
          {(!logs || logs.length === 0) ? (
            <div className="empty-state">No alerts triggered yet.</div>
          ) : (
            <div className="card" style={{marginTop:12}}>
              <table className="usage-table">
                <thead><tr><th>When</th><th>Resource</th><th>Value</th><th>Message</th></tr></thead>
                <tbody>{logs.map(l=> (
                  <tr key={l._id}>
                    <td>{new Date(l.createdAt).toLocaleString()}</td>
                    <td>{l.resource_type}</td>
                    <td>{l.usage_value}</td>
                    <td>{l.message}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
