import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import {
  COMMUNITY_TAGS,
  isValidTag,
  TITLE_MAX,
  THREAD_BODY_MAX,
  REPLY_BODY_MAX,
  displayName,
  recordView,
  totalViewCount,
} from './community.js';

describe('community lib', () => {
  it('COMMUNITY_TAGS has the five v1 tags', () => {
    expect(COMMUNITY_TAGS).toEqual([
      'system-design', 'dsa', 'career', 'behavioral', 'devops',
    ]);
  });

  it('isValidTag accepts enum values and rejects others', () => {
    expect(isValidTag('dsa')).toBe(true);
    expect(isValidTag('ceo-tips')).toBe(false);
    expect(isValidTag('')).toBe(false);
  });

  it('character limits are the documented values', () => {
    expect(TITLE_MAX).toBe(200);
    expect(THREAD_BODY_MAX).toBe(20_000);
    expect(REPLY_BODY_MAX).toBe(10_000);
  });

  it('displayName prefers full_name, falls back to email local part', () => {
    expect(displayName({ full_name: 'Chetan Goel', email: 'c@x.com' })).toBe('Chetan Goel');
    expect(displayName({ full_name: '', email: 'alice@example.com' })).toBe('alice');
    expect(displayName({ full_name: '   ', email: 'bob@b.io' })).toBe('bob');
  });

  describe('view tracking', () => {
    let db: Database.Database;
    beforeEach(() => {
      db = new Database(':memory:');
      applySchema(db);
      db.prepare("INSERT INTO users (id, email) VALUES (1, 'u@x.com')").run();
      db.prepare(`INSERT INTO forum_threads (id, author_id, title, body_md, tag)
                  VALUES ('t1', 1, 'x', 'y', 'dsa')`).run();
    });
    afterEach(() => db.close());

    it('recordView inserts on first call', () => {
      recordView(db, 1, 't1');
      expect(totalViewCount(db, 't1')).toBe(1);
    });

    it('recordView is idempotent within 24h', () => {
      recordView(db, 1, 't1');
      recordView(db, 1, 't1');
      expect(totalViewCount(db, 't1')).toBe(1);
    });

    it('totalViewCount counts distinct users', () => {
      db.prepare("INSERT INTO users (id, email) VALUES (2, 'u2@x.com')").run();
      recordView(db, 1, 't1');
      recordView(db, 2, 't1');
      expect(totalViewCount(db, 't1')).toBe(2);
    });
  });
});
