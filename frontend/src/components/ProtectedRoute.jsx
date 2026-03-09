import React, { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { hasRouteAccess, getDashboardRoute } from '../utils/roleRoutes'

const ProtectedRoute = ({
  children,
  allowedRoles = []
}) => {
  const { user, loading } = useContext(AuthContext)
  const location = useLocation()

  // STEP 1: Wait — never redirect while loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#030712',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #1F2937',
          borderTop: '3px solid #3B82F6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{
          color: '#6B7280',
          fontSize: '13px',
          fontFamily: 'system-ui'
        }}>
          Verifying session...
        </p>
        <style>{`@keyframes spin { 
          to { transform: rotate(360deg); } 
        }`}</style>
      </div>
    )
  }

  // STEP 2: Not logged in
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  // STEP 3: Check explicit allowedRoles if provided
  if (allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)) {
    // User doesn't have permission for this specific route
    const dashboardRoute = getDashboardRoute(user.role)
    return (
      <Navigate
        to={dashboardRoute}
        replace
      />
    )
  }

  // STEP 4: Check role-based URL access
  // If route contains a role prefix, verify user has that role
  const pathMatch = location.pathname.match(/^\/([a-z]+)/)
  if (pathMatch && ['admin', 'gm', 'warden', 'dean', 'principal', 'student'].includes(pathMatch[1])) {
    const routeRole = pathMatch[1]
    // User's role must match or be allowed
    if (user.role !== routeRole) {
      const dashboardRoute = getDashboardRoute(user.role)
      return (
        <Navigate
          to={dashboardRoute}
          replace
        />
      )
    }
  }

  // STEP 5: All permissions granted
  return children
}

export default ProtectedRoute
