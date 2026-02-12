import React from 'react'
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
import Nav from './components/Nav'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  console.log('App render')
  return (
    <div>
      <Nav />
      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/usage" element={<ProtectedRoute><UsageList /></ProtectedRoute>} />
          <Route path="/usage/new" element={<ProtectedRoute><UsageForm /></ProtectedRoute>} />
          <Route path="/usage/:id/edit" element={<ProtectedRoute><UsageForm /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><AlertsList /></ProtectedRoute>} />
          <Route path="/alerts/new" element={<ProtectedRoute><AlertForm /></ProtectedRoute>} />
          <Route path="/alerts/:id/edit" element={<ProtectedRoute><AlertForm /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<div style={{padding:32,textAlign:'center'}}>Page Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App
