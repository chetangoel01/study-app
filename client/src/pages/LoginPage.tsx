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
      <div className="login-shell">
        <section className="login-brand-panel">
          <p className="eyebrow">Interview prep, but calmer</p>
          <h1>Reclaiming the focus<br /><em>in software mastery.</em></h1>
          <p className="login-sub">
            Step away from the noise. Our sanctuary is designed for deep work,
            cognitive flow, and structured technical growth.
          </p>
          <div className="login-highlights">
            <div className="login-highlight">
              <span className="login-highlight-index">01</span>
              <div>
                <strong>Clear next step</strong>
                <p>Jump back into the right module instead of deciding from scratch.</p>
              </div>
            </div>
            <div className="login-highlight">
              <span className="login-highlight-index">02</span>
              <div>
                <strong>Progress that stays visible</strong>
                <p>See every track, module, and checklist item in one place.</p>
              </div>
            </div>
            <div className="login-highlight">
              <span className="login-highlight-index">03</span>
              <div>
                <strong>Notes where you need them</strong>
                <p>Capture patterns, mistakes, and follow-ups next to the work itself.</p>
              </div>
            </div>
          </div>
          <p className="login-social-proof">Join 12,000+ engineers practicing deep focus</p>
        </section>

        <section className="login-card">
          <div className="login-card-header">
            <p className="panel-label">{mode === 'login' ? 'Welcome back' : 'Create account'}</p>
            <h2>{mode === 'login' ? 'Pick up where you left off' : 'Set up your study workspace'}</h2>
          </div>
          <div className="oauth-buttons">
            <a href="/api/auth/oauth/google" className="oauth-btn">Continue with Google</a>
            <a href="/api/auth/oauth/github" className="oauth-btn">Continue with GitHub</a>
          </div>
          <div className="divider"><span>or</span></div>
          <form onSubmit={onSubmit} className="login-form">
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-describedby="password-hint"
              required
            />
            <p id="password-hint" className="field-hint">
              {mode === 'login' ? 'Use your existing password.' : 'Use at least 8 characters.'}
            </p>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>
          <p className="login-toggle">
            {mode === 'login'
              ? (
                  <>
                    <span>No account? </span>
                    <button type="button" onClick={() => setMode('signup')}>Sign up</button>
                  </>
                )
              : (
                  <>
                    <span>Have an account? </span>
                    <button type="button" onClick={() => setMode('login')}>Log in</button>
                  </>
                )}
          </p>
        </section>
      </div>
    </div>
  );
}
