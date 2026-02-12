import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'

export default function UsageForm(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ resource_type:'', usage_value:'', usage_date:'', notes:'' })
  const [error, setError] = useState(null)

  useEffect(()=>{ if (id) load() }, [id])

  async function load(){
    setLoading(true)
    try{
      const data = await api.get(`/api/usage/${id}`)
      setForm({
        resource_type: data.usage.resource_type,
        usage_value: data.usage.usage_value,
        usage_date: new Date(data.usage.usage_date).toISOString().slice(0,16),
        notes: data.usage.notes || ''
      })
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  async function submit(e){
    e.preventDefault()
    setLoading(true)
    setError(null)
    try{
      const payload = { ...form, usage_date: new Date(form.usage_date) }
      if (id) await api.put(`/api/usage/${id}`, payload)
      else await api.post('/api/usage', payload)
      navigate('/dashboard')
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  return (
    <div className="card">
      <h2>{id ? 'Edit' : 'Add'} Usage</h2>
      {loading ? <Loading /> : (
        <form onSubmit={submit}>
          <label>Resource Type<input value={form.resource_type} onChange={e=>setForm({...form,resource_type:e.target.value})} required /></label>
          <label>Usage Value<input type="number" value={form.usage_value} onChange={e=>setForm({...form,usage_value:e.target.value})} required /></label>
          <label>Date<input type="datetime-local" value={form.usage_date} onChange={e=>setForm({...form,usage_date:e.target.value})} required /></label>
          <label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></label>
          {error && <div className="error">{error}</div>}
          <button className="btn">Save</button>
        </form>
      )}
    </div>
  )
}
