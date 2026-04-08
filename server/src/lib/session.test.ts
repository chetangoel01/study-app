import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { createSession, rotateSession, revokeSession, revokeAllUserSessions, isSessionValid } from './session.js';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  applySchema(db);
  db.prepare("INSERT INTO users (id, email) VALUES (1, 'a@b.com')").run();
});
afterEach(() => db.close());

describe('sessions', () => {
  it('creates a valid session', () => {
    const id = createSession(1, db);
    expect(typeof id).toBe('string');
    expect(isSessionValid(id, db)).toBe(true);
  });

  it('rotates: old invalid, new valid', () => {
    const old = createSession(1, db);
    const next = rotateSession(old, db);
    expect(next).not.toBeNull();
    expect(isSessionValid(old, db)).toBe(false);
    expect(isSessionValid(next!.sessionId, db)).toBe(true);
  });

  it('returns null for rotate of unknown token', () => {
    expect(rotateSession('no-such-token', db)).toBeNull();
  });

  it('revokes a session', () => {
    const id = createSession(1, db);
    revokeSession(id, db);
    expect(isSessionValid(id, db)).toBe(false);
  });

  it('revokes all sessions for a user', () => {
    const t1 = createSession(1, db);
    const t2 = createSession(1, db);
    revokeAllUserSessions(1, db);
    expect(isSessionValid(t1, db)).toBe(false);
    expect(isSessionValid(t2, db)).toBe(false);
  });
});
