import React, { useEffect, useState, useContext } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'
import { Link } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

export default function UsageList() {
  const [usages, setUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { user } = useContext(AuthContext)
  const isAdmin = user && user.role === 'admin'

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
    if (!window.confirm('Delete this record?')) return
    try {
      await api.del(`/api/usage/${id}`)
      setUsages(u => u.filter(x => x._id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>{isAdmin ? 'System Usage Records' : 'My Usage History'}</h2>
        <Link to="/usage/new" className="primary-btn">+ Add Usage</Link>
      </div>

      {loading ? <Loading /> : (
        error ? <div className="error">{error}</div> : (
          <div className="table-responsive">
            <table className="table usage-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {isAdmin && <th style={{ textAlign: 'left' }}>User</th>}
                  <th style={{ textAlign: 'left' }}>Resource</th>
                  <th style={{ textAlign: 'left' }}>Value</th>
                  <th style={{ textAlign: 'left' }}>Date</th>
                  <th style={{ textAlign: 'left' }}>Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usages.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: 20 }}>No records found</td></tr>
                ) : usages.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #eee' }}>
                    {isAdmin && (
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.userId?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>{u.userId?.email}</div>
                      </td>
                    )}
                    <td style={{ padding: '12px' }}>
                      <span className={`badge badge-${u.resource_type?.toLowerCase()}`}>{u.resource_type}</span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{u.usage_value}</td>
                    <td style={{ padding: '12px', color: '#666', fontSize: 13 }}>{new Date(u.usage_date).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', color: '#666', fontSize: 13 }}>{u.notes || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Link to={`/usage/${u._id}/edit`} className="btn-ghost" style={{ marginRight: 8 }}>Edit</Link>
                      <button onClick={() => remove(u._id)} className="btn-ghost" style={{ color: 'red' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
