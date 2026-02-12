import React, { useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import { AuthContext } from '../context/AuthContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { register } = useContext(AuthContext)
  const navigate = useNavigate()

  React.useEffect(() => { document.title = 'Register — Sustainable Resource Monitor' }, [])

  function passwordStrength(p){
    if (p.length < 8) return 'Weak'
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return 'Good'
    return 'Medium'
  }

  async function handleSubmit(e){
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    setLoading(true)
    try{
      await register(name, email, password)
      navigate('/dashboard')
    }catch(err){ setError(err.message); setLoading(false) }
  }

  return (
    <div className="auth-page">
      <Card>
        <h2 className="auth-title">Create an account</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="Full name" value={name} onChange={e=>setName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <div className="pw-strength">Password strength: {password ? passwordStrength(password) : '—'}</div>
          <Input label="Confirm Password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />

          {error && <div className="form-error center">{error}</div>}
          <Button loading={loading}>Create Account</Button>
        </form>
        <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
      </Card>
    </div>
  )
}
