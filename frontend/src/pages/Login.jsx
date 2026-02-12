import React, { useEffect, useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import LoadingSpinner from '../components/LoadingSpinner'
import { AuthContext } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const navigate = useNavigate()
  const { login, googleLogin } = useContext(AuthContext)

  // Page title
  React.useEffect(() => { document.title = 'Sign in — Sustainable Resource Monitor' }, [])

  useEffect(()=>{
    const id = 'google-identity-script'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.id = id
      s.async = true
      s.defer = true
      document.body.appendChild(s)
    }

    function onToken(e){ const id_token = e.detail; handleGoogle(id_token) }
    window.addEventListener('google-id-token', onToken)
    const initInterval = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(initInterval)
        window.google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, callback: (res)=>{ const id_token = res.credential; const evt = new CustomEvent('google-id-token', { detail: id_token }); window.dispatchEvent(evt) } })
        window.google.accounts.id.renderButton(document.querySelector('.g_id_signin'), { theme: 'filled_blue', size: 'large' })
      }
    }, 200)

    return ()=>{ window.removeEventListener('google-id-token', onToken); clearInterval(initInterval) }
  }, [])

  async function handleSubmit(e){
    e.preventDefault()
    setError(null)
    setLoading(true)
    try{
      await login(email, password)
      navigate('/dashboard')
    }catch(err){ setError(err.message); setLoading(false) }
  }

  async function handleGoogle(id_token){
    setError(null)
    setLoading(true)
    try{
      await googleLogin(id_token)
      navigate('/dashboard')
    }catch(err){ setError(err.message); setLoading(false) }
  }

  return (
    <div className="auth-page">
      <Card>
        <h2 className="auth-title">Sign in to Sustainable Resource Monitor</h2>
        <p className="auth-sub">Sign in to continue to your dashboard</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required />
          <Input label="Password" type={showPw? 'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required>
            <button type="button" className="pw-toggle" onClick={()=>setShowPw(s=>!s)}>{showPw? 'Hide':'Show'}</button>
          </Input>
          <div className="auth-row">
            <Link to="/forgot" className="forgot-link">Forgot Password?</Link>
          </div>
          {error && <div className="form-error center">{error}</div>}
          <Button loading={loading}>Sign in</Button>
        </form>

        <div className="divider"><span>Or continue with</span></div>
        <div className="g_id_signin" />
        <div className="auth-footer">
          <span>Don't have an account? <Link to="/register">Register</Link></span>
        </div>
      </Card>
    </div>
  )
}
