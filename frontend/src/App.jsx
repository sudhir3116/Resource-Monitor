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
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const UsageList = React.lazy(() => import('./pages/UsageList'));
const UsageForm = React.lazy(() => import('./pages/UsageForm'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const AlertForm = React.lazy(() => import('./pages/AlertForm'));
const EnhancedReports = React.lazy(() => import('./pages/EnhancedReports'));
const Profile = React.lazy(() => import('./pages/Profile'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const UserManagement = React.lazy(() => import('./pages/UserManagement'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AlertsList = React.lazy(() => import('./pages/AlertsList'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const Resources = React.lazy(() => import('./pages/Usage'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
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
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset/:token" element={<ResetPassword />} />

          {/* Protected Routes (MainLayout) */}
          <Route path="/*" element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  {/* Core Dashboard */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />

                  {/* Resource Management */}
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />

                  {/* Usage Records */}
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

                  {/* Alerts */}
                  <Route path="/alerts" element={<Alerts />} />
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

                  {/* Reports */}
                  <Route path="/reports" element={
                    <ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN]}>
                      <EnhancedReports />
                    </ProtectedRoute>
                  } />

                  {/* Admin Routes */}
                  <Route path="/admin" element={
                    <ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/users" element={
                    <ProtectedRoute roles={[ROLES.ADMIN]}>
                      <UserManagement />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute roles={[ROLES.ADMIN]}>
                      <Settings />
                    </ProtectedRoute>
                  } />
                  <Route path="/audit-logs" element={
                    <ProtectedRoute roles={[ROLES.ADMIN]}>
                      <AuditLogs />
                    </ProtectedRoute>
                  } />

                  {/* Fallback */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
