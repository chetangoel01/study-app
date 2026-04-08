import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import type { AuthUser } from '../types.js';
import { Layout } from './Layout.js';
import { SessionBanner } from './SessionBanner.js';

export function ProtectedRoute() {
  const [user, setUser] = useState<AuthUser | null | 'loading'>('loading');
  useEffect(() => {
    api.get<AuthUser>('/api/auth/me').then(setUser).catch(() => setUser(null));
  }, []);
  if (user === 'loading') return <div className="loading" role="status" aria-live="polite">Loading...</div>;
  if (user === null) return <Navigate to="/login" replace />;
  return (
    <Layout user={user}>
      <SessionBanner />
      <Outlet />
    </Layout>
  );
}
