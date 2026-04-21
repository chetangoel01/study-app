import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { isRoleCompatible, findOverlappingInvite } from './scheduling.js';

describe('isRoleCompatible', () => {
  it('accepts complementary roles', () => {
    expect(isRoleCompatible('interviewee', 'interviewer')).toBe(true);
    expect(isRoleCompatible('interviewer', 'interviewee')).toBe(true);
  });

  it('accepts either on either side', () => {
    expect(isRoleCompatible('either', 'interviewer')).toBe(true);
    expect(isRoleCompatible('interviewee', 'either')).toBe(true);
    expect(isRoleCompatible('either', 'either')).toBe(true);
  });

  it('rejects matching roles on both sides', () => {
    expect(isRoleCompatible('interviewee', 'interviewee')).toBe(false);
    expect(isRoleCompatible('interviewer', 'interviewer')).toBe(false);
  });
});

describe('findOverlappingInvite', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (1, ?, ?)').run('a@x.com', 'h');
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (2, ?, ?)').run('b@x.com', 'h');
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (3, ?, ?)').run('c@x.com', 'h');
  });

  it('returns conflicting invite id when windows overlap', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (10, 1, 2, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T14:30:00Z', 45);
    expect(conflict).toBe(10);
  });

  it('returns null when windows do not overlap', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (11, 1, 2, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T15:30:00Z', 30);
    expect(conflict).toBeNull();
  });

  it('ignores non-accepted invites', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (12, 1, 2, 'pending_acceptance', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T14:30:00Z', 60);
    expect(conflict).toBeNull();
  });

  it('ignores invites not involving the user', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (13, 2, 3, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T14:30:00Z', 60);
    expect(conflict).toBeNull();
  });
});
