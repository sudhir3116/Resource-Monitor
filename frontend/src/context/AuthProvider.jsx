import React, { useState, useEffect, useCallback, useContext } from 'react'
import { AuthContext } from './AuthContextCore';
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../api'
import Loading from '../components/Loading'
import { logger } from '../utils/logger'
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket'
import { getDashboardRoute } from '../utils/roleRoutes'


const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  const [loading, setLoading] = useState(true)

  // Use a ref for socket to avoid repeated connections during state changes
  const socketConnected = React.useRef(false);

  // Expose role purely derived from user state
  const role = user?.role || null

  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('token')

      if (!storedToken) {
        setUser(null)
        setToken(null)
        setLoading(false)
        return
      }

      try {
        // Verify token is still valid with backend
        const res = await api.get('/api/auth/me')

        const rawUserData = res.data.user || res.data.data || res.data
        const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
        setUser(userData)
        setToken(storedToken)

        // Sync stored user data
        localStorage.setItem('user', JSON.stringify(userData))

        // Connect socket once
        if (!socketConnected.current) {
          connectSocket(storedToken)
          socketConnected.current = true;
        }

      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || '';

        // Token-invalid messages — matches the same list in api.js interceptor
        const TOKEN_INVALID_MESSAGES = [
          'Token invalid',
          'No token provided',
          'Token invalid (user logged out)',
          'Token has been invalidated',
          'Invalid authentication session',
          'jwt expired',
          'invalid signature',
          'invalid token',
        ];
        const isTokenDead = status === 401 &&
          TOKEN_INVALID_MESSAGES.some(m => msg.toLowerCase().includes(m.toLowerCase()));

        if (isTokenDead) {
          // Token is genuinely dead — clear session
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
          setToken(null)
          disconnectSocket()
          socketConnected.current = false;
        } else if (!err.response) {
          // Network error / Render cold start — keep user logged in from cache
          const cachedUser = localStorage.getItem('user');
          if (cachedUser) {
            try {
              const parsed = JSON.parse(cachedUser);
              setUser(parsed)
              setToken(storedToken)
              console.warn('[Auth] Backend unreachable — session restored from cache.');
            } catch (_) {
              localStorage.removeItem('user')
            }
          }
        }
        // Other errors (403, 5xx) — keep user logged in, API calls will surface errors
      } finally {
        setLoading(false)
      }
    }

    verifyToken()

    // Safety timeout — 10s to account for Render cold start delay
    const safetyTimer = setTimeout(() => {
      setLoading(false)
    }, 10000)

    return () => clearTimeout(safetyTimer)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } catch (e) {
      logger.error('Logout error', e)
    } finally {
      setUser(null)
      setToken(null)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      disconnectSocket()
      socketConnected.current = false;
      navigate('/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    const handleAuthError = () => logout()
    
    window.addEventListener('auth:unauthorized', handleAuthError)

    // Socket listener for real-time suspension/deletion logout
    const s = getSocket()
    const handleSuspended = (data) => {
      const myId = user?._id || user?.id
      if (!myId) return

      const isAffected = (data.userId && data.userId === myId) ||
        (data.userIds && data.userIds.some(id => id.toString() === myId.toString()))

      if (isAffected) {
        logout()
        window.location.replace('/login?error=account_deactivated')
      }
    }
    s.on('user:suspended', handleSuspended)

    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthError)
      s.off('user:suspended', handleSuspended)
    }
  }, [user, logout])

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      const rawUserData = response.data.data || response.data.user
      const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
      const authToken = response.data.token

      if (authToken) {
        localStorage.setItem('token', authToken)
        localStorage.setItem('user', JSON.stringify(userData))
      }

      setUser(userData)
      setToken(authToken)
      if (authToken && !socketConnected.current) {
        connectSocket(authToken)
        socketConnected.current = true;
      }

      // Use role-based dashboard route
      const dashboardRoute = getDashboardRoute(userData?.role)
      const from = location.state?.from || location.state?.from?.pathname || dashboardRoute
      navigate(from, { replace: true })
      return { success: true }
    } catch (error) {
      let errorMessage = 'Login failed. Please try again.'

      if (error.response?.data?.message) errorMessage = error.response.data.message
      else if (error.response?.status === 401) errorMessage = 'Invalid email or password.'
      else if (error.response?.status === 429) errorMessage = 'Too many login attempts. Please try again.'

      const enhancedError = new Error(errorMessage)
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  const register = async (name, email, password) => {
    try {
      // NOTE: blockId is no longer passed as per recent requirement where admins assign blocks later
      const response = await api.post('/api/auth/register', { name, email, password })
      const authToken = response.data.token

      if (authToken) {
        const rawUserData = response.data.data || response.data.user
        const userData = { ...rawUserData, role: (rawUserData?.role || '').toLowerCase() }
        
        localStorage.setItem('token', authToken)
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
        setToken(authToken)
        connectSocket(authToken)
        socketConnected.current = true;

        const dashboardRoute = getDashboardRoute(userData?.role)
        navigate(dashboardRoute, { replace: true })
        return { success: true, immediate: true }
      } else {
        // Approval Workflow: registered but must wait
        setUser(null)
        setToken(null)
        
        setTimeout(() => {
          navigate('/login', { replace: true })
        }, 3000)
        
        return { success: true, pending: true, message: response.data.message }
      }
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.'
      if (error.response?.data?.message) errorMessage = error.response.data.message
      const enhancedError = new Error(errorMessage)
      throw enhancedError
    }
  }

  const setUserData = (userData) => {
    const normalizedData = { ...userData, role: (userData?.role || '').toLowerCase() };
    setUser(normalizedData);
    localStorage.setItem('user', JSON.stringify(normalizedData));
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      setUser: setUserData,
      role,
      isAuthenticated: !!user && !!token
    }}>
      {children}
    </AuthContext.Provider>
  )
}


export default AuthProvider
