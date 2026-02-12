import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import Loading from './Loading'

export default function ProtectedRoute({ children }) {
  // defensive: if AuthContext is not available, treat as unauthenticated
  const ctx = useContext(AuthContext) || {}
  const { user = null, loading = false } = ctx

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return children
}
