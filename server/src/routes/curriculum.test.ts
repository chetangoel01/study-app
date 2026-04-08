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
writeFileSync(resolve(dir, 'kb.json'), JSON.stringify({ version: '3', planning_topics: [] }));

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

describe('GET /api/module/:id/content', () => {
  it('returns topics and items', async () => {
    const res = await app.request('/api/module/big-o/content', { headers: { Cookie: accessCookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(Array.isArray(body.topics)).toBe(true);
  });

  it('returns 404 for unknown module', async () => {
    const res = await app.request('/api/module/no-such/content', { headers: { Cookie: accessCookie } });
    expect(res.status).toBe(404);
  });
});
