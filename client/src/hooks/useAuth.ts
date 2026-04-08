import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export function useAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    setLoading(true); setError('');
    try {
      await api.post('/api/auth/login', { email, password });
      navigate(searchParams.get('next') ?? '/', { replace: true });
    } catch (err: unknown) {
      const e = err as { body?: { code?: string; error?: string } };
      setError(e.body?.code === 'NO_PASSWORD'
        ? 'Looks like you usually sign in with Google or GitHub. Set a password via email link.'
        : e.body?.error ?? 'Login failed');
    } finally { setLoading(false); }
  }

  async function signup(email: string, password: string) {
    setLoading(true); setError('');
    try {
      await api.post('/api/auth/signup', { email, password });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError((err as { body?: { error?: string } }).body?.error ?? 'Signup failed');
    } finally { setLoading(false); }
  }

  return { login, signup, error, loading };
}
