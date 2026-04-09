import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { applySchema } from '../db/schema.js';
import { loadCurriculum } from '../curriculum/loader.js';
import { makeAuthRouter } from './auth.js';
import { makeCurriculumRouter } from './curriculum.js';

const dir = resolve(tmpdir(), 'study-curriculum-route-test');
mkdirSync(dir, { recursive: true });

const CURRICULUM = {
  version: 1, generated_at: '2026-01-01T00:00:00Z',
  tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
  modules: [{
    id: 'big-o', title: 'Big-O', track: 'dsa-leetcode', phase: 'Core Track',
    summary: 'Complexity', estimate: '2 sessions', sessions: 2,
    countsTowardSchedule: true, sourceUrl: 'https://x.com',
    items: [{ id: 'big-o:read:0', type: 'read', label: 'Read X', url: 'https://x.com' }],
    prerequisiteModuleIds: [],
  }],
};
writeFileSync(resolve(dir, 'curriculum.json'), JSON.stringify(CURRICULUM));
writeFileSync(resolve(dir, 'kb.json'), JSON.stringify({
  version: '3',
  planning_topics: [{
    id: 'planning:complexity',
    planning_topic_id: 'complexity',
    label: 'Big-O Notation',
    module_ids: ['big-o'],
    study_guide_markdown: '',
  }],
  topics: [{
    id: 'topic:big-o',
    planning_topic_id: 'complexity',
    label: 'Big-O Notation',
    module_ids: ['big-o'],
    study_guide_markdown: '## Big-O\nO(n) means linear time.',
  }],
}));

const curriculumIndex = loadCurriculum({
  curriculumPath: resolve(dir, 'curriculum.json'),
  knowledgeBasePath: resolve(dir, 'kb.json'),
});

let db: Database.Database;
let app: Hono;
let accessCookie: string;

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api', makeCurriculumRouter(db, curriculumIndex));

  await app.request('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'u@x.com', password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'u@x.com', password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  accessCookie = match ? `access_token=${match[1]}` : '';
});
afterEach(() => db.close());

describe('GET /api/curriculum', () => {
  it('requires auth', async () => {
    expect((await app.request('/api/curriculum')).status).toBe(401);
  });

  it('returns tracks, modules with status, no study_guide_markdown', async () => {
    const res = await app.request('/api/curriculum', { headers: { Cookie: accessCookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tracks).toHaveLength(1);
    expect(body.modules[0].status).toBe('available');
    expect(body.modules[0]).not.toHaveProperty('study_guide_markdown');
  });
});

describe('computeStatus with prerequisites', () => {
  const prereqDir = resolve(tmpdir(), 'study-curriculum-prereq-test');
  mkdirSync(prereqDir, { recursive: true });

  const PREREQ_CURRICULUM = {
    version: 1, generated_at: '2026-01-01T00:00:00Z',
    tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
    modules: [
      {
        id: 'mod-a', title: 'Module A', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'A', estimate: '1 session', sessions: 1,
        countsTowardSchedule: true, sourceUrl: 'https://x.com',
        items: [{ id: 'mod-a:read:0', type: 'read', label: 'Read A', url: 'https://x.com' }],
        prerequisiteModuleIds: [],
      },
      {
        id: 'mod-b', title: 'Module B', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'B', estimate: '1 session', sessions: 1,
        countsTowardSchedule: true, sourceUrl: 'https://x.com',
        items: [{ id: 'mod-b:read:0', type: 'read', label: 'Read B', url: 'https://x.com' }],
        prerequisiteModuleIds: ['mod-a'],
      },
      {
        id: 'zero-item-mod', title: 'Zero Items', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'Z', estimate: '0 sessions', sessions: 0,
        countsTowardSchedule: false, sourceUrl: 'https://x.com',
        items: [],
        prerequisiteModuleIds: [],
      },
      {
        id: 'mod-c', title: 'Module C', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'C', estimate: '1 session', sessions: 1,
        countsTowardSchedule: true, sourceUrl: 'https://x.com',
        items: [{ id: 'mod-c:read:0', type: 'read', label: 'Read C', url: 'https://x.com' }],
        prerequisiteModuleIds: ['zero-item-mod'],
      },
    ],
  };

  writeFileSync(resolve(prereqDir, 'curriculum.json'), JSON.stringify(PREREQ_CURRICULUM));
  writeFileSync(resolve(prereqDir, 'kb.json'), JSON.stringify({ version: '3', planning_topics: [] }));

  const prereqIndex = loadCurriculum({
    curriculumPath: resolve(prereqDir, 'curriculum.json'),
    knowledgeBasePath: resolve(prereqDir, 'kb.json'),
  });

  let db2: Database.Database;
  let app2: Hono;
  let cookie2: string;

  beforeEach(async () => {
    db2 = new Database(':memory:');
    applySchema(db2);
    app2 = new Hono();
    app2.route('/api/auth', makeAuthRouter(db2));
    app2.route('/api', makeCurriculumRouter(db2, prereqIndex));

    await app2.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u2@x.com', password: 'password123' }),
    });
    const res = await app2.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'u2@x.com', password: 'password123' }),
    });
    const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
    cookie2 = match ? `access_token=${match[1]}` : '';
  });
  afterEach(() => db2.close());

  it('keeps module available and surfaces unmet prerequisites as advisory context', async () => {
    const res = await app2.request('/api/curriculum', { headers: { Cookie: cookie2 } });
    const body = await res.json() as { modules: { id: string; status: string; blockedBy: string[] }[] };
    const modB = body.modules.find((m) => m.id === 'mod-b')!;
    expect(modB.status).toBe('available');
    expect(modB.blockedBy).toContain('mod-a');
  });

  it('marks module available when prereq is complete', async () => {
    const { id: userId } = db2.prepare('SELECT id FROM users WHERE email = ?').get('u2@x.com') as { id: number };
    db2.prepare('INSERT INTO progress (user_id, module_id, item_id, item_type, completed) VALUES (?, ?, ?, ?, 1)')
      .run(userId, 'mod-a', 'mod-a:read:0', 'read');

    const res = await app2.request('/api/curriculum', { headers: { Cookie: cookie2 } });
    const body = await res.json() as { modules: { id: string; status: string }[] };
    const modB = body.modules.find((m) => m.id === 'mod-b')!;
    expect(modB.status).toBe('available');
  });

  it('treats zero-item prereq as satisfied (no advisory blocker)', async () => {
    const res = await app2.request('/api/curriculum', { headers: { Cookie: cookie2 } });
    const body = await res.json() as { modules: { id: string; status: string; blockedBy: string[] }[] };
    const modC = body.modules.find((m) => m.id === 'mod-c')!;
    expect(modC.status).toBe('available');
    expect(modC.blockedBy).toEqual([]);
  });
});

describe('GET /api/module/:id/content', () => {
  it('returns topics and items', async () => {
    const res = await app.request('/api/module/big-o/content', { headers: { Cookie: accessCookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(Array.isArray(body.topics)).toBe(true);
    expect(body.topics[0].study_guide_markdown).toContain('O(n)');
  });

  it('returns 404 for unknown module', async () => {
    const res = await app.request('/api/module/no-such/content', { headers: { Cookie: accessCookie } });
    expect(res.status).toBe(404);
  });
});
