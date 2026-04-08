import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeNotesRouter } from './notes.js';

let db: Database.Database;
let app: Hono;
let cookie: string;

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/notes', makeNotesRouter(db));
  await app.request('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'n@x.com', password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'n@x.com', password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  cookie = match ? `access_token=${match[1]}` : '';
});
afterEach(() => db.close());

it('GET returns empty content initially', async () => {
  expect((await (await app.request('/api/notes/big-o', { headers: { Cookie: cookie } })).json()).content).toBe('');
});

it('PUT saves and GET returns note', async () => {
  await app.request('/api/notes/big-o', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ content: 'my notes' }),
  });
  const res = await app.request('/api/notes/big-o', { headers: { Cookie: cookie } });
  expect((await res.json()).content).toBe('my notes');
});

it('PUT rejects over 50k chars with 413', async () => {
  const res = await app.request('/api/notes/big-o', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ content: 'x'.repeat(50_001) }),
  });
  expect(res.status).toBe(413);
});
