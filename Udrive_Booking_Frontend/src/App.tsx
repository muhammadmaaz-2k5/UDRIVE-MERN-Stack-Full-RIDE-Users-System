import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Welcome } from './pages/Welcome';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { RiderDashboard } from './pages/RiderDashboard';
import { Settings } from './pages/Settings';
import { useAuthStore } from './store/useAuthStore';

const App: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/" 
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'rider' ? '/rider-dashboard' : '/customer-dashboard'} replace />
          ) : (
            <Welcome />
          )
        } 
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route element={<ProtectedRoute allowedRole="customer" />}>
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRole="rider" />}>
        <Route path="/rider-dashboard" element={<RiderDashboard />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
