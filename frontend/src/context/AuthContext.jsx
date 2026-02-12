import React, { createContext, useEffect, useState } from 'react'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const data = await api.get('/api/profile')
          setUser(data.user)
        } catch (e) {
          localStorage.removeItem('token')
          setUser(null)
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password })
    if (data.token) {
      localStorage.setItem('token', data.token)
      const profile = await api.get('/api/profile')
      setUser(profile.user)
    }
  }

  const googleLogin = async (id_token) => {
    const data = await api.post('/api/auth/google', { id_token })
    if (data.token) {
      localStorage.setItem('token', data.token)
      const profile = await api.get('/api/profile')
      setUser(profile.user)
    }
  }

  const register = async (name, email, password) => {
    const data = await api.post('/api/auth/register', { name, email, password })
    if (data.token) {
      localStorage.setItem('token', data.token)
      const profile = await api.get('/api/profile')
      setUser(profile.user)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
