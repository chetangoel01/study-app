import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, signup, error, loading } = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') await login(email, password);
    else await signup(email, password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Study Guide</h1>
        <p className="login-sub">Track your interview prep progress</p>
        <div className="oauth-buttons">
          <a href="/api/auth/oauth/google" className="oauth-btn">Continue with Google</a>
          <a href="/api/auth/oauth/github" className="oauth-btn">Continue with GitHub</a>
        </div>
        <div className="divider"><span>or</span></div>
        <form onSubmit={onSubmit} className="login-form">
          <input type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 8 chars)" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Loading…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
        <p className="login-toggle">
          {mode === 'login'
            ? <><span>No account? </span><button onClick={() => setMode('signup')}>Sign up</button></>
            : <><span>Have an account? </span><button onClick={() => setMode('login')}>Log in</button></>}
        </p>
      </div>
    </div>
  );
}
