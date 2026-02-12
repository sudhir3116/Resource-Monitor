import React, { useState } from 'react'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import api from '../services/api'

export default function ForgotPassword(){
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e){
    e.preventDefault(); setError(null); setMsg(null); setLoading(true)
    try{
      const data = await api.post('/api/auth/forgot', { email })
      setMsg('If that email exists, a reset link was generated. (Dev token returned)')
      // for dev: show token
      if (data.token) setMsg(m=> m + ` Token: ${data.token}`)
    }catch(err){ setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <Card>
        <h2 className="auth-title">Forgot password</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          {error && <div className="form-error">{error}</div>}
          {msg && <div className="form-success">{msg}</div>}
          <Button loading={loading}>Send reset link</Button>
        </form>
      </Card>
    </div>
  )
}
