import React, { useContext, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { AuthContext } from './context/AuthContext';
import { ROLES } from './utils/roles';
import Loading from './components/Loading';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy Load Pages
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const UsageList = React.lazy(() => import('./pages/UsageList'));
const UsageForm = React.lazy(() => import('./pages/UsageForm'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const AlertForm = React.lazy(() => import('./pages/AlertForm'));
const Profile = React.lazy(() => import('./pages/Profile'));
const UserManagement = React.lazy(() => import('./pages/UserManagement'));
const AlertsList = React.lazy(() => import('./pages/AlertsList'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const Resources = React.lazy(() => import('./pages/Usage'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Complaints = React.lazy(() => import('./pages/Complaints'));
const ResourceConfig = React.lazy(() => import('./pages/ResourceConfig'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function App() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <span style={{ color: 'var(--text-secondary)' }}>Loading modules...</span>
          </div>
        </div>
      }>
        <Routes>
          {/* Public Routes (No Layout) */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset/:token" element={<ResetPassword />} />

          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            {/* Core Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />

            {/* Main Tabs */}
            <Route path="/usage" element={<Resources />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/complaints" element={<Complaints />} />
            <Route path="/resource-config" element={
              <ProtectedRoute roles={[ROLES.ADMIN, ROLES.WARDEN]}>
                <ResourceConfig />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute roles={[ROLES.ADMIN]}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/audit-logs" element={
              <ProtectedRoute roles={[ROLES.ADMIN, ROLES.WARDEN, ROLES.DEAN, ROLES.PRINCIPAL]}>
                <AuditLogs />
              </ProtectedRoute>
            } />

            {/* Sub-routes for Usage and Alerts kept for functionality */}
            <Route path="/usage/all" element={<UsageList />} />
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

            <Route path="/alerts/rules" element={<AlertsList />} />
            <Route path="/alerts/new" element={
              <ProtectedRoute roles={[ROLES.ADMIN, ROLES.WARDEN]}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/alerts/:id/edit" element={
              <ProtectedRoute roles={[ROLES.ADMIN, ROLES.WARDEN]}>
                <AlertForm />
              </ProtectedRoute>
            } />

            {/* Fallback inside MainLayout */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
