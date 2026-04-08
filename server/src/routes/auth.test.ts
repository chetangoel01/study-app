import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';

let db: Database.Database;
let app: Hono;

beforeEach(() => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
});
afterEach(() => db.close());

describe('POST /api/auth/signup', () => {
  it('creates a user and returns 201', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).email).toBe('test@example.com');
  });

  it('rejects duplicate email with 409', async () => {
    const body = JSON.stringify({ email: 'dup@example.com', password: 'pass123456' });
    const headers = { 'Content-Type': 'application/json' };
    await app.request('/api/auth/signup', { method: 'POST', headers, body });
    const res = await app.request('/api/auth/signup', { method: 'POST', headers, body });
    expect(res.status).toBe(409);
  });

  it('rejects short password with 400', async () => {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
    });
  });

  it('sets cookies on valid credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const cookies = res.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('access_token');
    expect(cookies).toContain('refresh_token');
  });

  it('returns 401 on wrong password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'wrongpass' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns NO_PASSWORD error for OAuth-only account', async () => {
    db.prepare("INSERT INTO users (email) VALUES ('oauth@example.com')").run();
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'oauth@example.com', password: 'anypass' }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('NO_PASSWORD');
  });

  it('returns 400 when email or password missing', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/change-password', () => {
  let cookie: string;
  beforeEach(async () => {
    await app.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'chg@example.com', password: 'oldpassword' }),
    });
    const res = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'chg@example.com', password: 'oldpassword' }),
    });
    const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
    cookie = match ? `access_token=${match[1]}` : '';
  });

  it('changes password and revokes all sessions', async () => {
    const res = await app.request('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: 'oldpassword', newPassword: 'newpassword123' }),
    });
    expect(res.status).toBe(200);
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'chg@example.com', password: 'oldpassword' }),
    });
    expect(loginRes.status).toBe(401);
    const newLoginRes = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'chg@example.com', password: 'newpassword123' }),
    });
    expect(newLoginRes.status).toBe(200);
  });

  it('rejects wrong current password with 401', async () => {
    const res = await app.request('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: 'wrongpassword', newPassword: 'newpassword123' }),
    });
    expect(res.status).toBe(401);
  });
});
