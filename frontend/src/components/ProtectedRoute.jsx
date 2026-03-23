import React, { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

const ROLE_DASHBOARDS = {
  admin: '/admin/dashboard',
  gm: '/gm/dashboard',
  warden: '/warden/dashboard',
  student: '/student/dashboard',
  dean: '/dean/dashboard',
  principal: '/principal/dashboard'
}

const ProtectedRoute = ({
  children,
  allowedRoles = []
}) => {
  const { user, loading } = useContext(AuthContext)
  const location = useLocation()

  // CRITICAL: Never redirect during loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // Not logged in — go to login
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  // Role check — case insensitive
  const userRole = (user.role || '').toLowerCase()
  const allowed = allowedRoles.map(r => r.toLowerCase())

  if (allowed.length > 0 && !allowed.includes(userRole)) {
    const redirectTo =
      ROLE_DASHBOARDS[userRole] || '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  return children
}

export default ProtectedRoute
