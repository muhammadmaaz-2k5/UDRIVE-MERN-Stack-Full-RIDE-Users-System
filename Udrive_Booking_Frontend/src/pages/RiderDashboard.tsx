import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';

export const RiderDashboard: React.FC = () => {
  const logout = useAuthStore((state) => state.logout);

  return (
    <div style={{ padding: 'var(--spacing-6)', color: 'var(--text-primary)' }}>
      <h1>Rider Dashboard</h1>
      <p>Welcome to UDRIVE! Your ride management interface will be here.</p>
      <div style={{ marginTop: 'var(--spacing-6)' }}>
        <Button variant="danger" onClick={logout}>Log Out</Button>
      </div>
    </div>
  );
};
