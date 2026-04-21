import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { applySchema } from '../db/schema.js';
import { signAccessToken } from '../lib/jwt.js';
import { makeUserRouter } from './user.js';

function setup() {
  const db = new Database(':memory:');
  applySchema(db);
  const app = new Hono();
  app.route('/api/user', makeUserRouter(db));
  return { db, app };
}

async function authCookie(userId: number, email: string) {
  return `access_token=${await signAccessToken(userId, email)}`;
}

afterEach(() => {
  // Individual tests own their db handle and close it explicitly.
});

describe('GET /api/user/profile', () => {
  it('returns user profile fields', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email, full_name, bio) VALUES ('a@b.com', 'Alex', 'Dev') RETURNING id"
    ).get() as { id: number };

    const res = await app.request('/api/user/profile', {
      headers: { Cookie: await authCookie(row.id, 'a@b.com') },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { fullName: string; bio: string };
    expect(body.fullName).toBe('Alex');
    expect(body.bio).toBe('Dev');
    db.close();
  });
});

describe('PUT /api/user/profile', () => {
  it('updates profile fields and returns them', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email) VALUES ('a@b.com') RETURNING id"
    ).get() as { id: number };

    const res = await app.request('/api/user/profile', {
      method: 'PUT',
      headers: {
        Cookie: await authCookie(row.id, 'a@b.com'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ fullName: 'Alex Rivera', bio: 'Engineer' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { fullName: string };
    expect(body.fullName).toBe('Alex Rivera');
    db.close();
  });
});

describe('PUT then GET /api/user/preferences', () => {
  it('stores and retrieves preferences', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email) VALUES ('a@b.com') RETURNING id"
    ).get() as { id: number };

    await app.request('/api/user/preferences', {
      method: 'PUT',
      headers: {
        Cookie: await authCookie(row.id, 'a@b.com'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ theme: 'dark', notifyDailyChallenge: false }),
    });

    const res = await app.request('/api/user/preferences', {
      headers: { Cookie: await authCookie(row.id, 'a@b.com') },
    });

    const body = await res.json() as { theme: string; notifyDailyChallenge: boolean; dashboardDensity: string };
    expect(body.theme).toBe('dark');
    expect(body.notifyDailyChallenge).toBe(false);
    expect(body.dashboardDensity).toBe('expansive');
    db.close();
  });

  it('stores and returns dashboard layout density', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email) VALUES ('a@b.com') RETURNING id"
    ).get() as { id: number };

    await app.request('/api/user/preferences', {
      method: 'PUT',
      headers: {
        Cookie: await authCookie(row.id, 'a@b.com'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ dashboardDensity: 'dense' }),
    });

    const res = await app.request('/api/user/preferences', {
      headers: { Cookie: await authCookie(row.id, 'a@b.com') },
    });

    const body = await res.json() as { dashboardDensity: string };
    expect(body.dashboardDensity).toBe('dense');
    db.close();
  });
});

describe('GET /api/user/oauth-connections', () => {
  it('returns linked provider flags', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email) VALUES ('a@b.com') RETURNING id"
    ).get() as { id: number };
    db.prepare(
      "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES (?, 'google', 'abc')"
    ).run(row.id);

    const res = await app.request('/api/user/oauth-connections', {
      headers: { Cookie: await authCookie(row.id, 'a@b.com') },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { google: boolean; github: boolean };
    expect(body.google).toBe(true);
    expect(body.github).toBe(false);
    db.close();
  });
});

describe('defaultRolePreference preference', () => {
  it('round-trips defaultRolePreference', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email) VALUES ('a@b.com') RETURNING id"
    ).get() as { id: number };
    const cookie = await authCookie(row.id, 'a@b.com');

    const put = await app.request('/api/user/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ defaultRolePreference: 'interviewer' }),
    });
    expect(put.status).toBe(200);

    const get = await app.request('/api/user/preferences', { headers: { Cookie: cookie } });
    const body = await get.json() as any;
    expect(body.defaultRolePreference).toBe('interviewer');
    db.close();
  });

  it('rejects invalid defaultRolePreference', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email) VALUES ('a@b.com') RETURNING id"
    ).get() as { id: number };
    const cookie = await authCookie(row.id, 'a@b.com');

    const put = await app.request('/api/user/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ defaultRolePreference: 'bogus' }),
    });
    expect(put.status).toBe(400);
    db.close();
  });
});

describe('DELETE /api/user/account', () => {
  it('deletes the user row', async () => {
    const { db, app } = setup();
    const row = db.prepare(
      "INSERT INTO users (email, password_hash) VALUES ('a@b.com', 'hash') RETURNING id"
    ).get() as { id: number };

    const res = await app.request('/api/user/account', {
      method: 'DELETE',
      headers: { Cookie: await authCookie(row.id, 'a@b.com') },
    });

    expect(res.status).toBe(200);
    const gone = db.prepare('SELECT id FROM users WHERE id = ?').get(row.id);
    expect(gone).toBeUndefined();
    db.close();
  });
});
