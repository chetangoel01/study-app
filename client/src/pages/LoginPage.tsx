import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';

function GoogleOAuthIcon() {
  return (
    <svg className="oauth-brand-svg oauth-brand-svg--google" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.972 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function GitHubOAuthIcon() {
  return (
    <svg className="oauth-brand-svg oauth-brand-svg--github" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LoginCompanyLogoStrip() {
  return (
    <ul className="login-company-logos" aria-label="Trusted by engineers at leading technology companies">
      <li>
        <span className="sr-only">Google</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12.48 10.92v3.28h4.92c-.26 1.57-1.7 4.62-4.92 4.62-2.96 0-5.37-2.43-5.37-5.42 0-3 2.41-5.42 5.37-5.42 1.68 0 2.82.72 3.47 1.33l2.36-2.27C16.82 4.93 14.89 4 12.48 4 7.84 4 4.16 7.68 4.16 12.4c0 4.72 3.68 8.4 8.32 8.4 4.81 0 8-3.3 8-7.93 0-.53-.06-1.04-.15-1.54H12.48z"
          />
        </svg>
      </li>
      <li>
        <span className="sr-only">Microsoft</span>
        <svg viewBox="0 0 23 23" aria-hidden="true">
          <path fill="currentColor" d="M0 0h11v11H0zm12 0h11v11H12zM0 12h11v11H0zm12 0h11v11H12z" />
        </svg>
      </li>
      <li>
        <span className="sr-only">Apple</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.71-2.48 4.12-2.51 1.28-.03 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73.83 1.94 1.79 2.84 1.79.1-1.12-.37-2.23-.99-3.11-.89-1.25-2.39-2.11-3.64-2.22-.15 1.37.39 2.73 1.79 3.54z"
          />
        </svg>
      </li>
      <li>
        <span className="sr-only">LinkedIn</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
          />
        </svg>
      </li>
      <li>
        <span className="sr-only">Stripe</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.244 0 6.734 1.072 5.457 2.96c-1.277 1.89-1.605 4.182-1.16 6.93.45 2.747 1.687 4.442 4.133 5.477 2.446 1.036 3.748 2.17 3.748 3.56 0 1.001-.89 1.64-2.31 1.64-1.684 0-4.097-.92-6.058-2.002L2.89 23.36c1.937.955 4.237 1.638 6.788 1.638 3.312 0 5.686-1.073 6.963-2.697 1.277-1.624 1.605-3.715 1.16-6.433-.446-2.718-1.87-4.365-4.825-5.718z"
          />
        </svg>
      </li>
    </ul>
  );
}

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
    <div className="login-page login-page-stitch">
      <div className="login-shell login-shell-stitch">
        <section className="login-brand-panel login-brand-panel-stitch">
          <p className="eyebrow">Interview prep, but calmer</p>
          <h1>
            Reclaiming the focus
            <br />
            <em>in software mastery.</em>
          </h1>
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
          <div className="login-social-stack">
            <LoginCompanyLogoStrip />
            <p className="login-social-proof">Join thousands of engineers practicing deep focus.</p>
          </div>
          <div className="login-brand-glow login-brand-glow--tr" aria-hidden="true" />
          <div className="login-brand-glow login-brand-glow--bl" aria-hidden="true" />
        </section>

        <section className="login-card login-card-stitch">
          <div className="login-card-header">
            <p className="panel-label">{mode === 'login' ? 'Welcome back' : 'Create account'}</p>
            <h2>{mode === 'login' ? 'Continue your journey' : 'Set up your study workspace'}</h2>
            <p className="login-card-lede">
              {mode === 'login' ? 'Pick up where you left off.' : 'A few details, then you are in.'}
            </p>
          </div>
          <div className="oauth-buttons oauth-buttons-stitch">
            <a href="/api/auth/oauth/google" className="oauth-btn oauth-btn-stitch oauth-btn-with-brand">
              <span className="oauth-btn-brand-icon" aria-hidden="true">
                <GoogleOAuthIcon />
              </span>
              <span className="oauth-btn-brand-label">Continue with Google</span>
            </a>
            <a href="/api/auth/oauth/github" className="oauth-btn oauth-btn-stitch oauth-btn-with-brand">
              <span className="oauth-btn-brand-icon" aria-hidden="true">
                <GitHubOAuthIcon />
              </span>
              <span className="oauth-btn-brand-label">Continue with GitHub</span>
            </a>
          </div>
          <div className="divider divider-stitch"><span>or</span></div>
          <form onSubmit={onSubmit} className="login-form login-form-stitch">
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
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
              placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
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
            <button type="submit" disabled={loading} aria-busy={loading} className="login-submit-stitch">
              {loading ? 'Loading...' : mode === 'login' ? 'Log in' : 'Sign up'}
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
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
