import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { applySchema } from '../db/schema.js';
import { makeScheduleRouter } from './schedule.js';
import { signAccessToken } from '../lib/jwt.js';

async function authHeader(userId: number, email: string): Promise<string> {
  const token = await signAccessToken(userId, email);
  return `access_token=${token}`;
}

function makeApp(db: Database.Database): Hono {
  const app = new Hono();
  app.route('/api/schedule', makeScheduleRouter(db));
  return app;
}

function makeUser(db: Database.Database, email: string, fullName = 'U'): number {
  const info = db.prepare('INSERT INTO users (email, full_name) VALUES (?, ?)').run(email, fullName);
  return Number(info.lastInsertRowid);
}

function makeInvite(
  db: Database.Database,
  initiator: number,
  peer: number,
  scheduledFor: string,
  status: string,
  topic = 'System design',
): number {
  const info = db.prepare(`
    INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
    VALUES (?, ?, ?, ?, 45, ?, 'either')
  `).run(initiator, peer, status, scheduledFor, topic);
  return Number(info.lastInsertRowid);
}

describe('GET /api/schedule', () => {
  let db: Database.Database;
  let u1: number;
  let u2: number;
  let u3: number;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    u1 = makeUser(db, 'a@b.c', 'Alice');
    u2 = makeUser(db, 'c@d.e', 'Bob');
    u3 = makeUser(db, 'e@f.g', 'Carol');
  });

  it('requires auth', async () => {
    const res = await makeApp(db).request('/api/schedule');
    expect(res.status).toBe(401);
  });

  it('excludes cancelled and declined invites', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, future, 'accepted');
    makeInvite(db, u1, u2, future, 'cancelled');
    makeInvite(db, u1, u2, future, 'declined');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].status).toBe('accepted');
  });

  it('includes pending_acceptance and accepted invites, both directions', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, future, 'pending_acceptance');
    makeInvite(db, u2, u1, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(2);
    const directions = body.invites.map((i: any) => i.direction).sort();
    expect(directions).toEqual(['received', 'sent']);
  });

  it('does not leak invites where caller is not a party', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u2, u3, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(0);
  });

  it('excludes past events by default', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, past, 'accepted');
    makeInvite(db, u1, u2, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].scheduledFor).toBe(future);
  });

  it('includes past events when includePast=true', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, past, 'accepted');
    makeInvite(db, u1, u2, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule?includePast=true', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(2);
  });

  it('returns events in ascending time order', async () => {
    const t1 = new Date(Date.now() + 86400_000).toISOString();
    const t2 = new Date(Date.now() + 2 * 86400_000).toISOString();
    makeInvite(db, u1, u2, t2, 'accepted');
    makeInvite(db, u1, u2, t1, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites.map((i: any) => i.scheduledFor)).toEqual([t1, t2]);
  });
});

describe('GET /api/schedule/ics/:id', () => {
  let db: Database.Database;
  let u1: number;
  let u2: number;
  let u3: number;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    u1 = makeUser(db, 'a@b.c', 'Alice');
    u2 = makeUser(db, 'c@d.e', 'Bob');
    u3 = makeUser(db, 'e@f.g', 'Carol');
  });

  it('returns 404 for a missing invite', async () => {
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule/ics/999', { headers: { cookie } });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not a party', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const id = makeInvite(db, u2, u3, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request(`/api/schedule/ics/${id}`, { headers: { cookie } });
    expect(res.status).toBe(403);
  });

  it('returns 422 when invite is not accepted', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const id = makeInvite(db, u1, u2, future, 'pending_acceptance');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request(`/api/schedule/ics/${id}`, { headers: { cookie } });
    expect(res.status).toBe(422);
  });

  it('returns a valid ICS body with correct headers on accepted invite', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const id = makeInvite(db, u1, u2, future, 'accepted', 'System design');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request(`/api/schedule/ics/${id}`, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    expect(res.headers.get('content-disposition')).toContain(`filename="mock-interview-${id}.ics"`);
    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain(`UID:mock-invite-${id}@`);
    expect(body).toContain('SUMMARY:Mock interview with Bob');
    expect(body).toContain('System design');
  });
});
