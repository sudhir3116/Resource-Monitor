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

  useEffect(() => {
    // Check if URL has error (from redirect)
    const params = new URLSearchParams(window.location.search)
    const errorMsg = params.get('error')

    if (errorMsg) {
      setError('Google Auth Failed. Please try again.')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      // Navigation is handled by AuthContext or we can do it here if AuthContext returns promise
    } catch (err) {
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Card>
        <h2 className="auth-title">Sign in to Sustainable Resource Monitor</h2>
        <p className="auth-sub">Sign in to continue to your dashboard</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
          <Input label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required>
            <button type="button" className="pw-toggle" onClick={() => setShowPw(s => !s)}>{showPw ? 'Hide' : 'Show'}</button>
          </Input>
          <div className="auth-row">
            <Link to="/forgot" className="forgot-link">Forgot Password?</Link>
          </div>
          {error && <div className="form-error center">{error}</div>}
          <Button loading={loading}>Sign in</Button>
        </form>

        <div className="divider"><span>Or continue with</span></div>
        <div className="center">
          <button
            type="button"
            className="btn btn-google"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              backgroundColor: '#ffffff',
              color: '#3c4043',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s, box-shadow 0.2s',
              boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/google`}
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" width="18" height="18" />
            Sign in with Google
          </button>
        </div>
        <div className="auth-footer">
          <span>Don't have an account? <Link to="/register">Register</Link></span>
        </div>
      </Card>
    </div>
  )
}
