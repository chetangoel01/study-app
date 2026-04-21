import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeMockInterviewsRouter } from './mock-interviews.js';

let db: Database.Database;
let app: Hono;
let cookieA: string;
let cookieB: string;
let userAId: number;
let userBId: number;

async function signup(email: string, password: string, fullName: string): Promise<{ cookie: string; id: number }> {
  await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  const cookie = match ? `access_token=${match[1]}` : '';
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number };
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName, row.id);
  return { cookie, id: row.id };
}

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/practice/mock-interviews', makeMockInterviewsRouter(db));

  const a = await signup('a@x.com', 'password123', 'Alice Adams');
  const b = await signup('b@x.com', 'password123', 'Bob Brown');
  userAId = a.id;
  userBId = b.id;
  cookieA = a.cookie;
  cookieB = b.cookie;

  // Both users allow mock interviews.
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'either')`).run(userAId);
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'interviewee')`).run(userBId);
});

describe('GET /api/practice/mock-interviews/peers', () => {
  it('lists other opted-in users with default_role_preference', async () => {
    const res = await app.request('/api/practice/mock-interviews/peers', {
      headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: String(userBId),
      fullName: 'Bob Brown',
      defaultRolePreference: 'interviewee',
    });
    expect(body[0].initials).toBe('BB');
  });

  it('excludes caller', async () => {
    const res = await app.request('/api/practice/mock-interviews/peers', {
      headers: { Cookie: cookieA },
    });
    const body = await res.json() as any[];
    expect(body.some((p) => p.id === String(userAId))).toBe(false);
  });
});

describe('GET /api/practice/mock-interviews', () => {
  it('returns empty list when no invites', async () => {
    const res = await app.request('/api/practice/mock-interviews', { headers: { Cookie: cookieA } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('filters by direction', async () => {
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
      VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45, 'DSA', 'interviewee')
    `).run(userAId, userBId);

    const sent = await app.request('/api/practice/mock-interviews?direction=sent', { headers: { Cookie: cookieA } });
    expect((await sent.json() as any[])).toHaveLength(1);
    const received = await app.request('/api/practice/mock-interviews?direction=received', { headers: { Cookie: cookieA } });
    expect((await received.json() as any[])).toHaveLength(0);
  });

  it('filters by status csv', async () => {
    db.prepare(`INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes) VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45)`).run(userAId, userBId);
    db.prepare(`INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes) VALUES (?, ?, 'declined', '2026-05-02T14:00:00Z', 45)`).run(userAId, userBId);

    const res = await app.request('/api/practice/mock-interviews?status=pending_acceptance', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('pending_acceptance');
  });
});
