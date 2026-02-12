import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'

import { useToast } from '../context/ToastContext'

export default function AlertForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [form, setForm] = useState({ resource_type: 'Electricity', threshold_value: '', comparison: 'gt', active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (id) load() }, [id])
  async function load() {
    setLoading(true);
    try {
      const d = await api.get(`/api/alerts`);
      const rule = d.rules.find(r => r._id === id);
      if (rule) setForm(rule)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (id) await api.put(`/api/alerts/${id}`, form);
      else await api.post('/api/alerts', form);
      addToast(`Rule ${id ? 'updated' : 'created'} successfully`)
      navigate('/alerts')
    } catch (err) {
      setError(err.message)
      addToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '40px auto' }}>
      <div className="card-header">
        <h2>{id ? 'Edit' : 'New'} Alert Rule</h2>
        <p className="subtitle">Configure automated alerts for resource anomalies.</p>
      </div>

      {loading ? <Loading /> : (
        <form onSubmit={submit}>
          <div className="form-grid">
            {/* Checkbox for Active Status (Toggle) */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={!!form.active}
                  onChange={e => setForm({ ...form, active: e.target.checked })}
                />
                <span className="slider"></span>
              </label>
              <span style={{ fontWeight: 500 }}>{form.active ? 'Rule is Active' : 'Rule is Paused'}</span>
            </div>

            <div className="input-wrap">
              <label className="form-label-text">Resource Type</label>
              <select
                className="input"
                value={form.resource_type}
                onChange={e => setForm({ ...form, resource_type: e.target.value })}
              >
                <option value="Electricity">⚡ Electricity</option>
                <option value="Water">💧 Water</option>
                <option value="Food">🍽 Food</option>
                <option value="LPG">🔥 LPG</option>
                <option value="Diesel">🛢 Diesel</option>
                <option value="Waste">♻ Waste</option>
              </select>
            </div>

            <div className="input-wrap">
              <label className="form-label-text">Comparison Logic</label>
              <select
                className="input"
                value={form.comparison}
                onChange={e => setForm({ ...form, comparison: e.target.value })}
              >
                <option value="gt">Greater Than (&gt;)</option>
                <option value="lt">Less Than (&lt;)</option>
                <option value="eq">Equal To (=)</option>
              </select>
            </div>

            <div className="input-wrap">
              <label className="form-label-text">Threshold Value</label>
              <input
                type="number"
                className="input"
                value={form.threshold_value}
                onChange={e => setForm({ ...form, threshold_value: e.target.value })}
                placeholder="e.g. 500"
                required
              />
            </div>
          </div>

          {error && <div className="form-error" style={{ marginTop: 20 }}>{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => navigate('/alerts')}>Cancel</button>
            <button type="submit" className="btn primary">Save Rule</button>
          </div>
        </form>
      )}
    </div>
  )
}
