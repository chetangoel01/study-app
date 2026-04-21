import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeAvailabilityRouter } from './availability.js';
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
  // Auth signup does not accept fullName; patch it in for tests that check names.
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName, row.id);
  return { cookie, id: row.id };
}

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/practice/mock-interviews', makeMockInterviewsRouter(db));
  app.route('/api/practice/availability', makeAvailabilityRouter(db));
  const a = await signup('a@x.com', 'password123', 'Alice Adams');
  const b = await signup('b@x.com', 'password123', 'Bob Brown');
  userAId = a.id; userBId = b.id; cookieA = a.cookie; cookieB = b.cookie;
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'either')`).run(userAId);
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'interviewee')`).run(userBId);
});

describe('POST /api/practice/availability', () => {
  it('creates proposal + N blocks', async () => {
    const res = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        durationMinutes: 45,
        topic: 'DSA',
        notes: '',
        rolePreference: 'either',
        blocks: [
          { startsAt: '2026-05-01T14:00:00Z' },
          { startsAt: '2026-05-02T15:00:00Z' },
          { startsAt: '2026-05-03T16:00:00Z' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.proposalId).toBeTruthy();

    const blocks = db.prepare('SELECT * FROM availability_blocks WHERE proposal_id = ?').all(Number(body.proposalId));
    expect(blocks).toHaveLength(3);
  });

  it('rejects overlapping blocks within duration', async () => {
    const res = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        durationMinutes: 60,
        rolePreference: 'either',
        blocks: [
          { startsAt: '2026-05-01T14:00:00Z' },
          { startsAt: '2026-05-01T14:30:00Z' },
        ],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as any).error).toBe('blocks_overlap');
  });

  it('rejects empty or >8 blocks', async () => {
    const empty = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ durationMinutes: 45, rolePreference: 'either', blocks: [] }),
    });
    expect(empty.status).toBe(400);

    const tooMany = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        durationMinutes: 45,
        rolePreference: 'either',
        blocks: Array.from({ length: 9 }, (_, i) => ({
          startsAt: `2026-05-${String(i + 1).padStart(2, '0')}T14:00:00Z`,
        })),
      }),
    });
    expect(tooMany.status).toBe(400);
  });
});

describe('GET /api/practice/availability/mine', () => {
  it('returns proposals with nested blocks', async () => {
    const proposal = db.prepare(`
      INSERT INTO availability_proposals (user_id, duration_minutes, topic, role_preference)
      VALUES (?, 45, 'DSA', 'either')
    `).run(userAId);
    const proposalId = Number(proposal.lastInsertRowid);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-01T14:00:00Z', 'open')`).run(proposalId);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-02T15:00:00Z', 'open')`).run(proposalId);

    const res = await app.request('/api/practice/availability/mine', { headers: { Cookie: cookieA } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].blocks).toHaveLength(2);
  });
});

describe('DELETE /api/practice/availability/blocks/:id and /:proposalId', () => {
  it('cancels a single open block', async () => {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id) VALUES (?)`).run(userAId);
    const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-01T14:00:00Z', 'open')`).run(Number(p.lastInsertRowid));
    const id = Number(b.lastInsertRowid);

    const res = await app.request(`/api/practice/availability/blocks/${id}`, {
      method: 'DELETE', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT status FROM availability_blocks WHERE id = ?').get(id) as any;
    expect(row.status).toBe('cancelled');
  });

  it('cancel block: 422 if already claimed', async () => {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id) VALUES (?)`).run(userAId);
    const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status, claimed_by) VALUES (?, '2026-05-01T14:00:00Z', 'claimed', ?)`).run(Number(p.lastInsertRowid), userBId);
    const res = await app.request(`/api/practice/availability/blocks/${Number(b.lastInsertRowid)}`, {
      method: 'DELETE', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(422);
  });

  it('cancel proposal: cancels open blocks, leaves claimed blocks alone', async () => {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id) VALUES (?)`).run(userAId);
    const proposalId = Number(p.lastInsertRowid);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-01T14:00:00Z', 'open')`).run(proposalId);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status, claimed_by) VALUES (?, '2026-05-02T14:00:00Z', 'claimed', ?)`).run(proposalId, userBId);

    const res = await app.request(`/api/practice/availability/${proposalId}`, {
      method: 'DELETE', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(200);
    const rows = db.prepare('SELECT status FROM availability_blocks WHERE proposal_id = ? ORDER BY id').all(proposalId) as any[];
    expect(rows[0].status).toBe('cancelled');
    expect(rows[1].status).toBe('claimed');
  });
});

describe('GET /api/practice/availability/feed', () => {
  async function seedProposal(userId: number, role: string, blocks: string[]): Promise<number[]> {
    const info = db.prepare(`
      INSERT INTO availability_proposals (user_id, duration_minutes, topic, role_preference)
      VALUES (?, 45, 'DSA', ?)
    `).run(userId, role);
    const proposalId = Number(info.lastInsertRowid);
    const ids: number[] = [];
    for (const startsAt of blocks) {
      const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at) VALUES (?, ?)`).run(proposalId, startsAt);
      ids.push(Number(b.lastInsertRowid));
    }
    return ids;
  }

  it('returns blocks from other users only', async () => {
    await seedProposal(userAId, 'either', ['2026-05-01T10:00:00Z']); // caller's own
    await seedProposal(userBId, 'interviewee', ['2026-05-01T11:00:00Z']);
    const res = await app.request('/api/practice/availability/feed', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].postedBy.id).toBe(String(userBId));
  });

  it('filters by role=interviewee includes interviewee + either', async () => {
    await seedProposal(userBId, 'interviewee', ['2026-05-01T10:00:00Z']);
    await seedProposal(userBId, 'interviewer', ['2026-05-02T10:00:00Z']);
    await seedProposal(userBId, 'either', ['2026-05-03T10:00:00Z']);
    const res = await app.request('/api/practice/availability/feed?role=interviewee', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(2);
    expect(body.map((b) => b.rolePreference).sort()).toEqual(['either', 'interviewee']);
  });

  it('excludes blocks that overlap caller accepted invites', async () => {
    await seedProposal(userBId, 'interviewee', ['2026-05-01T10:00:00Z', '2026-05-01T14:00:00Z']);
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-05-01T10:15:00Z', 60)
    `).run(userAId, userBId);
    const res = await app.request('/api/practice/availability/feed', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].startsAt).toBe('2026-05-01T14:00:00Z');
  });
});
