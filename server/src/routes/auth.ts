import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { Google, GitHub, generateState, generateCodeVerifier, decodeIdToken } from 'arctic';
import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import { signAccessToken } from '../lib/jwt.js';
import { createSession, rotateSession, revokeSession } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const BCRYPT_ROUNDS = 12;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function upsertOAuthUser(
  db: Database.Database,
  provider: 'google' | 'github',
  providerUserId: string,
  email: string,
): { id: number; email: string } {
  return db.transaction(() => {
    const existing = db
      .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
      .get(provider, providerUserId) as { user_id: number } | undefined;

    if (existing) {
      return db.prepare('SELECT id, email FROM users WHERE id = ?').get(existing.user_id) as { id: number; email: string };
    }

    const existingUser = db
      .prepare('SELECT id, email FROM users WHERE email = ?')
      .get(email.toLowerCase()) as { id: number; email: string } | undefined;

    const userId = existingUser
      ? existingUser.id
      : (db.prepare('INSERT INTO users (email) VALUES (?) RETURNING id').get(email.toLowerCase()) as { id: number }).id;

    db.prepare('INSERT OR IGNORE INTO oauth_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)')
      .run(userId, provider, providerUserId);

    return { id: userId, email: email.toLowerCase() };
  })();
}

export function makeAuthRouter(db: Database.Database): Hono {
  const router = new Hono();

  router.post('/signup', async (c) => {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    if (!email || !password || password.length < 8)
      return c.json({ error: 'Email and password (min 8 chars) required' }, 400);

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()))
      return c.json({ error: 'Email already registered' }, 409);

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = db
      .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email')
      .get(email.toLowerCase(), hash) as { id: number; email: string };

    const accessToken = await signAccessToken(user.id, user.email);
    const refreshId = createSession(user.id, db);
    setCookie(c, 'access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 });
    setCookie(c, 'refresh_token', refreshId, { ...COOKIE_OPTS, maxAge: 30 * 86400 });
    return c.json({ id: user.id, email: user.email }, 201);
  });

  router.post('/login', async (c) => {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400);
    const user = db
      .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
      .get(email.toLowerCase()) as { id: number; email: string; password_hash: string | null } | undefined;

    if (!user) return c.json({ error: 'Invalid credentials' }, 401);
    if (user.password_hash === null)
      return c.json({ error: 'No password set for this account', code: 'NO_PASSWORD' }, 401);

    if (!(await bcrypt.compare(password, user.password_hash)))
      return c.json({ error: 'Invalid credentials' }, 401);

    const accessToken = await signAccessToken(user.id, user.email);
    const refreshId = createSession(user.id, db);
    setCookie(c, 'access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 });
    setCookie(c, 'refresh_token', refreshId, { ...COOKIE_OPTS, maxAge: 30 * 86400 });
    return c.json({ id: user.id, email: user.email });
  });

  router.post('/logout', (c) => {
    const refreshId = getCookie(c, 'refresh_token');
    if (refreshId) revokeSession(refreshId, db);
    setCookie(c, 'access_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    setCookie(c, 'refresh_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    return c.json({ ok: true });
  });

  router.post('/refresh', async (c) => {
    const oldId = getCookie(c, 'refresh_token');
    if (!oldId) return c.json({ error: 'No refresh token' }, 401);
    const rotated = rotateSession(oldId, db);
    if (!rotated) return c.json({ error: 'Invalid or expired refresh token' }, 401);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(rotated.userId) as { id: number; email: string } | undefined;
    if (!user) return c.json({ error: 'User not found' }, 401);
    const accessToken = await signAccessToken(user.id, user.email);
    setCookie(c, 'access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 });
    setCookie(c, 'refresh_token', rotated.sessionId, { ...COOKIE_OPTS, maxAge: 30 * 86400 });
    return c.json({ ok: true });
  });

  router.get('/me', requireAuth, (c) => {
    const user = c.get('user');
    return c.json({ id: user.id, email: user.email });
  });

  // OAuth — Google
  const oauthStore = new Map<string, { verifier?: string; expiresAt: number }>();

  router.get('/oauth/google', (c) => {
    const google = new Google(config.googleClientId, config.googleClientSecret,
      `${config.baseUrl}/api/auth/oauth/google/callback`);
    const state = generateState();
    const verifier = generateCodeVerifier();
    oauthStore.set(state, { verifier, expiresAt: Date.now() + 600_000 });
    const url = google.createAuthorizationURL(state, verifier, ['openid', 'email']);
    setCookie(c, 'oauth_state', state, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 600 });
    return c.redirect(url.toString());
  });

  router.get('/oauth/google/callback', async (c) => {
    const { code, state } = c.req.query();
    const stored = oauthStore.get(state ?? '');
    if (!code || getCookie(c, 'oauth_state') !== state || !stored || Date.now() > stored.expiresAt)
      return c.json({ error: 'Invalid OAuth state' }, 400);
    oauthStore.delete(state);
    try {
      const google = new Google(config.googleClientId, config.googleClientSecret,
        `${config.baseUrl}/api/auth/oauth/google/callback`);
      const tokens = await google.validateAuthorizationCode(code, stored.verifier!);
      const claims = decodeIdToken(tokens.idToken()) as { sub: string; email: string; email_verified: boolean };
      if (!claims.email_verified) return c.json({ error: 'Google email not verified' }, 400);
      const user = await upsertOAuthUser(db, 'google', claims.sub, claims.email);
      const accessToken = await signAccessToken(user.id, user.email);
      const refreshId = createSession(user.id, db);
      setCookie(c, 'access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 });
      setCookie(c, 'refresh_token', refreshId, { ...COOKIE_OPTS, maxAge: 30 * 86400 });
      return c.redirect('/');
    } catch { return c.json({ error: 'OAuth failed' }, 400); }
  });

  // OAuth — GitHub
  router.get('/oauth/github', (c) => {
    const github = new GitHub(config.githubClientId, config.githubClientSecret,
      `${config.baseUrl}/api/auth/oauth/github/callback`);
    const state = generateState();
    oauthStore.set(state, { expiresAt: Date.now() + 600_000 });
    const url = github.createAuthorizationURL(state, ['user:email']);
    setCookie(c, 'oauth_state', state, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 600 });
    return c.redirect(url.toString());
  });

  router.get('/oauth/github/callback', async (c) => {
    const { code, state } = c.req.query();
    const stored = oauthStore.get(state ?? '');
    if (!code || getCookie(c, 'oauth_state') !== state || !stored || Date.now() > stored.expiresAt)
      return c.json({ error: 'Invalid OAuth state' }, 400);
    oauthStore.delete(state);
    try {
      const github = new GitHub(config.githubClientId, config.githubClientSecret,
        `${config.baseUrl}/api/auth/oauth/github/callback`);
      const tokens = await github.validateAuthorizationCode(code);
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}`, 'User-Agent': 'study-app' },
      });
      const emails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[];
      const primary = emails.find((e) => e.primary && e.verified);
      if (!primary) return c.json({ error: 'No verified email on GitHub account' }, 400);
      const ghRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}`, 'User-Agent': 'study-app' },
      });
      const ghUser = await ghRes.json() as { id: number };
      const user = await upsertOAuthUser(db, 'github', String(ghUser.id), primary.email);
      const accessToken = await signAccessToken(user.id, user.email);
      const refreshId = createSession(user.id, db);
      setCookie(c, 'access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 });
      setCookie(c, 'refresh_token', refreshId, { ...COOKIE_OPTS, maxAge: 30 * 86400 });
      return c.redirect('/');
    } catch { return c.json({ error: 'OAuth failed' }, 400); }
  });

  // Password change — requires auth, revokes all sessions
  router.post('/change-password', requireAuth, async (c) => {
    const userId = c.get('user').id;
    const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>();
    if (!currentPassword || !newPassword) return c.json({ error: 'currentPassword and newPassword required' }, 400);
    if (newPassword.length < 8) return c.json({ error: 'New password must be at least 8 characters' }, 400);

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string | null } | undefined;
    if (!user?.password_hash) return c.json({ error: 'No password set on this account', code: 'NO_PASSWORD' }, 400);
    if (!(await bcrypt.compare(currentPassword, user.password_hash)))
      return c.json({ error: 'Current password incorrect' }, 401);

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(userId);
    setCookie(c, 'access_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    setCookie(c, 'refresh_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    return c.json({ ok: true });
  });

  return router;
}
