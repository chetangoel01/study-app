import type Database from 'better-sqlite3';

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name     TEXT DEFAULT '',
    bio           TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id                INTEGER PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL,
    provider_user_id  TEXT NOT NULL,
    created_at        TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL,
    revoked     INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS progress (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id  TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    item_type  TEXT NOT NULL,
    completed  INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, module_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id  TEXT NOT NULL,
    content    TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, module_id)
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id                     INTEGER PRIMARY KEY,
    user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme                  TEXT DEFAULT 'light',
    notify_daily_challenge INTEGER DEFAULT 1,
    notify_weekly_progress INTEGER DEFAULT 1,
    notify_community       INTEGER DEFAULT 0,
    updated_at             TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );
`;

export function applySchema(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_DDL);
  const addCol = (sql: string) => {
    try {
      db.prepare(sql).run();
    } catch {
      // Existing databases may already have these columns.
    }
  };

  addCol("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''");
  addCol("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''");
}
