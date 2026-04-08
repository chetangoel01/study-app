import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeProxyRouter } from './proxy.js';

let db: Database.Database;
let app: Hono;
let cookie: string;

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/proxy', makeProxyRouter());
  await app.request('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pr@x.com', password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pr@x.com', password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  cookie = match ? `access_token=${match[1]}` : '';
});
afterEach(() => db.close());

it('returns 403 for disallowed URL', async () => {
  const res = await app.request(
    `/api/proxy?url=${encodeURIComponent('https://evil.example.com/page')}`,
    { headers: { Cookie: cookie } }
  );
  expect(res.status).toBe(403);
});

it('requires auth', async () => {
  const res = await app.request(`/api/proxy?url=${encodeURIComponent('https://en.wikipedia.org/wiki/Algorithm')}`);
  expect(res.status).toBe(401);
});

it('returns 400 when url param missing', async () => {
  expect((await app.request('/api/proxy', { headers: { Cookie: cookie } })).status).toBe(400);
});
