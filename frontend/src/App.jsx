import React, { useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import UsageList from './pages/UsageList'
import UsageForm from './pages/UsageForm'
import AlertsList from './pages/AlertsList'
import AlertForm from './pages/AlertForm'
import Reports from './pages/Reports'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import Nav from './components/Nav'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import { AuthContext } from './context/AuthContext'
import { ROLES } from './utils/roles'
import Loading from './components/Loading'

function App() {
  const { user, loading } = useContext(AuthContext)

  if (loading) return <Loading />

  return (
    <div>
      <Nav />
      <main className="container main-content">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />

          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset/:token" element={<ResetPassword />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          <Route path="/admin" element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN]}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/usage" element={<ProtectedRoute><UsageList /></ProtectedRoute>} />

          <Route path="/usage/new" element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.WARDEN]}>
              <UsageForm />
            </ProtectedRoute>
          } />

          <Route path="/usage/:id/edit" element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.WARDEN]}>
              <UsageForm />
            </ProtectedRoute>
          } />

          <Route path="/alerts" element={<ProtectedRoute><AlertsList /></ProtectedRoute>} />

          <Route path="/alerts/new" element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN]}>
              <AlertForm />
            </ProtectedRoute>
          } />

          <Route path="/alerts/:id/edit" element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN]}>
              <AlertForm />
            </ProtectedRoute>
          } />

          <Route path="/reports" element={
            <ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN]}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="*" element={<div style={{ padding: 32, textAlign: 'center' }}>Page Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App
