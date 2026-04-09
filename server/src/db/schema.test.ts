import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from './schema.js';

describe('applySchema', () => {
  let db: Database.Database;

  afterEach(() => db.close());

  it('creates all required tables', () => {
    db = new Database(':memory:');
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('users');
    expect(names).toContain('oauth_accounts');
    expect(names).toContain('sessions');
    expect(names).toContain('progress');
    expect(names).toContain('notes');
    expect(names).toContain('module_guide_progress');
  });

  it('is idempotent — applying schema twice does not throw', () => {
    db = new Database(':memory:');
    expect(() => { applySchema(db); applySchema(db); }).not.toThrow();
  });
});
