import React, { createContext, useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  // Verify authentication status on mount
  const checkAuth = useCallback(async () => {
    try {
      // Axios interceptor handles 401 -> refresh -> retry automatically
      const response = await api.get('/api/auth/me');

      if (response.status === 200 && response.data.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      // If error persists after interceptor's retry attempts -> explicit logout
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      // Crucial: Set loading to false regardless of outcome so app doesn't hang
      setLoading(false);
    }
  }, []); // Stable dependency

  useEffect(() => {
    // Run auth check once on mount
    checkAuth();

    // Listen for global unauthorized events (from api.js interceptor)
    const handleAuthError = () => {
      // We use the logout function but ensure it doesn't cause loops
      // The logout function handles API call and state clearing
      logout();
    };

    window.addEventListener('auth:unauthorized', handleAuthError);
    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthError);
    };
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      setUser(response.data.user)

      // Navigate based on role or remembered location
      const from = location.state?.from?.pathname || (response.data.user.role === 'admin' ? '/admin' : '/dashboard')
      navigate(from, { replace: true })
      return { success: true }
    } catch (e) {
      console.error('Login error:', e)
      throw e
    }
  }

  const googleLogin = async () => {
    setLoading(true);
    await checkAuth();
    const from = location.state?.from?.pathname || '/dashboard'
    navigate(from, { replace: true });
  }

  const register = async (name, email, password, role) => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password, role })
      setUser(response.data.user)
      navigate('/dashboard', { replace: true })
      return { success: true }
    } catch (e) {
      console.error('Register error:', e)
      throw e
    }
  }

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    }
    // Clear state and redirect
    setUser(null);
    setLoading(false);
    navigate('/login', { replace: true })
  }

  const value = {
    user,
    loading,
    login,
    googleLogin,
    register,
    logout,
    checkAuth
  }

  if (loading) {
    return <Loading />
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
