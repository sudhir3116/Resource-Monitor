import React, { useEffect, useState, useContext } from 'react'
import api from '../services/api'
import { Link, useNavigate } from 'react-router-dom'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'
import { AuthContext } from '../context/AuthContext'

export default function AlertsList() {
  const [rules, setRules] = useState([])
  const [systemAlerts, setSystemAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('system') // 'system' | 'rules'

  const { addToast } = useToast()
  const { user } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // 1. Fetch Rules (Configured by Admins)
      const resRules = await api.get('/api/alerts')
      setRules((resRules && resRules.rules) || [])

      // 2. Fetch System Alerts (Real Data)
      const resAlerts = await api.get('/api/alerts/system')
      setSystemAlerts((resAlerts && resAlerts.alerts) || [])

    } catch (err) {
      addToast('Failed to load alerts', 'error')
    } finally { setLoading(false) }
  }

  async function deleteRule(id) {
    if (!confirm('Are you sure you want to delete this alert rule?')) return
    try {
      await api.del(`/api/alerts/${id}`)
      setRules(prev => prev.filter(r => r._id !== id))
      addToast('Rule deleted successfully')
    } catch (e) {
      addToast(e.message || 'Failed to delete rule', 'error')
    }
  }

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1>Alerts & Configurations</h1>
          <p className="subtitle">Monitor system anomalies and configure updated thresholds</p>
        </div>
        <div>
          {/* Only Admins can create new rules */}
          {user && user.role === 'admin' && (
            <button onClick={() => navigate('/alerts/new')} className="primary-btn">+ New Rule</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: 20, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <button
          className={`btn-ghost ${activeTab === 'system' ? 'active' : ''}`}
          style={{
            padding: '10px 4px',
            borderBottom: activeTab === 'system' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'system' ? 'var(--primary)' : 'var(--muted)',
            fontWeight: activeTab === 'system' ? 700 : 500,
            borderRadius: 0
          }}
          onClick={() => setActiveTab('system')}>
          System Notifications
        </button>
        <button
          className={`btn-ghost ${activeTab === 'rules' ? 'active' : ''}`}
          style={{
            padding: '10px 4px',
            borderBottom: activeTab === 'rules' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'rules' ? 'var(--primary)' : 'var(--muted)',
            fontWeight: activeTab === 'rules' ? 700 : 500,
            borderRadius: 0
          }}
          onClick={() => setActiveTab('rules')}>
          My Alert Rules
        </button>
      </div>

      {loading ? <Loading /> : (
        <>
          {/* System Notifications Tab */}
          {activeTab === 'system' && (
            <div className="card">
              <h3>Recent System Alerts</h3>
              {systemAlerts.length === 0 ? <EmptyState icon="✅" title="No Recent Alerts" description="Your system is running smoothly." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {systemAlerts.map(alert => (
                    <div key={alert._id} className={`alert-item ${alert.status === 'danger' ? 'danger' : 'warning'}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {alert.resourceType === 'Electricity' ? '⚡' : alert.resourceType === 'Water' ? '💧' : '📢'}
                          {alert.resourceType || 'System'} Alert
                        </strong>
                        <span className="alert-date" style={{ fontSize: 12, opacity: 0.7 }}>{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>

                      {/* Admin View: Show User Triggering Alert */}
                      {user && user.role === 'admin' && alert.user && (
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4, paddingBottom: 4, borderBottom: '1px dashed rgba(0,0,0,0.1)' }}>
                          User: <b>{alert.user.name}</b> ({alert.user.email})
                        </div>
                      )}

                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                        {alert.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Rules Tab */}
          {activeTab === 'rules' && (
            <div className="card">
              <h3>Configuration Rules</h3>
              <div className="table-wrap">
                {rules.length === 0 ? <EmptyState icon="⚙️" title="No Rules Configured" description="Create a rule to get notified about usage anomalies." action={
                  user && user.role === 'admin' ? <button onClick={() => navigate('/alerts/new')} className="btn small primary">Create Rule</button> : null
                } /> : (
                  <table className="usage-table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Condition</th>
                        <th>Threshold</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map(r => (
                        <tr key={r._id}>
                          <td style={{ fontWeight: 600 }}>{r.resource_type}</td>
                          <td>{r.comparison === 'gt' ? 'Above (>)' : r.comparison === 'lt' ? 'Below (<)' : 'Equals (=)'}</td>
                          <td style={{ fontWeight: 600 }}>{r.threshold_value}</td>
                          <td>
                            <span className={`badge ${r.active ? 'badge-success' : 'badge-warning'}`}>
                              {r.active ? 'Active' : 'Paused'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {user && user.role === 'admin' && (
                              <>
                                <button onClick={() => navigate(`/alerts/${r._id}/edit`)} className="btn small secondary" style={{ marginRight: 8 }}>Edit</button>
                                <button onClick={() => deleteRule(r._id)} className="btn small" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Delete</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

