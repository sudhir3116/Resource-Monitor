import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'

export default function AlertForm(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ resource_type:'', threshold_value:'', comparison:'gt', active:true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(()=>{ if (id) load() }, [id])
  async function load(){ setLoading(true); try{ const d = await api.get(`/api/alerts`); const rule = d.rules.find(r=>r._id===id); if(rule) setForm(rule) }catch(e){ setError(e.message) } finally{ setLoading(false) } }

  async function submit(e){ e.preventDefault(); setLoading(true); try{ if(id) await api.put(`/api/alerts/${id}`, form); else await api.post('/api/alerts', form); navigate('/alerts') }catch(err){ setError(err.message) } finally{ setLoading(false) } }

  return (
    <div className="card">
      <h2>{id ? 'Edit' : 'New'} Alert Rule</h2>
      {loading ? <Loading /> : (
        <form onSubmit={submit}>
          <label>Resource<input value={form.resource_type} onChange={e=>setForm({...form,resource_type:e.target.value})} required /></label>
          <label>Threshold<input type="number" value={form.threshold_value} onChange={e=>setForm({...form,threshold_value:e.target.value})} required /></label>
          <label>Comparison<select value={form.comparison} onChange={e=>setForm({...form,comparison:e.target.value})}><option value="gt">Greater Than</option><option value="lt">Less Than</option></select></label>
          <label><input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})} /> Active</label>
          {error && <div className="error">{error}</div>}
          <button className="btn">Save</button>
        </form>
      )}
    </div>
  )
}
