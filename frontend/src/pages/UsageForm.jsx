import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'
import { useToast } from '../context/ToastContext'

export default function UsageForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    resource_type: 'Electricity',
    category: 'Hostel Block A',
    usage_value: '',
    usage_date: new Date().toISOString().slice(0, 16),
    notes: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const data = await api.get(`/api/usage/${id}`)
      setForm({
        resource_type: data.usage.resource_type,
        category: data.usage.category || 'Hostel Block A',
        usage_value: data.usage.usage_value,
        usage_date: new Date(data.usage.usage_date).toISOString().slice(0, 16),
        notes: data.usage.notes || ''
      })
    } catch (err) {
      addToast(err.message || 'Failed to load record', 'error')
    } finally { setLoading(false) }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.usage_value || form.usage_value <= 0) newErrors.usage_value = 'Please enter a valid positive number.'
    if (!form.usage_date) newErrors.usage_date = 'Date is required.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const payload = { ...form, usage_date: new Date(form.usage_date) }
      if (id) await api.put(`/api/usage/${id}`, payload)
      else await api.post('/api/usage', payload)

      addToast(id ? 'Usage updated successfully' : 'Usage recorded successfully')
      navigate('/dashboard')
    } catch (err) {
      addToast(err.message || 'Failed to save record', 'error')
    } finally { setLoading(false) }
  }

  // Helper to get unit label
  const getUnit = () => {
    switch (form.resource_type) {
      case 'Electricity': return 'kWh'
      case 'Water': return 'Liters'
      case 'Diesel': return 'Liters'
      case 'LPG': return 'kg'
      case 'Food': return 'kg'
      case 'Waste': return 'kg'
      default: return 'units'
    }
  }

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h2>{id ? 'Edit' : 'Add'} Resource Usage</h2>
      {loading ? <Loading /> : (
        <form onSubmit={submit} className="auth-form">
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
            <label className="form-label-text">Category / Location</label>
            <select
              className="input"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              <option value="Hostel Block A">Hostel Block A</option>
              <option value="Hostel Block B">Hostel Block B</option>
              <option value="Hostel Block C">Hostel Block C</option>
              <option value="Mess Hall">Mess Hall</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Generator Room">Generator Room</option>
              <option value="Common Area">Common Area</option>
            </select>
          </div>

          <div className="input-wrap">
            <label className="form-label-text">Amount <span className="text-muted" style={{ fontSize: 11 }}>({getUnit()})</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                className={`input ${errors.usage_value ? 'input-error' : ''}`}
                value={form.usage_value}
                onChange={e => setForm({ ...form, usage_value: e.target.value })}
                placeholder={`e.g., 120`}
                min="0"
                step="0.01"
              />
              <span style={{ position: 'absolute', right: 12, top: 12, color: 'var(--muted)', fontSize: 12, pointerEvents: 'none' }}>{getUnit()}</span>
            </div>
            {errors.usage_value && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.usage_value}</div>}
          </div>

          <div className="input-wrap">
            <label className="form-label-text">Date & Time</label>
            <input
              type="datetime-local"
              className={`input ${errors.usage_date ? 'input-error' : ''}`}
              value={form.usage_date}
              onChange={e => setForm({ ...form, usage_date: e.target.value })}
            />
            {errors.usage_date && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.usage_date}</div>}
          </div>

          <div className="input-wrap">
            <label className="form-label-text">Notes (Optional)</label>
            <textarea
              className="input"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Any specific observations? e.g. 'Leaky faucet repair'"
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => navigate('/dashboard')}>Cancel</button>
            <button type="submit" className="primary-btn" style={{ flex: 2 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

