import React, { useState, useEffect, useCallback, useContext } from 'react'
import { AuthContext } from './AuthContextCore';
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../api/axios'
import Loading from '../components/Loading'
import { logger } from '../utils/logger'
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket'
import { getDashboardRoute } from '../utils/roleRoutes'


const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const [user, setUser] = useState(null)
  const [token, setToken] = useState(sessionStorage.getItem('token') || null)
  const [loading, setLoading] = useState(true)

  // Expose role purely derived from user state
  const role = user?.role || null

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = sessionStorage.getItem('token')

      if (!storedToken) {
        setUser(null)
        setToken(null)
        setLoading(false)
        return
      }

      try {
        // Verify token is still valid with backend
        const res = await api.get('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        })

        const rawUserData = res.data.user || res.data.data || res.data
        const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
        setUser(userData)
        setToken(storedToken)

        // Update stored user data
        sessionStorage.setItem('user', JSON.stringify(userData))

        // Connect socket
        connectSocket(storedToken)

      } catch (err) {
        // Token invalid or expired — clear everything
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('user')
        setUser(null)
        setToken(null)
        disconnectSocket()
      } finally {
        // ALWAYS set loading false — no exceptions
        setLoading(false)
      }
    }

    verifyToken()

    // Absolute safety timeout — 8 seconds max loading
    const safetyTimer = setTimeout(() => {
      setLoading(false)
    }, 8000)

    return () => clearTimeout(safetyTimer)
  }, [])

  const checkAuth = async () => {
    // Left for compatibility with parts of the app that call checkAuth explicitly
    const storedToken = sessionStorage.getItem('token')
    if (!storedToken) {
      setUser(null)
      setToken(null)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` }
      })
      const rawUserData = res.data.user || res.data.data || res.data
      const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
      setUser(userData)
      setToken(storedToken)
      sessionStorage.setItem('user', JSON.stringify(userData))
    } catch (err) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      setUser(null)
      setToken(null)
      disconnectSocket()
    } finally {
      setLoading(false)
    }
  }

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (e) {
      logger.error('Logout error', e)
    } finally {
      setUser(null)
      setToken(null)
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      sessionStorage.clear()
      disconnectSocket()
      navigate('/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    const handleAuthError = () => logout()
    const handleStorageChange = (event) => {
      if (event.key === 'token') {
        logout()
        window.location.href = '/login'
      }
    }

    window.addEventListener('auth:unauthorized', handleAuthError)
    window.addEventListener('storage', handleStorageChange)

    // Socket listener for real-time suspension/deletion logout
    const s = getSocket()
    const handleSuspended = (data) => {
      const myId = user?._id || user?.id
      if (!myId) return

      const isAffected = (data.userId && data.userId === myId) ||
        (data.userIds && data.userIds.some(id => id.toString() === myId.toString()))

      if (isAffected) {
        logout()
        // Force redirect to login with query param to explain why
        window.location.replace('/login?error=account_deactivated')
      }
    }
    s.on('user:suspended', handleSuspended)

    let inactivityTimer
    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (user) {
        inactivityTimer = setTimeout(() => {
          logout()
        }, 30 * 60 * 1000)
      }
    }

    const events = ['load', 'mousemove', 'mousedown', 'click', 'scroll', 'keypress']
    if (user) {
      events.forEach(event => window.addEventListener(event, resetTimer))
      resetTimer()
    }

    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthError)
      window.removeEventListener('storage', handleStorageChange)
      s.off('user:suspended', handleSuspended) // Clean up socket listener
      if (inactivityTimer) clearTimeout(inactivityTimer)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [user, logout])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      const rawUserData = response.data.data || response.data.user
      const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
      const authToken = response.data.token

      if (authToken) {
        sessionStorage.setItem('token', authToken)
        sessionStorage.setItem('user', JSON.stringify(userData))
      }

      setUser(userData)
      setToken(authToken)
      if (authToken) connectSocket(authToken)

      // Use role-based dashboard route
      const dashboardRoute = getDashboardRoute(userData?.role)
      const from = location.state?.from || location.state?.from?.pathname || dashboardRoute
      navigate(from, { replace: true })
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      if (error.code === "ECONNABORTED") {
        alert("Server is waking up, please wait 20 seconds and try again");
      }
      let errorMessage = 'Login failed. Please try again.'

      if (error.message) errorMessage = error.message
      if (error.response?.data?.message) errorMessage = error.response.data.message
      else if (error.response?.status === 401) errorMessage = 'Invalid email or password.'
      else if (error.response?.status === 429) errorMessage = 'Too many login attempts. Please try again in 15 minutes.'

      const enhancedError = new Error(errorMessage)
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  const googleLogin = async (credential) => {
    try {
      const response = await api.post('/api/auth/google', { credential })
      const rawUserData = response.data.data || response.data.user
      const userData = rawUserData ? { ...rawUserData, role: (rawUserData.role || '').toLowerCase() } : null
      const authToken = response.data.token

      if (response.data.success && userData) {
        if (authToken) {
          sessionStorage.setItem('token', authToken)
          sessionStorage.setItem('user', JSON.stringify(userData))
        }
        setUser(userData)
        setToken(authToken)
        if (authToken) connectSocket(authToken)

        // Use role-based dashboard route
        const dashboardRoute = getDashboardRoute(userData?.role)
        const from = location.state?.from || location.state?.from?.pathname || dashboardRoute
        navigate(from, { replace: true })
        return { success: true }
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error) {
      let errorMessage = 'Google login failed. Please try again.'

      if (error.message && !error.message.includes('Invalid response')) errorMessage = error.message
      if (error.response?.data?.error) errorMessage = error.response.data.error
      if (error.response?.data?.message) errorMessage = error.response.data.message

      const enhancedError = new Error(errorMessage)
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  const register = async (name, email, password, roleInput) => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password, role: roleInput })
      const rawUserData = response.data.data || response.data.user
      const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
      const authToken = response.data.token

      if (authToken) {
        sessionStorage.setItem('token', authToken)
        sessionStorage.setItem('user', JSON.stringify(userData))
      }

      setUser(userData)
      setToken(authToken)
      if (authToken) connectSocket(authToken)

      // Use role-based dashboard route
      const dashboardRoute = getDashboardRoute(userData?.role)
      navigate(dashboardRoute, { replace: true })
      return { success: true }
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.'

      if (error.message) errorMessage = error.message
      if (error.response?.data?.message) errorMessage = error.response.data.message
      else if (error.response?.status === 400) errorMessage = 'Invalid registration data. Please check your inputs.'
      else if (error.response?.status === 409) errorMessage = 'An account with this email already exists.'

      const enhancedError = new Error(errorMessage)
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  const setUserData = (userData) => {
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      googleLogin,
      register,
      logout,
      checkAuth,
      setUser: setUserData,
      role,
      isAuthenticated: !!user && !!token
    }}>
      {children}
    </AuthContext.Provider>
  )
}


export default AuthProvider
