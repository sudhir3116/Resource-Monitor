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
const UserManagement = React.lazy(() => import('./pages/UserManagement'));
const AlertsList = React.lazy(() => import('./pages/AlertsList'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const Resources = React.lazy(() => import('./pages/Usage'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Complaints = React.lazy(() => import('./pages/Complaints'));
const ResourceConfig = React.lazy(() => import('./pages/ResourceConfig'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const BlockManagement = React.lazy(() => import('./pages/BlockManagement'));
const DatabaseViewer = React.lazy(() => import('./pages/admin/DatabaseViewer'));
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard'));
const AnnouncementBoard = React.lazy(() => import('./pages/AnnouncementBoard'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const DailyReportWarden = React.lazy(() => import('./pages/DailyReportWarden'));
const GMDashboard = React.lazy(() => import('./pages/gm/GMDashboard'));
const Reports = React.lazy(() => import('./pages/Reports'));
const ExecutiveDashboard = React.lazy(() => import('./pages/ExecutiveDashboard'));
const PrincipalDashboard = React.lazy(() => import('./pages/principal/PrincipalDashboard'));
const UnifiedDashboard = React.lazy(() => import('./pages/common/UnifiedDashboard'));

// Redirects /dashboard to role-specific URL
const RoleDashboard = () => {
  const { user } = useContext(AuthContext)
  if (!user) return <Navigate to="/login" replace />
  const map = {
    admin: '/admin/dashboard',
    gm: '/gm/dashboard',
    warden: '/warden/dashboard',
    student: '/student/dashboard',
    dean: '/dean/dashboard',
    principal: '/principal/dashboard'
  }
  return <Navigate to={map[(user.role || '').toLowerCase()] || '/dashboard'} replace />
}

function App() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loading />
        <p className="mt-4 text-sm text-gray-500">
          Loading EcoMonitor...
        </p>
      </div>
    );
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

          {/* ══════════════════════════════════════════ */}
          {/* PUBLIC ROUTES — No auth needed            */}
          {/* ══════════════════════════════════════════ */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset/:token" element={<ResetPassword />} />

          {/* ══════════════════════════════════════════ */}
          {/* PROTECTED LAYOUT WRAPPER                  */}
          {/* ══════════════════════════════════════════ */}
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* SHARED ROUTES — All roles                                       */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'student', 'dean', 'principal']}>
                <RoleDashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'student', 'dean', 'principal']}>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/announcements" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'student', 'dean', 'principal']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ADMIN ROUTES (/admin/*)                                         */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/usage" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/admin/usage/all" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UsageList />
              </ProtectedRoute>
            } />
            <Route path="/admin/usage/new" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/admin/usage/:id/edit" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/admin/alerts" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/admin/alerts/new" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/admin/alerts/:id/edit" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/admin/complaints" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/notices" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/blocks" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <BlockManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/resource-config" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ResourceConfig />
              </ProtectedRoute>
            } />
            <Route path="/admin/audit-logs" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/admin/database-viewer" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DatabaseViewer />
              </ProtectedRoute>
            } />
            <Route path="/admin/database" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DatabaseViewer />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Reports />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* GM ROUTES (/gm/*)                                               */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/gm/dashboard" element={
              <ProtectedRoute allowedRoles={['gm', 'admin']}>
                <UnifiedDashboard />
              </ProtectedRoute>
            } />
            <Route path="/gm/usage" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/gm/usage/all" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <UsageList />
              </ProtectedRoute>
            } />
            <Route path="/gm/alerts" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/gm/complaints" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/gm/analytics" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/gm/notices" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/gm/reports" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/gm/audit-logs" element={
              <ProtectedRoute allowedRoles={['gm']}>
                <AuditLogs />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* WARDEN ROUTES (/warden/*)                                       */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/warden/dashboard" element={
              <ProtectedRoute allowedRoles={['warden', 'admin']}>
                <UnifiedDashboard />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage/all" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <UsageList />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage/new" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage/:id/edit" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts/rules" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <AlertsList />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts/new" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts/:id/edit" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/complaints" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/warden/notices" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/warden/daily-report" element={
              <ProtectedRoute allowedRoles={['warden']}>
                <DailyReportWarden />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* STUDENT ROUTES (/student/*)                                     */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/student/dashboard" element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <UnifiedDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/complaints" element={
              <ProtectedRoute allowedRoles={['student']}>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/student/notices" element={
              <ProtectedRoute allowedRoles={['student']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* DEAN ROUTES (/dean/*)                                           */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/dean/dashboard" element={
              <ProtectedRoute allowedRoles={['dean', 'admin']}>
                <UnifiedDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dean/alerts" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/dean/analytics" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/dean/notices" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/dean/reports" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/dean/audit-logs" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <AuditLogs />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* PRINCIPAL ROUTES (/principal/*)                                 */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/principal/dashboard" element={
              <ProtectedRoute allowedRoles={['principal', 'admin']}>
                <UnifiedDashboard />
              </ProtectedRoute>
            } />
            <Route path="/principal/analytics" element={
              <ProtectedRoute allowedRoles={['principal']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/principal/notices" element={
              <ProtectedRoute allowedRoles={['principal']}>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/principal/reports" element={
              <ProtectedRoute allowedRoles={['principal']}>
                <Reports />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* LEGACY ROUTES — kept for backward compatibility                 */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/usage" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'dean']}>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/usage/all" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'dean']}>
                <UsageList />
              </ProtectedRoute>
            } />
            <Route path="/usage/new" element={
              <ProtectedRoute allowedRoles={['admin', 'warden']}>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/usage/:id/edit" element={
              <ProtectedRoute allowedRoles={['admin', 'warden']}>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/alerts" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'dean']}>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/alerts/rules" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'dean']}>
                <AlertsList />
              </ProtectedRoute>
            } />
            <Route path="/alerts/new" element={
              <ProtectedRoute allowedRoles={['admin', 'warden']}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/alerts/:id/edit" element={
              <ProtectedRoute allowedRoles={['admin', 'warden']}>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'dean', 'principal']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/complaints" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'warden', 'student']}>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/resource-config" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ResourceConfig />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/blocks" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <BlockManagement />
              </ProtectedRoute>
            } />
            <Route path="/audit-logs" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'dean']}>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['admin', 'gm', 'dean']}>
                <Reports />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* 404 FALLBACK — Must be last                                     */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="*" element={<NotFound />} />

          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;