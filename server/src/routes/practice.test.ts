import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makePracticeRouter } from './practice.js';

let db: Database.Database;
let app: Hono;
let accessCookie: string;

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/practice', makePracticeRouter(db));

  await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'u@x.com', password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'u@x.com', password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  accessCookie = match ? `access_token=${match[1]}` : '';

  db.prepare(`
    INSERT INTO daily_challenge_pool
      (title, difficulty, leetcode_url, description_markdown, starter_code,
       function_name, test_cases, tags, duration_mins, active_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Two Sum',
    'Easy',
    'https://leetcode.com/problems/two-sum/',
    '## Two Sum\n\nGiven an array.',
    'def two_sum(nums, target):\n    pass',
    'two_sum',
    JSON.stringify([{ args: [[2, 7, 11, 15], 9], expected: [0, 1] }]),
    JSON.stringify(['arrays']),
    30,
    '2026-01-01',
  );

  db.prepare(`
    INSERT INTO users (email, full_name, bio)
    VALUES ('peer@example.com', 'Alex Lee', 'System design interviewer')
  `).run();
  const peer = db.prepare("SELECT id FROM users WHERE email = 'peer@example.com'").get() as { id: number };
  db.prepare(`
    INSERT INTO user_preferences (user_id, allow_mock_interviews)
    VALUES (?, 1)
  `).run(peer.id);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('GET /api/practice/challenge/:id', () => {
  it('requires auth', async () => {
    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/practice/challenge/${id}`);
    expect(res.status).toBe(401);
  });

  it('returns challenge with parsed testCases and functionName', async () => {
    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/practice/challenge/${id}`, {
      headers: { Cookie: accessCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.title).toBe('Two Sum');
    expect(body.functionName).toBe('two_sum');
    expect(Array.isArray(body.testCases)).toBe(true);
    expect(body.testCases[0].args).toEqual([[2, 7, 11, 15], 9]);
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.request('/api/practice/challenge/99999', {
      headers: { Cookie: accessCookie },
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/practice/quiz-spec', () => {
  it('returns 400 when mode is missing', async () => {
    const res = await app.request('/api/practice/quiz-spec', {
      headers: { Cookie: accessCookie },
    });
    expect(res.status).toBe(400);
  });

  it('returns quiz spec questions by difficulty with fallback and duration sizing', async () => {
    const specInsert = db.prepare(`
      INSERT INTO practice_quiz_specs
        (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active)
      VALUES
        ('system-design-mcq', 'system-design-mcq', 'system-design', 'system-design-mcq', 'System Design MCQ Set', 'Tradeoffs', 30, 1)
    `).run();
    const specId = Number(specInsert.lastInsertRowid);

    const insertQuestion = db.prepare(`
      INSERT INTO practice_quiz_questions
        (spec_id, position, difficulty, prompt, options_json, answer_index, explanation, tags_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertQuestion.run(specId, 1, 'Medium', 'M1', '["A","B","C","D"]', 1, 'E1', '["caching"]');
    insertQuestion.run(specId, 2, 'Medium', 'M2', '["A","B","C","D"]', 2, 'E2', '["reliability"]');
    insertQuestion.run(specId, 3, 'Hard', 'H1', '["A","B","C","D"]', 0, 'E3', '["consistency"]');
    insertQuestion.run(specId, 4, 'Easy', 'E1', '["A","B","C","D"]', 3, 'E4', '["queues"]');
    insertQuestion.run(specId, 5, 'Medium', 'M3', '["A","B","C","D"]', 1, 'E5', '["scalability"]');
    insertQuestion.run(specId, 6, 'Hard', 'H2', '["A","B","C","D"]', 2, 'E6', '["distributed-systems"]');

    const res = await app.request(
      '/api/practice/quiz-spec?mode=system-design-mcq&trackId=system-design&moduleId=system-design-mcq&difficulty=Medium&duration=15',
      {
        headers: { Cookie: accessCookie },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as {
      spec: { slug: string };
      questions: Array<{ prompt: string; difficulty: string; answerIndex: number; options: string[]; tags: string[] }>;
      targetQuestionCount: number;
    };

    expect(body.spec.slug).toBe('system-design-mcq');
    expect(body.targetQuestionCount).toBe(5);
    expect(body.questions).toHaveLength(5);
    expect(body.questions[0].difficulty).toBe('Medium');
    expect(body.questions[0].prompt).toBe('M1');
    expect(body.questions[3].difficulty).not.toBeUndefined();
    expect(body.questions[0].options).toHaveLength(4);
    expect(body.questions[0].answerIndex).toBeGreaterThanOrEqual(0);
    expect(body.questions[0].tags).toEqual(['caching']);
  });

  it('returns 404 when no matching active spec exists', async () => {
    const res = await app.request('/api/practice/quiz-spec?mode=system-design-mcq', {
      headers: { Cookie: accessCookie },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/practice/challenge/:id/submit', () => {
  it('requires auth', async () => {
    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/practice/challenge/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'def two_sum(n,t): return [0,1]' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/practice/challenge/${id}/submit`, {
      method: 'POST',
      headers: { Cookie: accessCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('proxies to Piston and returns results', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        run: { stdout: JSON.stringify([{ passed: true, output: '[0, 1]', expected: '[0, 1]' }]), stderr: '' },
      }),
    }) as any);

    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/practice/challenge/${id}/submit`, {
      method: 'POST',
      headers: { Cookie: accessCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'def two_sum(nums, target): return [0,1]' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results[0].passed).toBe(true);
    expect(typeof body.allPassed).toBe('boolean');
  });

  it('records completion when submit=true and all tests pass', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        run: { stdout: JSON.stringify([{ passed: true, output: '[0, 1]', expected: '[0, 1]' }]), stderr: '' },
      }),
    }) as any);

    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    await app.request(`/api/practice/challenge/${id}/submit`, {
      method: 'POST',
      headers: { Cookie: accessCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'def two_sum(nums, target): return [0,1]', submit: true }),
    });

    const { id: userId } = db.prepare("SELECT id FROM users WHERE email = 'u@x.com'").get() as { id: number };
    const completion = db.prepare(
      'SELECT id FROM daily_challenge_completions WHERE user_id = ? AND challenge_id = ?'
    ).get(userId, id);
    expect(completion).toBeDefined();
  });
});

describe('GET /api/practice/stats', () => {
  it('defaults to a one-day streak for today when there is no recent activity', async () => {
    const res = await app.request('/api/practice/stats', {
      headers: { Cookie: accessCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      streakDays: number;
      streakWeek: boolean[];
    };

    expect(body.streakDays).toBe(1);
    expect(body.streakWeek[6]).toBe(true);
  });

  it('computes streak days and 7-day activity state from practice activity', async () => {
    const { id: userId } = db.prepare("SELECT id FROM users WHERE email = 'u@x.com'").get() as { id: number };
    const insertSession = db.prepare(`
      INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
      VALUES (?, 'daily_challenge', 'Daily Challenge', 1200, 100, datetime('now', ?))
    `);

    insertSession.run(userId, '-1 day');
    insertSession.run(userId, '-2 day');
    insertSession.run(userId, '-4 day');

    const res = await app.request('/api/practice/stats', {
      headers: { Cookie: accessCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      streakDays: number;
      streakWeek: boolean[];
    };

    expect(body.streakDays).toBe(2);
    expect(body.streakWeek).toHaveLength(7);
    expect(body.streakWeek[2]).toBe(true); // 4 days ago
    expect(body.streakWeek[4]).toBe(true); // 2 days ago
    expect(body.streakWeek[5]).toBe(true); // yesterday
    expect(body.streakWeek[6]).toBe(false); // today
  });

  it('computes buffered monthly percentile from active-days rank among all registered users', async () => {
    const { id: userId } = db.prepare("SELECT id FROM users WHERE email = 'u@x.com'").get() as { id: number };
    const insertUser = db.prepare(`
      INSERT INTO users (email, full_name)
      VALUES (?, ?)
    `);
    const stronger = insertUser.run('stronger@example.com', 'Stronger Learner').lastInsertRowid as number;
    const lighter = insertUser.run('lighter@example.com', 'Lighter Learner').lastInsertRowid as number;

    const insertMonthlySession = db.prepare(`
      INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
      VALUES (?, 'daily_challenge', 'Daily Challenge', 900, 90, datetime('now', 'start of month', ?))
    `);

    ['+1 day', '+2 day', '+3 day', '+4 day', '+5 day'].forEach((modifier) => {
      insertMonthlySession.run(userId, modifier);
    });
    ['+1 day', '+2 day', '+3 day', '+4 day', '+5 day', '+6 day', '+7 day'].forEach((modifier) => {
      insertMonthlySession.run(stronger, modifier);
    });
    ['+1 day', '+2 day', '+3 day'].forEach((modifier) => {
      insertMonthlySession.run(lighter, modifier);
    });

    const res = await app.request('/api/practice/stats', {
      headers: { Cookie: accessCookie },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      percentile: number;
    };

    expect(body.percentile).toBe(50);
  });

  it('returns quiz analytics trend, mode/difficulty splits, and weak-topic signals', async () => {
    const { id: userId } = db.prepare("SELECT id FROM users WHERE email = 'u@x.com'").get() as { id: number };
    const insertAttempt = db.prepare(`
      INSERT INTO practice_quiz_attempts
        (user_id, mode, selected_difficulty, question_count, correct_count, accuracy_percentage, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);
    const insertQuestionOutcome = db.prepare(`
      INSERT INTO practice_quiz_attempt_questions
        (attempt_id, question_id, difficulty, is_correct, tags_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    const attemptOne = insertAttempt.run(userId, 'system-design-mcq', 'Medium', 3, 1, 33, 900, '-1 day');
    const attemptTwo = insertAttempt.run(userId, 'system-design-mcq', 'Medium', 2, 2, 100, 850, '+0 day');
    const attemptThree = insertAttempt.run(userId, 'dsa', 'Easy', 2, 1, 50, 700, '+0 day');

    const attemptOneId = Number(attemptOne.lastInsertRowid);
    const attemptTwoId = Number(attemptTwo.lastInsertRowid);
    const attemptThreeId = Number(attemptThree.lastInsertRowid);

    insertQuestionOutcome.run(attemptOneId, 1, 'Medium', 0, '["caching"]');
    insertQuestionOutcome.run(attemptOneId, 2, 'Hard', 1, '["consistency"]');
    insertQuestionOutcome.run(attemptOneId, 3, 'Hard', 0, '["consistency"]');
    insertQuestionOutcome.run(attemptTwoId, 4, 'Easy', 1, '["caching"]');
    insertQuestionOutcome.run(attemptTwoId, 5, 'Medium', 1, '["scalability"]');
    insertQuestionOutcome.run(attemptThreeId, 6, 'Easy', 0, '["arrays"]');
    insertQuestionOutcome.run(attemptThreeId, 7, 'Easy', 1, '["arrays"]');

    const res = await app.request('/api/practice/stats', {
      headers: { Cookie: accessCookie },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as {
      quizAnalytics: {
        totalAttempts: number;
        totalQuestions: number;
        overallAccuracy: number;
        accuracyTrend: Array<{ date: string; attempts: number; accuracy: number }>;
        byDifficulty: Array<{ difficulty: string; questions: number; accuracy: number }>;
        byMode: Array<{ mode: string; label: string; attempts: number; questions: number; accuracy: number }>;
        weakTopics: Array<{ tag: string; misses: number; attempts: number; accuracy: number }>;
      };
      tagSignals: Array<{ tag: string; count: number }>;
    };

    expect(body.quizAnalytics.totalAttempts).toBe(3);
    expect(body.quizAnalytics.totalQuestions).toBe(7);
    expect(body.quizAnalytics.overallAccuracy).toBe(57);
    expect(body.quizAnalytics.accuracyTrend.length).toBeGreaterThanOrEqual(2);
    expect(body.quizAnalytics.byDifficulty.find((row) => row.difficulty === 'Hard')?.accuracy).toBe(50);
    expect(body.quizAnalytics.byMode.find((row) => row.mode === 'system-design-mcq')?.attempts).toBe(2);
    expect(body.quizAnalytics.byMode.find((row) => row.mode === 'system-design-mcq')?.label).toBe('System Design MCQ');
    expect(body.quizAnalytics.weakTopics.some((row) => row.tag === 'consistency' && row.misses >= 1)).toBe(true);
    expect(body.tagSignals.some((row) => row.tag === 'caching')).toBe(true);
  });
});

describe('POST /api/practice/sessions', () => {
  it('records a validated practice session', async () => {
    const res = await app.request('/api/practice/sessions', {
      method: 'POST',
      headers: { Cookie: accessCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'system_design_mcq',
        title: 'System Design MCQ Set',
        durationSeconds: 1260,
        score: 80,
      }),
    });
    expect(res.status).toBe(200);

    const { id: userId } = db.prepare("SELECT id FROM users WHERE email = 'u@x.com'").get() as { id: number };
    const row = db.prepare(`
      SELECT type, title, duration_seconds as durationSeconds, score_percentage as score
      FROM practice_sessions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(userId) as {
      type: string;
      title: string;
      durationSeconds: number;
      score: number;
    };

    expect(row.type).toBe('system_design_mcq');
    expect(row.title).toBe('System Design MCQ Set');
    expect(row.durationSeconds).toBe(1260);
    expect(row.score).toBe(80);
  });

  it('stores quiz-attempt metadata and per-question outcomes when provided', async () => {
    const res = await app.request('/api/practice/sessions', {
      method: 'POST',
      headers: { Cookie: accessCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'system_design_mcq',
        title: 'System Design MCQ Set',
        durationSeconds: 900,
        score: 50,
        quizAttempt: {
          mode: 'system-design-mcq',
          selectedDifficulty: 'Medium',
          quizSpecId: null,
          questions: [
            { questionId: 101, difficulty: 'Easy', isCorrect: true, tags: ['caching'] },
            { questionId: 102, difficulty: 'Hard', isCorrect: false, tags: ['consistency'] },
          ],
        },
      }),
    });
    expect(res.status).toBe(200);

    const { id: userId } = db.prepare("SELECT id FROM users WHERE email = 'u@x.com'").get() as { id: number };
    const attempt = db.prepare(`
      SELECT
        mode,
        question_count as questionCount,
        correct_count as correctCount,
        accuracy_percentage as accuracy
      FROM practice_quiz_attempts
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(userId) as {
      mode: string;
      questionCount: number;
      correctCount: number;
      accuracy: number;
    };

    expect(attempt.mode).toBe('system-design-mcq');
    expect(attempt.questionCount).toBe(2);
    expect(attempt.correctCount).toBe(1);
    expect(attempt.accuracy).toBe(50);

    const outcomes = db.prepare(`
      SELECT difficulty, is_correct as isCorrect, tags_json as tagsJson
      FROM practice_quiz_attempt_questions
      ORDER BY id ASC
      LIMIT 2
    `).all() as Array<{ difficulty: string; isCorrect: number; tagsJson: string }>;

    expect(outcomes).toHaveLength(2);
    expect(outcomes[0].difficulty).toBe('Easy');
    expect(outcomes[0].isCorrect).toBe(1);
    expect(outcomes[0].tagsJson).toBe('["caching"]');
    expect(outcomes[1].isCorrect).toBe(0);
  });

  it('returns 400 for out-of-range score', async () => {
    const res = await app.request('/api/practice/sessions', {
      method: 'POST',
      headers: { Cookie: accessCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'system_design_mcq',
        durationSeconds: 1200,
        score: 140,
      }),
    });
    expect(res.status).toBe(400);
  });
});

