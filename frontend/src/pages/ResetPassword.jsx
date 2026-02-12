import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import api from '../services/api'

export default function ResetPassword(){
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e){
    e.preventDefault(); setError(null); setMsg(null); setLoading(true)
    if (password !== confirm) { setError('Passwords do not match'); setLoading(false); return }
    try{
      await api.post(`/api/auth/reset/${token}`, { password })
      setMsg('Password reset. Redirecting to login...')
      setTimeout(()=> navigate('/login'), 1400)
    }catch(err){ setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <Card>
        <h2 className="auth-title">Reset password</h2>
        <p className="auth-sub">Enter a new password for your account.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="New password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <Input label="Confirm password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          {error && <div className="form-error">{error}</div>}
          {msg && <div className="form-success">{msg}</div>}
          <Button loading={loading}>Set password</Button>
        </form>
      </Card>
    </div>
  )
}

