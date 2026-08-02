import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface ProtectedRouteProps {
  allowedRole?: 'customer' | 'rider';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    // Redirect to the correct dashboard based on role
    return <Navigate to={user?.role === 'rider' ? '/rider-dashboard' : '/customer-dashboard'} replace />;
  }

  return <Outlet />;
};
