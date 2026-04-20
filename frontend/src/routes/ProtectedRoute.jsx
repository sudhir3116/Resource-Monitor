import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isTokenValid } from "../utils/auth";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return null;

  if (!isTokenValid() || !user) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (user.role || "").toLowerCase();

  if (allowedRoles && allowedRoles.length > 0) {
    const roles = allowedRoles.map(r => r.toLowerCase());
    if (!roles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  } else {
    const path = location.pathname.toLowerCase();
    
    if (path.startsWith('/admin') && userRole !== 'admin') {
      return <Navigate to="/unauthorized" replace />;
    }
    if (path.startsWith('/gm') && !['gm', 'admin'].includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
    if (path.startsWith('/warden') && !['warden', 'admin', 'gm'].includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
    if (path.startsWith('/student') && !['student', 'admin'].includes(userRole)) {
       return <Navigate to="/unauthorized" replace />;
    }
    if (path.startsWith('/dean') && !['dean', 'admin'].includes(userRole)) {
       return <Navigate to="/unauthorized" replace />;
    }
    if (path.startsWith('/principal') && !['principal', 'admin'].includes(userRole)) {
       return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
