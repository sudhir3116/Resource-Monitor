/* eslint-disable react-hooks/exhaustive-deps */
import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import StudentDashboard from './StudentDashboard';
import WardenDashboard from './WardenDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import AdminDashboard from './AdminDashboard';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case ROLES.STUDENT:
      return <StudentDashboard />;
    case ROLES.WARDEN:
      return <WardenDashboard />;
    case ROLES.DEAN:
    case ROLES.PRINCIPAL:
      return <ExecutiveDashboard />;
    case ROLES.ADMIN:
      // Admins can see the Admin Dashboard, or redirected to /admin
      // Since App.jsx has a dedicated /admin route, we can redirect there OR render it here.
      // Rendering it here makes /dashboard work for everyone.
      return <AdminDashboard />;
    default:
      return <StudentDashboard />;
  }
}