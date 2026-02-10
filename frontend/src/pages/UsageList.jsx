import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'
import { Link } from 'react-router-dom'

export default function UsageList() {
  const [usages, setUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/usage')
      setUsages(data.usages || [])
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  async function remove(id) {
    if (!confirm('Delete this record?')) return
    try {
      await api.del(`/api/usage/${id}`)
      setUsages(u => u.filter(x => x._id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Usage Records</h2>
        <Link to="/usage/new" className="btn">Add Usage</Link>
      </div>
      {loading ? <Loading /> : (
        error ? <div className="error">{error}</div> : (
          <table className="usage-table">
            <thead><tr><th>Resource</th><th>Value</th><th>Date</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {usages.map(u => (
                <tr key={u._id}>
                  <td>{u.resource_type}</td>
                  <td>{u.usage_value}</td>
                  <td>{new Date(u.usage_date).toLocaleString()}</td>
                  <td>{u.notes}</td>
                  <td>
                    <Link to={`/usage/${u._id}/edit`} className="btn-ghost">Edit</Link>
                    <button onClick={() => remove(u._id)} className="btn-ghost">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}
