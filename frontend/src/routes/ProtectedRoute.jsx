import React from "react";
import { Navigate } from "react-router-dom";
import { isTokenValid } from "../utils/auth";

const ProtectedRoute = ({ children }) => {
  if (!isTokenValid()) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
