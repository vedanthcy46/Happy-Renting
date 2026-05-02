import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * ProtectedRoute
 * @param {string[]} roles — allowed roles. If empty, any authenticated user passes.
 */
const ProtectedRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, role, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change if required
  if (user?.mustChangePassword && location.pathname !== '/setup-password') {
    return <Navigate to="/setup-password" replace />;
  }

  // Force email verification if required (Optional: Block everything or just certain routes)
  // For now, let's allow them in but the banner in Navbar will show.
  // If we want to block strictly:
  /*
  if (user && !user.emailVerified && location.pathname !== '/profile') {
    return <Navigate to="/dashboard" replace />; 
  }
  */

  if (roles.length > 0 && !roles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
