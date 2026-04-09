import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

interface ProfileRow {
  id: number;
  email: string;
  full_name: string | null;
  bio: string | null;
}

interface PreferencesRow {
  theme: string | null;
  notify_daily_challenge: number | null;
  notify_weekly_progress: number | null;
  notify_community: number | null;
  dashboard_density: string | null;
  allow_mock_interviews: number | null;
}

function readPreferences(db: Database.Database, userId: number) {
  const row = db.prepare(
    `SELECT theme, notify_daily_challenge, notify_weekly_progress, notify_community, dashboard_density, allow_mock_interviews
      FROM user_preferences
      WHERE user_id = ?`
  ).get(userId) as PreferencesRow | undefined;

  return {
    theme: row?.theme === 'dark' ? 'dark' : 'light',
    notifyDailyChallenge: Boolean(row?.notify_daily_challenge ?? 1),
    notifyWeeklyProgress: Boolean(row?.notify_weekly_progress ?? 1),
    notifyCommunity: Boolean(row?.notify_community ?? 0),
    dashboardDensity: row?.dashboard_density === 'dense' ? 'dense' : 'expansive',
    allowMockInterviews: Boolean(row?.allow_mock_interviews ?? 0),
  };
}

export function makeUserRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/profile', (c) => {
    const user = c.get('user');
    const row = db.prepare(
      'SELECT id, email, full_name, bio FROM users WHERE id = ?'
    ).get(user.id) as ProfileRow | undefined;

    if (!row) return c.json({ error: 'Not found' }, 404);

    return c.json({
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? '',
      bio: row.bio ?? '',
    });
  });

  router.put('/profile', async (c) => {
    const user = c.get('user');
    const body: { fullName?: string; bio?: string } = await c.req
      .json<{ fullName?: string; bio?: string }>()
      .catch(() => ({}));
    const current = db.prepare(
      'SELECT id, email, full_name, bio FROM users WHERE id = ?'
    ).get(user.id) as ProfileRow | undefined;

    if (!current) return c.json({ error: 'Not found' }, 404);

    const fullName = typeof body.fullName === 'string'
      ? body.fullName.slice(0, 100)
      : (current.full_name ?? '');
    const bio = typeof body.bio === 'string'
      ? body.bio.slice(0, 500)
      : (current.bio ?? '');

    db.prepare('UPDATE users SET full_name = ?, bio = ? WHERE id = ?').run(fullName, bio, user.id);

    return c.json({
      id: current.id,
      email: current.email,
      fullName,
      bio,
    });
  });

  router.get('/preferences', (c) => {
    const user = c.get('user');
    return c.json(readPreferences(db, user.id));
  });

  router.put('/preferences', async (c) => {
    const user = c.get('user');
    const body: {
      theme?: string;
      notifyDailyChallenge?: boolean;
      notifyWeeklyProgress?: boolean;
      notifyCommunity?: boolean;
      dashboardDensity?: string;
      allowMockInterviews?: boolean;
    } = await c.req.json<{
      theme?: string;
      notifyDailyChallenge?: boolean;
      notifyWeeklyProgress?: boolean;
      notifyCommunity?: boolean;
      dashboardDensity?: string;
      allowMockInterviews?: boolean;
    }>().catch(() => ({}));
    const current = readPreferences(db, user.id);
    const next = {
      theme: body.theme === 'dark' || body.theme === 'light' ? body.theme : current.theme,
      notifyDailyChallenge: body.notifyDailyChallenge ?? current.notifyDailyChallenge,
      notifyWeeklyProgress: body.notifyWeeklyProgress ?? current.notifyWeeklyProgress,
      notifyCommunity: body.notifyCommunity ?? current.notifyCommunity,
      dashboardDensity:
        body.dashboardDensity === 'dense' || body.dashboardDensity === 'expansive'
          ? body.dashboardDensity
          : current.dashboardDensity,
      allowMockInterviews: body.allowMockInterviews ?? current.allowMockInterviews,
    };

    db.prepare(`
      INSERT INTO user_preferences
        (user_id, theme, notify_daily_challenge, notify_weekly_progress, notify_community, dashboard_density, allow_mock_interviews)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        notify_daily_challenge = excluded.notify_daily_challenge,
        notify_weekly_progress = excluded.notify_weekly_progress,
        notify_community = excluded.notify_community,
        dashboard_density = excluded.dashboard_density,
        allow_mock_interviews = excluded.allow_mock_interviews,
        updated_at = datetime('now')
    `).run(
      user.id,
      next.theme,
      next.notifyDailyChallenge ? 1 : 0,
      next.notifyWeeklyProgress ? 1 : 0,
      next.notifyCommunity ? 1 : 0,
      next.dashboardDensity,
      next.allowMockInterviews ? 1 : 0
    );

    return c.json(next);
  });

  router.get('/oauth-connections', (c) => {
    const user = c.get('user');
    const rows = db.prepare(
      'SELECT provider FROM oauth_accounts WHERE user_id = ?'
    ).all(user.id) as { provider: string }[];
    const connected = new Set(rows.map((row) => row.provider));
    return c.json({
      google: connected.has('google'),
      github: connected.has('github'),
    });
  });

  router.delete('/oauth-connections/:provider', (c) => {
    const user = c.get('user');
    const provider = c.req.param('provider');

    if (provider !== 'google' && provider !== 'github') {
      return c.json({ error: 'Invalid provider' }, 400);
    }

    const linkedCountRow = db.prepare(
      'SELECT COUNT(*) as count FROM oauth_accounts WHERE user_id = ?'
    ).get(user.id) as { count: number };
    const hasLink = db.prepare(
      'SELECT 1 FROM oauth_accounts WHERE user_id = ? AND provider = ?'
    ).get(user.id, provider) as { 1: number } | undefined;
    const userRow = db.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).get(user.id) as { password_hash: string | null } | undefined;

    if (!hasLink) {
      return c.json({ ok: true });
    }

    if (!userRow?.password_hash && linkedCountRow.count <= 1) {
      return c.json({ error: 'Cannot remove the only login method. Set a password first.' }, 409);
    }

    db.prepare('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?').run(user.id, provider);
    return c.json({ ok: true });
  });

  router.delete('/account', (c) => {
    const user = c.get('user');

    db.transaction((userId: number) => {
      db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM oauth_accounts WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    })(user.id);

    setCookie(c, 'access_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    setCookie(c, 'refresh_token', '', { ...COOKIE_OPTS, maxAge: 0 });
    return c.json({ ok: true });
  });

  return router;
}
