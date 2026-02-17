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
      const response = await api.get('/api/auth/me');

      if (response.status === 200) {
        // Support both response formats during migration
        const userData = response.data.data || response.data.user;
        if (userData) {
          setUser(userData);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    }
    setUser(null);
    setLoading(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    checkAuth();

    const handleAuthError = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleAuthError);
    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password })
      const userData = response.data.data || response.data.user;
      setUser(userData)

      // Navigate based on role
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true })
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)

      // Enhanced error handling with specific messages
      let errorMessage = 'Login failed. Please try again.';

      if (error.message) {
        // Use the friendly error from api.js interceptor
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid email or password.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Too many login attempts. Please try again in 15 minutes.';
      }

      // Create enhanced error
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  const googleLogin = async (credential) => {
    try {
      console.log('🔐 Sending Google credential to backend...');

      const response = await api.post('/api/auth/google', { credential });
      const userData = response.data.data || response.data.user;

      if (response.data.success && userData) {
        console.log('✅ Google login successful');
        setUser(userData);

        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
        return { success: true };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('❌ Google login error:', error);

      // Enhanced error handling
      let errorMessage = 'Google login failed. Please try again.';

      if (error.message && !error.message.includes('Invalid response')) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  const register = async (name, email, password, role) => {
    try {
      const response = await api.post('/api/auth/register', { name, email, password, role })
      const userData = response.data.data || response.data.user;
      setUser(userData)
      navigate('/dashboard', { replace: true })
      return { success: true }
    } catch (error) {
      console.error('Register error:', error)

      // Enhanced error handling
      let errorMessage = 'Registration failed. Please try again.';

      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid registration data. Please check your inputs.';
      } else if (error.response?.status === 409) {
        errorMessage = 'An account with this email already exists.';
      }

      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      throw enhancedError;
    }
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
