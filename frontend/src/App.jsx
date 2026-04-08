import React, { useContext, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { AuthContext } from './context/AuthContext';
import { ROLES } from './utils/roles';
import Loading from './components/Loading';
import ErrorBoundary from './components/common/ErrorBoundary';
import { isTokenValid } from './utils/auth';

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
const PrincipalAnalytics = React.lazy(() => import('./pages/principal/PrincipalAnalytics'));
const PrincipalReports = React.lazy(() => import('./pages/principal/PrincipalReports'));
const PrincipalAnnouncements = React.lazy(() => import('./pages/principal/PrincipalAnnouncements'));
const UnifiedDashboard = React.lazy(() => import('./pages/common/UnifiedDashboard'));
const WardenDashboard = React.lazy(() => import('./pages/WardenDashboard'));
const GMResourceConfig = React.lazy(() => import('./pages/gm/ResourceConfig'));
const ExecutiveDashboard = React.lazy(() => import('./pages/ExecutiveDashboard'));
const PrincipalDashboard = ExecutiveDashboard;
const DeanDashboard = ExecutiveDashboard;
const DeanAnalytics = React.lazy(() => import('./pages/dean/DeanAnalytics'));
const DeanReports = React.lazy(() => import('./pages/dean/DeanReports'));
const DeanAnnouncements = React.lazy(() => import('./pages/dean/DeanAnnouncements'));

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

  useEffect(() => {
    if (!isTokenValid()) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, []);

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
              <ProtectedRoute>
                <RoleDashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/announcements" element={
              <ProtectedRoute>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ADMIN ROUTES (/admin/*)                                         */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            {/* Admin can see records, but only Warden can log new ones per strict instruction */}
            <Route path="/admin/usage" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
            <Route path="/admin/usage/all" element={<ProtectedRoute><UsageList /></ProtectedRoute>} />
            <Route path="/admin/alerts" element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/admin/alerts/new" element={
              <ProtectedRoute>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/admin/alerts/:id/edit" element={
              <ProtectedRoute>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/admin/complaints" element={
              <ProtectedRoute>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/notices" element={
              <ProtectedRoute>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/blocks" element={
              <ProtectedRoute>
                <BlockManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/resource-config" element={
              <ProtectedRoute>
                <ResourceConfig />
              </ProtectedRoute>
            } />
            <Route path="/admin/audit-logs" element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/admin/database-viewer" element={
              <ProtectedRoute>
                <DatabaseViewer />
              </ProtectedRoute>
            } />
            <Route path="/admin/database" element={
              <ProtectedRoute>
                <DatabaseViewer />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* GM ROUTES (/gm/*)                                               */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/gm/dashboard" element={
              <ProtectedRoute>
                <GMDashboard />
              </ProtectedRoute>
            } />
            <Route path="/gm/usage" element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/gm/usage/all" element={
              <ProtectedRoute>
                <UsageList />
              </ProtectedRoute>
            } />
            <Route path="/gm/alerts" element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/gm/complaints" element={
              <ProtectedRoute>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/gm/analytics" element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/gm/notices" element={
              <ProtectedRoute>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/gm/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/gm/audit-logs" element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/gm/resource-config" element={
              <ProtectedRoute>
                <GMResourceConfig />
              </ProtectedRoute>
            } />
            <Route path="/gm/users" element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/gm/blocks" element={
              <ProtectedRoute>
                <BlockManagement />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* WARDEN ROUTES (/warden/*)                                       */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/warden/dashboard" element={
              <ProtectedRoute>
                <WardenDashboard />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage" element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage/all" element={
              <ProtectedRoute>
                <UsageList />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage/new" element={
              <ProtectedRoute>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/usage/:id/edit" element={
              <ProtectedRoute>
                <UsageForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts" element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts/rules" element={
              <ProtectedRoute>
                <AlertsList />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts/new" element={
              <ProtectedRoute>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/alerts/:id/edit" element={
              <ProtectedRoute>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/warden/complaints" element={
              <ProtectedRoute>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/warden/notices" element={
              <ProtectedRoute>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />
            <Route path="/warden/daily-report" element={
              <ProtectedRoute>
                <DailyReportWarden />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* STUDENT ROUTES (/student/*)                                     */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/student/dashboard" element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/complaints" element={
              <ProtectedRoute>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/student/notices" element={
              <ProtectedRoute>
                <AnnouncementBoard />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* DEAN ROUTES (/dean/*)                                           */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/dean/dashboard" element={
              <ProtectedRoute>
                <DeanDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dean/alerts" element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/dean/analytics" element={
              <ProtectedRoute>
                <DeanAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/dean/announcements" element={
              <ProtectedRoute>
                <DeanAnnouncements />
              </ProtectedRoute>
            } />
            <Route path="/dean/reports" element={
              <ProtectedRoute>
                <DeanReports />
              </ProtectedRoute>
            } />
            <Route path="/dean/complaints" element={<ProtectedRoute allowedRoles={['dean']}><Complaints /></ProtectedRoute>} />
            <Route path="/dean/audit-logs" element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            } />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* PRINCIPAL ROUTES (/principal/*)                                 */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/principal/dashboard" element={
              <ProtectedRoute>
                <PrincipalDashboard />
              </ProtectedRoute>
            } />
            <Route path="/principal/analytics" element={
              <ProtectedRoute>
                <PrincipalAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/principal/announcements" element={
              <ProtectedRoute>
                <PrincipalAnnouncements />
              </ProtectedRoute>
            } />
            <Route path="/principal/reports" element={<ProtectedRoute allowedRoles={['principal']}><PrincipalReports /></ProtectedRoute>} />
            <Route path="/principal/alerts" element={<ProtectedRoute allowedRoles={['principal']}><Alerts /></ProtectedRoute>} />
            <Route path="/principal/complaints" element={<ProtectedRoute allowedRoles={['principal']}><Complaints /></ProtectedRoute>} />
            <Route path="/principal/audit-logs" element={<ProtectedRoute allowedRoles={['principal']}><AuditLogs /></ProtectedRoute>} />

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* LEGACY ROUTES — kept for backward compatibility                 */}
            {/* ════════════════════════════════════════════════════════════════ */}
            <Route path="/usage" element={
              <ProtectedRoute>
                <Resources />
              </ProtectedRoute>
            } />
            <Route path="/usage/all" element={
              <ProtectedRoute>
                <UsageList />
              </ProtectedRoute>
            } />
            {/* Only Warden can add/edit usage records as per strict task rule */}
            <Route path="/usage/new" element={<ProtectedRoute allowedRoles={['warden']}><UsageForm /></ProtectedRoute>} />
            <Route path="/usage/:id/edit" element={<ProtectedRoute allowedRoles={['warden']}><UsageForm /></ProtectedRoute>} />
            <Route path="/alerts" element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            } />
            <Route path="/alerts/rules" element={
              <ProtectedRoute>
                <AlertsList />
              </ProtectedRoute>
            } />
            <Route path="/alerts/new" element={
              <ProtectedRoute>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/alerts/:id/edit" element={
              <ProtectedRoute>
                <AlertForm />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/complaints" element={
              <ProtectedRoute>
                <Complaints />
              </ProtectedRoute>
            } />
            <Route path="/resource-config" element={
              <ProtectedRoute>
                <ResourceConfig />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/blocks" element={
              <ProtectedRoute>
                <BlockManagement />
              </ProtectedRoute>
            } />
            <Route path="/audit-logs" element={
              <ProtectedRoute>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
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