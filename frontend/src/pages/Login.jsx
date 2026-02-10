import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Load Google Identity Services script
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
    // When script loads, initialize the Google button
    const initInterval = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(initInterval)
        window.google.accounts.id.initialize({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, callback: (res)=>{ const id_token = res.credential; const evt = new CustomEvent('google-id-token', { detail: id_token }); window.dispatchEvent(evt) } })
        window.google.accounts.id.renderButton(document.querySelector('.g_id_signin'), { theme: 'outline', size: 'large' })
      }
    }, 200)

    return () => {
      window.removeEventListener('google-id-token', onToken)
      clearInterval(initInterval)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Login failed')
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGoogle(id_token) {
    setError(null)
    try {
      const res = await fetch('http://localhost:4000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Google login failed')
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn">Login</button>
      </form>

      <div style={{marginTop:16}}>
        <div id="g_id_onload" data-client_id={import.meta.env.VITE_GOOGLE_CLIENT_ID} data-callback="handleGoogleCallback"></div>
        <div className="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline" data-text="signin_with" data-size="large" data-logo_alignment="left"></div>
      </div>

      <script>{`function handleGoogleCallback(response){ window.__handleGoogle && window.__handleGoogle(response) }`}</script>
      <script>{`window.__handleGoogle = function(resp){ const id_token = resp.credential; window.handleGoogleClient && window.handleGoogleClient(id_token); }`}</script>
      <script>{`(function poll(){ if(window.handleGoogleClient) return; window.handleGoogleClient = (id)=>{ const evt = new CustomEvent('google-id-token', {detail: id}); window.dispatchEvent(evt) }; window.setTimeout(poll,200) })()`}</script>

    </div>
  )
}
