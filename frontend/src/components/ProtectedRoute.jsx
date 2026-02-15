import React, { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import Loading from './Loading'

export default function ProtectedRoute({ children, role, roles }) {
  const { user, loading } = useContext(AuthContext)
  const location = useLocation()

  if (loading) {
    return <Loading />
  }

  if (!user) {
    // Redirect to login while saving the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (role) {
    if (user.role !== role) {
      return (
        <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Access Denied</h2>
          <p>Please contact an administrator if you believe this is an error.</p>
          <a href="/dashboard" className="btn btn-primary" style={{ marginTop: 20 }}>Go to Dashboard</a>
        </div>
      )
    }
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
        <a href="/dashboard" className="btn btn-primary" style={{ marginTop: 20 }}>Go to Dashboard</a>
      </div>
    )
  }

  return children
}
