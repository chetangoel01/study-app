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
    dashboard_density      TEXT DEFAULT 'expansive',
    allow_mock_interviews  INTEGER DEFAULT 0,
    updated_at             TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS availability_proposals (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    topic            TEXT,
    notes            TEXT,
    role_preference  TEXT NOT NULL DEFAULT 'either',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability_blocks (
    id                INTEGER PRIMARY KEY,
    proposal_id       INTEGER NOT NULL REFERENCES availability_proposals(id) ON DELETE CASCADE,
    starts_at         TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'open',
    claimed_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    claimed_at        TEXT,
    mock_interview_id INTEGER REFERENCES mock_interviews(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_availability_blocks_open
    ON availability_blocks(status, starts_at)
    WHERE status = 'open';

  CREATE TABLE IF NOT EXISTS mock_interview_events (
    id          INTEGER PRIMARY KEY,
    invite_id   INTEGER NOT NULL REFERENCES mock_interviews(id) ON DELETE CASCADE,
    actor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    payload     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_mock_interview_events_invite
    ON mock_interview_events(invite_id, created_at);

  CREATE TABLE IF NOT EXISTS mock_interviews (
    id            INTEGER PRIMARY KEY,
    initiator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    peer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT DEFAULT 'pending_acceptance',
    scheduled_for TEXT,
    topic         TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_challenge_pool (
    id                   INTEGER PRIMARY KEY,
    title                TEXT NOT NULL,
    difficulty           TEXT,
    leetcode_url         TEXT,
    description_markdown TEXT,
    starter_code         TEXT,
    duration_mins        INTEGER DEFAULT 30,
    active_date          TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_challenge_completions (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id  INTEGER NOT NULL REFERENCES daily_challenge_pool(id) ON DELETE CASCADE,
    completed_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, challenge_id)
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             TEXT NOT NULL,
    title            TEXT,
    duration_seconds INTEGER DEFAULT 0,
    score_percentage INTEGER DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS module_guide_progress (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id   TEXT NOT NULL,
    max_step    INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, module_id)
  );

  CREATE TABLE IF NOT EXISTS practice_quiz_specs (
    id                    INTEGER PRIMARY KEY,
    slug                  TEXT NOT NULL UNIQUE,
    mode                  TEXT NOT NULL,
    track_id              TEXT NOT NULL DEFAULT '',
    module_id             TEXT NOT NULL DEFAULT '',
    title                 TEXT NOT NULL,
    description_markdown  TEXT NOT NULL DEFAULT '',
    default_duration_mins INTEGER NOT NULL DEFAULT 30,
    is_active             INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT DEFAULT (datetime('now')),
    updated_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS practice_quiz_questions (
    id            INTEGER PRIMARY KEY,
    spec_id       INTEGER NOT NULL REFERENCES practice_quiz_specs(id) ON DELETE CASCADE,
    position      INTEGER NOT NULL DEFAULT 0,
    difficulty    TEXT NOT NULL DEFAULT 'Medium',
    prompt        TEXT NOT NULL,
    options_json  TEXT NOT NULL DEFAULT '[]',
    answer_index  INTEGER NOT NULL DEFAULT 0,
    explanation   TEXT NOT NULL DEFAULT '',
    tags_json     TEXT NOT NULL DEFAULT '[]',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS practice_quiz_attempts (
    id                  INTEGER PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          INTEGER REFERENCES practice_sessions(id) ON DELETE SET NULL,
    quiz_spec_id        INTEGER REFERENCES practice_quiz_specs(id) ON DELETE SET NULL,
    mode                TEXT NOT NULL,
    selected_difficulty TEXT NOT NULL DEFAULT 'Medium',
    question_count      INTEGER NOT NULL DEFAULT 0,
    correct_count       INTEGER NOT NULL DEFAULT 0,
    accuracy_percentage INTEGER NOT NULL DEFAULT 0,
    duration_seconds    INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS practice_quiz_attempt_questions (
    id          INTEGER PRIMARY KEY,
    attempt_id  INTEGER NOT NULL REFERENCES practice_quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER,
    difficulty  TEXT NOT NULL DEFAULT 'Medium',
    is_correct  INTEGER NOT NULL DEFAULT 0,
    tags_json   TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_practice_quiz_specs_mode_active
    ON practice_quiz_specs(mode, is_active);

  CREATE INDEX IF NOT EXISTS idx_practice_quiz_questions_spec_position
    ON practice_quiz_questions(spec_id, position, id);

  CREATE INDEX IF NOT EXISTS idx_practice_quiz_attempts_user_created
    ON practice_quiz_attempts(user_id, created_at, id);

  CREATE INDEX IF NOT EXISTS idx_practice_quiz_attempt_questions_attempt
    ON practice_quiz_attempt_questions(attempt_id, id);

  CREATE TABLE IF NOT EXISTS forum_threads (
    id                TEXT PRIMARY KEY,
    author_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    body_md           TEXT NOT NULL,
    tag               TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity_at  TEXT NOT NULL DEFAULT (datetime('now')),
    reply_count       INTEGER NOT NULL DEFAULT 0,
    edited_at         TEXT,
    deleted_at        TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_forum_threads_activity
    ON forum_threads(last_activity_at DESC);

  CREATE INDEX IF NOT EXISTS idx_forum_threads_tag_activity
    ON forum_threads(tag, last_activity_at DESC);

  CREATE TABLE IF NOT EXISTS forum_replies (
    id          TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_md     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    edited_at   TEXT,
    deleted_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_forum_replies_thread
    ON forum_replies(thread_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS forum_subscriptions (
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id       TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    subscribed_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, thread_id)
  );

  CREATE TABLE IF NOT EXISTS forum_thread_views (
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id       TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    last_viewed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, thread_id)
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
  addCol("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'");
  addCol("ALTER TABLE user_preferences ADD COLUMN dashboard_density TEXT DEFAULT 'expansive'");
  addCol("ALTER TABLE user_preferences ADD COLUMN allow_mock_interviews INTEGER DEFAULT 0");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN description_markdown TEXT DEFAULT ''");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN starter_code TEXT DEFAULT ''");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN function_name TEXT DEFAULT ''");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN test_cases TEXT DEFAULT '[]'");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN tags TEXT DEFAULT '[]'");
  addCol("ALTER TABLE practice_quiz_questions ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'");
  addCol("ALTER TABLE mock_interviews ADD COLUMN role_preference TEXT NOT NULL DEFAULT 'either'");
  addCol("ALTER TABLE mock_interviews ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 45");
  addCol("ALTER TABLE mock_interviews ADD COLUMN source_block_id INTEGER REFERENCES availability_blocks(id) ON DELETE SET NULL");
  addCol("ALTER TABLE mock_interviews ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))");
  addCol("ALTER TABLE user_preferences ADD COLUMN default_role_preference TEXT NOT NULL DEFAULT 'either'");

  try {
    db.prepare('DROP TABLE IF EXISTS mock_interview_availability_proposals').run();
  } catch {
    // Table may already be gone.
  }
}
