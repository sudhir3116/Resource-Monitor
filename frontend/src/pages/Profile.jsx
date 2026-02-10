import React, { useEffect, useState } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'

export default function Profile(){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pw, setPw] = useState({ currentPassword:'', newPassword:'' })
  const [msg, setMsg] = useState(null)

  useEffect(()=>{ load() }, [])
  async function load(){ setLoading(true); try{ const d = await api.get('/api/profile'); setUser(d.user) }catch(e){ setError(e.message) } finally{ setLoading(false) } }

  async function changePw(e){ e.preventDefault(); setMsg(null); try{ await api.put('/api/profile/password', pw); setMsg('Password changed'); setPw({currentPassword:'',newPassword:''}) }catch(err){ setMsg(err.message) } }

  return (
    <div>
      <h2>Profile</h2>
      {loading ? <Loading /> : error ? <div className="error">{error}</div> : (
        <div className="card">
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
        </div>
      )}

      <div className="card">
        <h3>Change Password</h3>
        <form onSubmit={changePw}>
          <label>Current Password<input type="password" value={pw.currentPassword} onChange={e=>setPw({...pw,currentPassword:e.target.value})} required /></label>
          <label>New Password<input type="password" value={pw.newPassword} onChange={e=>setPw({...pw,newPassword:e.target.value})} required /></label>
          {msg && <div className="success">{msg}</div>}
          <button className="btn">Change Password</button>
        </form>
      </div>
    </div>
  )
}
