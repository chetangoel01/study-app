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
    expect(names).toContain('mock_interviews');
    expect(names).toContain('practice_quiz_specs');
    expect(names).toContain('practice_quiz_questions');
    expect(names).toContain('practice_quiz_attempts');
    expect(names).toContain('practice_quiz_attempt_questions');
  });

  it('is idempotent — applying schema twice does not throw', () => {
    db = new Database(':memory:');
    expect(() => { applySchema(db); applySchema(db); }).not.toThrow();
  });

  it('daily_challenge_pool has function_name, test_cases, and tags columns', () => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare(`
      INSERT INTO daily_challenge_pool (title, active_date, function_name, test_cases, tags)
      VALUES ('Test', '2026-01-01', 'solve', '[]', '[]')
    `).run();
    const row = db.prepare('SELECT function_name, test_cases, tags FROM daily_challenge_pool LIMIT 1').get() as {
      function_name: string;
      test_cases: string;
      tags: string;
    };
    expect(row.function_name).toBe('solve');
    expect(row.test_cases).toBe('[]');
    expect(row.tags).toBe('[]');
  });

  it('practice quiz tables enforce spec->question relationship', () => {
    db = new Database(':memory:');
    applySchema(db);

    const spec = db.prepare(`
      INSERT INTO practice_quiz_specs
        (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active)
      VALUES ('system-design-mcq', 'system-design-mcq', 'system-design', 'system-design-mcq', 'System Design MCQ Set', 'Desc', 30, 1)
    `).run();

    const specId = Number(spec.lastInsertRowid);
    db.prepare(`
      INSERT INTO practice_quiz_questions
        (spec_id, position, difficulty, prompt, options_json, answer_index, explanation)
      VALUES (?, 1, 'Medium', 'Prompt?', '["A","B","C","D"]', 2, 'Because')
    `).run(specId);

    const row = db.prepare(`
      SELECT q.prompt, q.answer_index as answerIndex, s.slug
      FROM practice_quiz_questions q
      JOIN practice_quiz_specs s ON s.id = q.spec_id
      LIMIT 1
    `).get() as { prompt: string; answerIndex: number; slug: string };

    expect(row.slug).toBe('system-design-mcq');
    expect(row.prompt).toBe('Prompt?');
    expect(row.answerIndex).toBe(2);
  });

  it('practice quiz questions support tags_json metadata', () => {
    db = new Database(':memory:');
    applySchema(db);

    const spec = db.prepare(`
      INSERT INTO practice_quiz_specs
        (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active)
      VALUES ('quiz-tags', 'system-design-mcq', 'system-design', 'module-a', 'Tagged Quiz', '', 30, 1)
    `).run();
    const specId = Number(spec.lastInsertRowid);

    db.prepare(`
      INSERT INTO practice_quiz_questions
        (spec_id, position, difficulty, prompt, options_json, answer_index, explanation, tags_json)
      VALUES (?, 1, 'Medium', 'Prompt?', '["A","B"]', 0, 'Why', '["caching","latency"]')
    `).run(specId);

    const row = db.prepare(`
      SELECT tags_json as tagsJson
      FROM practice_quiz_questions
      WHERE spec_id = ?
      LIMIT 1
    `).get(specId) as { tagsJson: string };

    expect(row.tagsJson).toBe('["caching","latency"]');
  });

  it('creates availability_proposals and availability_blocks tables', () => {
    db = new Database(':memory:');
    applySchema(db);
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('availability_proposals');
    expect(names).toContain('availability_blocks');
    expect(names).toContain('mock_interview_events');
    expect(names).not.toContain('mock_interview_availability_proposals');
  });

  it('mock_interviews has role_preference, duration_minutes, source_block_id, updated_at', () => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (1, ?, ?)').run('a@x.com', 'h');
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (2, ?, ?)').run('b@x.com', 'h');
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, role_preference, duration_minutes, scheduled_for, topic)
      VALUES (1, 2, 'interviewee', 60, '2026-05-01T14:00:00Z', 'DSA')
    `).run();
    const row = db.prepare(`
      SELECT role_preference, duration_minutes, source_block_id, updated_at FROM mock_interviews
    `).get() as any;
    expect(row.role_preference).toBe('interviewee');
    expect(row.duration_minutes).toBe(60);
    expect(row.source_block_id).toBeNull();
    expect(row.updated_at).toBeTruthy();
  });

  it('user_preferences has default_role_preference', () => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (1, ?, ?)').run('a@x.com', 'h');
    db.prepare(`
      INSERT INTO user_preferences (user_id, default_role_preference) VALUES (1, 'interviewer')
    `).run();
    const row = db.prepare('SELECT default_role_preference FROM user_preferences').get() as any;
    expect(row.default_role_preference).toBe('interviewer');
  });

  it('users has timezone column defaulting to UTC', () => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare("INSERT INTO users (email, password_hash) VALUES ('tz@x.com', 'h')").run();
    const row = db.prepare("SELECT timezone FROM users WHERE email = 'tz@x.com'").get() as { timezone: string };
    expect(row.timezone).toBe('UTC');
  });

  it('timezone migration is idempotent across repeated applySchema calls', () => {
    db = new Database(':memory:');
    applySchema(db);
    applySchema(db);
    db.prepare("INSERT INTO users (email, password_hash) VALUES ('tz2@x.com', 'h')").run();
    const row = db.prepare("SELECT timezone FROM users WHERE email = 'tz2@x.com'").get() as { timezone: string };
    expect(row.timezone).toBe('UTC');
  });
});
