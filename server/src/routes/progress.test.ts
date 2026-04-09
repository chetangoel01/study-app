import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeProgressRouter } from './progress.js';
import type { CurriculumIndex } from '../curriculum/types.js';

const bigOModule = {
  id: 'big-o',
  title: 'Big-O',
  track: 'dsa-leetcode' as const,
  phase: 'Core Track',
  summary: '',
  estimate: '',
  sessions: 0,
  countsTowardSchedule: true,
  sourceUrl: '',
  prerequisiteModuleIds: [] as string[],
  items: [{ id: 'big-o:read:0', type: 'read' as const, label: 'Read X', url: 'https://x.com' }],
};

const plainModule = {
  ...bigOModule,
  id: 'plain',
  items: [{ id: 'plain:read:0', type: 'read' as const, label: 'Read', url: 'https://x.com' }],
};

const mockIndex: CurriculumIndex = {
  tracks: [],
  modules: [bigOModule, plainModule],
  moduleById: new Map([
    ['big-o', bigOModule],
    ['plain', plainModule],
  ]),
  modulesByTrack: new Map(),
  topicsByModule: new Map([
    ['big-o', [{ id: 't1', planning_topic_id: 'p1', label: 'Topic', module_ids: ['big-o'] }]],
  ]),
  allTopics: [],
};

let db: Database.Database;
let app: Hono;
let cookie: string;

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/progress', makeProgressRouter(db, mockIndex));
  await app.request('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'p@x.com', password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'p@x.com', password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  cookie = match ? `access_token=${match[1]}` : '';
});
afterEach(() => db.close());

it('GET returns empty array initially', async () => {
  const res = await app.request('/api/progress', { headers: { Cookie: cookie } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([]);
});

it('PUT marks item complete, second call toggles back', async () => {
  const url = '/api/progress/big-o/big-o:read:0?itemType=read';
  const first = await app.request(url, { method: 'PUT', headers: { Cookie: cookie } });
  expect((await first.json()).completed).toBe(true);
  const second = await app.request(url, { method: 'PUT', headers: { Cookie: cookie } });
  expect((await second.json()).completed).toBe(false);
});

it('PUT guide-step records furthest section index', async () => {
  const res = await app.request('/api/progress/big-o/guide-step', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 0 }),
  });
  expect(res.status).toBe(200);
});

it('PUT guide-step rejects out-of-range step', async () => {
  const res = await app.request('/api/progress/big-o/guide-step', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 99 }),
  });
  expect(res.status).toBe(400);
});

it('PUT guide-step returns 400 when module has no guide topics', async () => {
  const res = await app.request('/api/progress/plain/guide-step', {
    method: 'PUT',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 0 }),
  });
  expect(res.status).toBe(400);
});
