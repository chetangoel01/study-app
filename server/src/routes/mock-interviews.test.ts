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

describe('GET /api/practice/mock-interviews/:id', () => {
  it('returns detail with ordered event timeline when caller is a party', async () => {
    const info = db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
      VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45, 'DSA', 'interviewee')
    `).run(userAId, userBId);
    const inviteId = Number(info.lastInsertRowid);
    db.prepare(`INSERT INTO mock_interview_events (invite_id, actor_id, event_type, payload, created_at) VALUES (?, ?, 'created', NULL, '2026-04-20T10:00:00Z')`).run(inviteId, userAId);
    db.prepare(`INSERT INTO mock_interview_events (invite_id, actor_id, event_type, payload, created_at) VALUES (?, ?, 'rescheduled', '{"from":"X","to":"Y"}', '2026-04-20T11:00:00Z')`).run(inviteId, userAId);

    const res = await app.request(`/api/practice/mock-interviews/${inviteId}`, { headers: { Cookie: cookieA } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(String(inviteId));
    expect(body.events).toHaveLength(2);
    expect(body.events[0].eventType).toBe('created');
    expect(body.events[1].eventType).toBe('rescheduled');
    expect(body.events[1].payload).toEqual({ from: 'X', to: 'Y' });
  });

  it('returns 403 when caller is not a party', async () => {
    const c = await signup('c@x.com', 'password123', 'Carol Curry');
    db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(c.id);
    const info = db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45)
    `).run(userAId, userBId);
    const inviteId = Number(info.lastInsertRowid);

    const res = await app.request(`/api/practice/mock-interviews/${inviteId}`, { headers: { Cookie: c.cookie } });
    expect(res.status).toBe(403);
  });

  it('returns 404 when invite does not exist', async () => {
    const res = await app.request('/api/practice/mock-interviews/999999', { headers: { Cookie: cookieA } });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/practice/mock-interviews/schedule', () => {
  it('creates invite with created event', async () => {
    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        peerId: String(userBId),
        scheduledFor: '2026-05-01T14:00:00Z',
        durationMinutes: 60,
        topic: 'System Design',
        rolePreference: 'interviewer', // A interviews, B is interviewee (compatible with B default 'interviewee')
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();

    const invite = db.prepare('SELECT * FROM mock_interviews WHERE id = ?').get(Number(body.id)) as any;
    expect(invite.initiator_id).toBe(userAId);
    expect(invite.peer_id).toBe(userBId);
    expect(invite.role_preference).toBe('interviewer');
    expect(invite.duration_minutes).toBe(60);

    const events = db.prepare('SELECT * FROM mock_interview_events WHERE invite_id = ?').all(Number(body.id)) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('created');
    expect(events[0].actor_id).toBe(userAId);
  });

  it('returns 409 on role incompatibility', async () => {
    // B default is 'interviewee'; A requests 'interviewee' too → incompatible.
    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        peerId: String(userBId),
        scheduledFor: '2026-05-01T14:00:00Z',
        durationMinutes: 45,
        rolePreference: 'interviewee',
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toBe('role_incompatible');
  });

  it('returns 409 on overlap with existing accepted invite', async () => {
    // Pre-seed an accepted invite for user A.
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run(userAId, userBId);

    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        peerId: String(userBId),
        scheduledFor: '2026-05-01T14:30:00Z',
        durationMinutes: 45,
        rolePreference: 'interviewer',
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toBe('overlap');
    expect(body.context.conflictingInviteId).toBeTruthy();
  });

  it('rejects invalid body', async () => {
    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ peerId: String(userBId) }),
    });
    expect(res.status).toBe(400);
  });
});
