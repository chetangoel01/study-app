import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { buildHarness, runWithPiston } from '../services/piston.js';

interface QuizSpecRow {
  id: number;
  slug: string;
  mode: string;
  track_id: string;
  module_id: string;
  title: string;
  description_markdown: string;
  default_duration_mins: number;
}

interface QuizQuestionRow {
  id: number;
  spec_id: number;
  position: number;
  difficulty: string;
  prompt: string;
  options_json: string;
  answer_index: number;
  explanation: string;
  tags_json: string;
}

interface ParsedQuizAttemptQuestion {
  questionId: number | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  isCorrect: boolean;
  tags: string[];
}

interface ParsedQuizAttempt {
  mode: string;
  selectedDifficulty: 'Easy' | 'Medium' | 'Hard';
  quizSpecId: number | null;
  questions: ParsedQuizAttemptQuestion[];
}

function shiftIsoDay(isoDay: string, dayOffset: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function calculateCurrentStreak(activityDays: Set<string>, todayIsoDay: string): number {
  const yesterdayIsoDay = shiftIsoDay(todayIsoDay, -1);
  const streakAnchor = activityDays.has(todayIsoDay)
    ? todayIsoDay
    : activityDays.has(yesterdayIsoDay)
      ? yesterdayIsoDay
      : null;

  if (!streakAnchor) {
    return 0;
  }

  let streak = 0;
  let cursor = streakAnchor;
  while (activityDays.has(cursor)) {
    streak += 1;
    cursor = shiftIsoDay(cursor, -1);
  }
  return streak;
}

const PERCENTILE_SMOOTHING_USERS = 4;
const PERCENTILE_SMOOTHING_AHEAD = 2;

function normalizeDifficulty(value: string | null): 'Easy' | 'Medium' | 'Hard' {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard') return 'Hard';
  return 'Medium';
}

function parseDurationMinutes(value: string | null, fallback = 30): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(10, Math.min(90, Math.round(parsed)));
}

function getQuizQuestionTarget(durationMinutes: number): number {
  const roughTarget = Math.round(durationMinutes / 3);
  return Math.max(5, Math.min(15, roughTarget));
}

function parseQuestionOptions(rawOptionsJson: string): string[] {
  try {
    const parsed = JSON.parse(rawOptionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeQuestionDifficulty(value: string): 'Easy' | 'Medium' | 'Hard' {
  return normalizeDifficulty(value);
}

function parseNormalizedTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const tag of raw) {
    if (typeof tag !== 'string') continue;
    const normalized = tag.trim().toLowerCase();
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= 12) break;
  }
  return [...unique];
}

function parseQuestionTags(rawTagsJson: string): string[] {
  try {
    return parseNormalizedTags(JSON.parse(rawTagsJson));
  } catch {
    return [];
  }
}

function parseQuizAttemptPayload(raw: unknown): { value: ParsedQuizAttempt | null; error: string | null } {
  if (raw === null || raw === undefined) {
    return { value: null, error: null };
  }
  if (typeof raw !== 'object') {
    return { value: null, error: 'Invalid quizAttempt payload' };
  }
  const payload = raw as Record<string, unknown>;

  const mode = typeof payload.mode === 'string' ? payload.mode.trim() : '';
  if (!mode) {
    return { value: null, error: 'quizAttempt.mode is required' };
  }
  if (mode.length > 64) {
    return { value: null, error: 'quizAttempt.mode is too long' };
  }

  const selectedDifficulty = normalizeDifficulty(
    typeof payload.selectedDifficulty === 'string' ? payload.selectedDifficulty : null,
  );

  let quizSpecId: number | null = null;
  if (payload.quizSpecId !== undefined && payload.quizSpecId !== null && payload.quizSpecId !== '') {
    const parsed = Number(payload.quizSpecId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { value: null, error: 'quizAttempt.quizSpecId must be a positive number' };
    }
    quizSpecId = Math.round(parsed);
  }

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return { value: null, error: 'quizAttempt.questions must include at least one question result' };
  }
  if (payload.questions.length > 200) {
    return { value: null, error: 'quizAttempt.questions exceeds max length' };
  }

  const questions: ParsedQuizAttemptQuestion[] = [];
  for (const entry of payload.questions) {
    if (typeof entry !== 'object' || entry === null) {
      return { value: null, error: 'Each quizAttempt question must be an object' };
    }
    const question = entry as Record<string, unknown>;
    const parsedQuestionId = Number(question.questionId);
    const questionId = Number.isFinite(parsedQuestionId) && parsedQuestionId > 0
      ? Math.round(parsedQuestionId)
      : null;
    const difficulty = normalizeDifficulty(
      typeof question.difficulty === 'string' ? question.difficulty : selectedDifficulty,
    );
    const isCorrect = question.isCorrect === true;
    const tags = parseNormalizedTags(question.tags);

    questions.push({
      questionId,
      difficulty,
      isCorrect,
      tags,
    });
  }

  return {
    value: {
      mode,
      selectedDifficulty,
      quizSpecId,
      questions,
    },
    error: null,
  };
}

function formatModeLabel(mode: string): string {
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'system-design-mcq' || normalized === 'system_design_mcq') return 'System Design MCQ';
  if (normalized === 'dsa' || normalized === 'dsa-drill') return 'DSA Drill';
  if (normalized === 'concurrency-open' || normalized === 'concurrency_open') return 'Concurrency Open';
  return mode
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function makePracticeRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  // Daily Challenge
  router.get('/daily-challenge', (c) => {
    const user = c.get('user');
    const today = new Date().toISOString().split('T')[0];

    // Get today's challenge
    let challenge = db.prepare('SELECT * FROM daily_challenge_pool WHERE active_date = ?').get(today) as any;
    
    // If no challenge exists for today, grab fallback
    if (!challenge) {
      const fallback = db.prepare('SELECT * FROM daily_challenge_pool ORDER BY active_date DESC LIMIT 1').get() as any;
      if (!fallback) {
        return c.json({ error: 'No daily challenges available' }, 404);
      }
      challenge = fallback;
    }

    // Check completion
    const completion = db.prepare(
      'SELECT completed_at FROM daily_challenge_completions WHERE user_id = ? AND challenge_id = ?'
    ).get(user.id, challenge.id) as any;

    return c.json({
      id: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty,
      leetcodeUrl: challenge.leetcode_url,
      descriptionMarkdown: challenge.description_markdown || `## ${challenge.title}\n\nGiven an array, return true.`,
      starterCode: challenge.starter_code || `export function solve(input) {\n  \n}`,
      functionName: challenge.function_name || 'solve',
      testCases: JSON.parse(challenge.test_cases ?? '[]'),
      tags: JSON.parse(challenge.tags ?? '[]'),
      durationMins: challenge.duration_mins,
      completed: !!completion,
      completedAt: completion?.completed_at || null,
    });
  });

  router.post('/daily-challenge/complete', async (c) => {
    const user = c.get('user');
    const { challengeId } = await c.req.json().catch(() => ({ challengeId: null }));
    if (!challengeId) return c.json({ error: 'Missing challengeId' }, 400);

    db.prepare(`
      INSERT INTO daily_challenge_completions (user_id, challenge_id, completed_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT DO NOTHING
    `).run(user.id, challengeId);

    // Inject practice session
    db.prepare(`
      INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
      VALUES (?, 'daily_challenge', 'Daily Challenge', 1800, 100, datetime('now'))
    `).run(user.id);

    return c.json({ ok: true });
  });

  router.get('/challenge/:id', (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as any;
    if (!row) {
      return c.json({ error: 'Not found' }, 404);
    }

    const user = c.get('user');
    const completion = db.prepare(
      'SELECT completed_at FROM daily_challenge_completions WHERE user_id = ? AND challenge_id = ?'
    ).get(user.id, row.id) as { completed_at: string } | undefined;

    return c.json({
      id: row.id,
      title: row.title,
      difficulty: row.difficulty,
      leetcodeUrl: row.leetcode_url,
      descriptionMarkdown: row.description_markdown || `## ${row.title}`,
      starterCode: row.starter_code || `def ${row.function_name || 'solve'}():\n    pass`,
      functionName: row.function_name || 'solve',
      testCases: JSON.parse(row.test_cases ?? '[]'),
      tags: JSON.parse(row.tags ?? '[]'),
      durationMins: row.duration_mins ?? 30,
      completed: Boolean(completion),
      completedAt: completion?.completed_at ?? null,
    });
  });

  router.post('/challenge/:id/submit', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const { code, submit } = await c.req.json().catch(() => ({ code: null, submit: false })) as {
      code: string | null;
      submit?: boolean;
    };
    if (!code) {
      return c.json({ error: 'Missing code' }, 400);
    }

    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as any;
    if (!row) {
      return c.json({ error: 'Not found' }, 404);
    }

    const testCases = JSON.parse(row.test_cases ?? '[]');
    const harness = buildHarness(code, testCases, row.function_name || 'solve');

    let results;
    try {
      results = await runWithPiston(harness);
    } catch {
      return c.json({ error: 'Execution service unavailable' }, 502);
    }

    const allPassed = results.length > 0 && results.every((result) => result.passed);

    if (submit && allPassed) {
      db.prepare(`
        INSERT INTO daily_challenge_completions (user_id, challenge_id, completed_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT DO NOTHING
      `).run(user.id, id);

      db.prepare(`
        INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
        VALUES (?, 'daily_challenge', ?, 0, 100, datetime('now'))
      `).run(user.id, row.title);
    }

    return c.json({ results, allPassed });
  });

  router.get('/quiz-spec', (c) => {
    const mode = c.req.query('mode')?.trim() ?? '';
    if (!mode) {
      return c.json({ error: 'Missing mode' }, 400);
    }

    const trackId = c.req.query('trackId')?.trim() ?? '';
    const moduleId = c.req.query('moduleId')?.trim() ?? '';
    const difficulty = normalizeDifficulty(c.req.query('difficulty') ?? null);
    const durationMinutes = parseDurationMinutes(c.req.query('duration') ?? null);
    const questionTarget = getQuizQuestionTarget(durationMinutes);

    const spec = db.prepare(`
      SELECT *
      FROM practice_quiz_specs
      WHERE
        is_active = 1
        AND mode = ?
        AND (? = '' OR track_id IN (?, ''))
        AND (? = '' OR module_id IN (?, ''))
      ORDER BY
        CASE WHEN module_id = ? THEN 0 WHEN module_id = '' THEN 1 ELSE 2 END,
        CASE WHEN track_id = ? THEN 0 WHEN track_id = '' THEN 1 ELSE 2 END,
        id ASC
      LIMIT 1
    `).get(
      mode,
      trackId,
      trackId,
      moduleId,
      moduleId,
      moduleId,
      trackId,
    ) as QuizSpecRow | undefined;

    if (!spec) {
      return c.json({ error: 'Quiz spec not found' }, 404);
    }

    const questionRows = db.prepare(`
      SELECT *
      FROM practice_quiz_questions
      WHERE spec_id = ?
      ORDER BY position ASC, id ASC
    `).all(spec.id) as QuizQuestionRow[];

    const normalizedQuestions = questionRows
      .map((row) => {
        const options = parseQuestionOptions(row.options_json);
        const answerIndex = Math.round(Number(row.answer_index));
        if (options.length < 2) return null;
        if (!Number.isFinite(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return null;
        return {
          id: row.id,
          position: row.position,
          difficulty: normalizeQuestionDifficulty(row.difficulty),
          prompt: row.prompt,
          options,
          answerIndex,
          explanation: row.explanation || '',
          tags: parseQuestionTags(row.tags_json),
        };
      })
      .filter((row): row is {
        id: number;
        position: number;
        difficulty: 'Easy' | 'Medium' | 'Hard';
        prompt: string;
        options: string[];
        answerIndex: number;
        explanation: string;
        tags: string[];
      } => row !== null);

    if (normalizedQuestions.length === 0) {
      return c.json({ error: 'No quiz questions available' }, 404);
    }

    const primary = normalizedQuestions.filter((question) => question.difficulty === difficulty);
    const fallback = normalizedQuestions.filter((question) => question.difficulty !== difficulty);
    const selectedQuestions = [...primary, ...fallback].slice(0, Math.min(questionTarget, normalizedQuestions.length));

    return c.json({
      spec: {
        id: spec.id,
        slug: spec.slug,
        mode: spec.mode,
        trackId: spec.track_id || trackId,
        moduleId: spec.module_id || moduleId,
        title: spec.title,
        descriptionMarkdown: spec.description_markdown,
        defaultDurationMins: spec.default_duration_mins,
      },
      selectedDifficulty: difficulty,
      targetQuestionCount: questionTarget,
      totalQuestionCount: normalizedQuestions.length,
      questions: selectedQuestions,
    });
  });

  router.post('/sessions', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const titleInput = typeof body.title === 'string' ? body.title.trim() : '';
    const durationSeconds = Number(body.durationSeconds);
    const score = Number(body.score);

    if (!type) {
      return c.json({ error: 'Missing type' }, 400);
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 8 * 60 * 60) {
      return c.json({ error: 'Invalid durationSeconds' }, 400);
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return c.json({ error: 'Invalid score' }, 400);
    }

    const parsedQuizAttempt = parseQuizAttemptPayload(body.quizAttempt);
    if (parsedQuizAttempt.error) {
      return c.json({ error: parsedQuizAttempt.error }, 400);
    }

    const normalizedType = type.slice(0, 64);
    const fallbackTitle = normalizedType
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const normalizedTitle = (titleInput || fallbackTitle || 'Practice Session').slice(0, 140);

    const normalizedDurationSeconds = Math.round(durationSeconds);
    const normalizedScore = Math.round(score);

    const insertSession = db.prepare(`
      INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertQuizAttempt = db.prepare(`
      INSERT INTO practice_quiz_attempts
        (user_id, session_id, quiz_spec_id, mode, selected_difficulty, question_count, correct_count, accuracy_percentage, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertQuizQuestionResult = db.prepare(`
      INSERT INTO practice_quiz_attempt_questions
        (attempt_id, question_id, difficulty, is_correct, tags_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    db.transaction(() => {
      const result = insertSession.run(
        user.id,
        normalizedType,
        normalizedTitle,
        normalizedDurationSeconds,
        normalizedScore,
      );
      const sessionId = Number(result.lastInsertRowid);
      const quizAttempt = parsedQuizAttempt.value;
      if (!quizAttempt) return;

      const questionCount = quizAttempt.questions.length;
      const correctCount = quizAttempt.questions.reduce(
        (sum, question) => sum + (question.isCorrect ? 1 : 0),
        0,
      );
      const accuracy = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;
      const attemptResult = insertQuizAttempt.run(
        user.id,
        sessionId,
        quizAttempt.quizSpecId,
        quizAttempt.mode,
        quizAttempt.selectedDifficulty,
        questionCount,
        correctCount,
        accuracy,
        normalizedDurationSeconds,
      );
      const attemptId = Number(attemptResult.lastInsertRowid);

      for (const question of quizAttempt.questions) {
        insertQuizQuestionResult.run(
          attemptId,
          question.questionId,
          question.difficulty,
          question.isCorrect ? 1 : 0,
          JSON.stringify(question.tags),
        );
      }
    })();

    return c.json({ ok: true });
  });

  // Streaks and Stats
  router.get('/stats', (c) => {
    const user = c.get('user');
    
    const sessions = db.prepare(`
      SELECT id, type, title, duration_seconds as durationSeconds, score_percentage as score, created_at as createdAt
      FROM practice_sessions 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(user.id);

    const activityRows = db.prepare(`
      SELECT DISTINCT day
      FROM (
        SELECT date(completed_at) AS day
        FROM daily_challenge_completions
        WHERE user_id = ?
        UNION
        SELECT date(created_at) AS day
        FROM practice_sessions
        WHERE user_id = ?
      )
      WHERE day IS NOT NULL
      ORDER BY day DESC
    `).all(user.id, user.id) as { day: string }[];

    const activityDays = new Set(activityRows.map((row) => row.day));
    const todayIsoDay = new Date().toISOString().slice(0, 10);
    const calculatedStreak = calculateCurrentStreak(activityDays, todayIsoDay);
    const streakDays = calculatedStreak > 0 ? calculatedStreak : 1;

    const streakWeek = Array.from({ length: 7 }, (_, index) => {
      const day = shiftIsoDay(todayIsoDay, index - 6);
      if (day === todayIsoDay) {
        return activityDays.has(day) || streakDays === 1;
      }
      return activityDays.has(day);
    });

    const monthlyRank = db.prepare(`
      WITH monthly_activity AS (
        SELECT activity.user_id, COUNT(DISTINCT activity.day) AS active_days
        FROM (
          SELECT user_id, date(completed_at) AS day
          FROM daily_challenge_completions
          WHERE date(completed_at) >= date('now', 'start of month')
          UNION
          SELECT user_id, date(created_at) AS day
          FROM practice_sessions
          WHERE date(created_at) >= date('now', 'start of month')
        ) AS activity
        WHERE activity.day IS NOT NULL
        GROUP BY activity.user_id
      ),
      scored_users AS (
        SELECT u.id AS user_id, COALESCE(ma.active_days, 0) AS active_days
        FROM users u
        LEFT JOIN monthly_activity ma ON ma.user_id = u.id
      )
      SELECT
        COALESCE((SELECT active_days FROM scored_users WHERE user_id = ?), 0) AS userDays,
        COALESCE((SELECT COUNT(*) FROM scored_users), 0) AS cohortSize,
        COALESCE(
          (
            SELECT COUNT(*)
            FROM scored_users
            WHERE active_days > COALESCE((SELECT active_days FROM scored_users WHERE user_id = ?), 0)
          ),
          0
        ) AS usersAhead
    `).get(user.id, user.id) as { userDays: number; cohortSize: number; usersAhead: number } | undefined;

    const cohortSize = monthlyRank?.cohortSize ?? 0;
    const usersAhead = monthlyRank?.usersAhead ?? 0;

    let percentile = 50;
    if (cohortSize > 0) {
      const rank = Math.max(1, usersAhead + 1);
      const bufferedRank = rank + PERCENTILE_SMOOTHING_AHEAD;
      const bufferedCohort = cohortSize + PERCENTILE_SMOOTHING_USERS;
      percentile = Math.min(99, Math.max(1, Math.round((bufferedRank / bufferedCohort) * 100)));
    }

    const quizTrendRows = db.prepare(`
      SELECT
        date(created_at) AS day,
        COUNT(*) AS attempts,
        COALESCE(SUM(correct_count), 0) AS correctCount,
        COALESCE(SUM(question_count), 0) AS questionCount
      FROM practice_quiz_attempts
      WHERE user_id = ?
      GROUP BY date(created_at)
      ORDER BY day DESC
      LIMIT 7
    `).all(user.id) as Array<{
      day: string;
      attempts: number;
      correctCount: number;
      questionCount: number;
    }>;

    const accuracyTrend = [...quizTrendRows]
      .reverse()
      .map((row) => ({
        date: row.day,
        attempts: row.attempts,
        accuracy: row.questionCount > 0
          ? Math.round((row.correctCount / row.questionCount) * 100)
          : 0,
      }));

    const quizDifficultyRows = db.prepare(`
      SELECT
        q.difficulty AS difficulty,
        COUNT(*) AS questions,
        COALESCE(SUM(q.is_correct), 0) AS correct
      FROM practice_quiz_attempt_questions q
      JOIN practice_quiz_attempts a
        ON a.id = q.attempt_id
      WHERE a.user_id = ?
      GROUP BY q.difficulty
    `).all(user.id) as Array<{
      difficulty: string;
      questions: number;
      correct: number;
    }>;

    const difficultyMap = new Map<'Easy' | 'Medium' | 'Hard', { questions: number; correct: number }>();
    for (const row of quizDifficultyRows) {
      const difficultyKey = normalizeDifficulty(row.difficulty);
      const existing = difficultyMap.get(difficultyKey) ?? { questions: 0, correct: 0 };
      existing.questions += Number(row.questions) || 0;
      existing.correct += Number(row.correct) || 0;
      difficultyMap.set(difficultyKey, existing);
    }
    const byDifficulty = (['Easy', 'Medium', 'Hard'] as const).map((difficultyKey) => {
      const totals = difficultyMap.get(difficultyKey) ?? { questions: 0, correct: 0 };
      return {
        difficulty: difficultyKey,
        questions: totals.questions,
        accuracy: totals.questions > 0 ? Math.round((totals.correct / totals.questions) * 100) : 0,
      };
    });

    const quizModeRows = db.prepare(`
      SELECT
        mode,
        COUNT(*) AS attempts,
        COALESCE(SUM(correct_count), 0) AS correctCount,
        COALESCE(SUM(question_count), 0) AS questionCount
      FROM practice_quiz_attempts
      WHERE user_id = ?
      GROUP BY mode
      ORDER BY attempts DESC, mode ASC
    `).all(user.id) as Array<{
      mode: string;
      attempts: number;
      correctCount: number;
      questionCount: number;
    }>;

    const byMode = quizModeRows.map((row) => ({
      mode: row.mode,
      label: formatModeLabel(row.mode),
      attempts: Number(row.attempts) || 0,
      questions: Number(row.questionCount) || 0,
      accuracy: Number(row.questionCount) > 0
        ? Math.round((Number(row.correctCount) / Number(row.questionCount)) * 100)
        : 0,
    }));

    const totalQuizAttempts = byMode.reduce((sum, row) => sum + row.attempts, 0);
    const totalQuizQuestions = byMode.reduce((sum, row) => sum + row.questions, 0);
    const weightedCorrectAnswers = quizModeRows.reduce((sum, row) => sum + (Number(row.correctCount) || 0), 0);
    const overallQuizAccuracy = totalQuizQuestions > 0
      ? Math.round((weightedCorrectAnswers / totalQuizQuestions) * 100)
      : 0;

    const quizTopicRows = db.prepare(`
      SELECT
        q.tags_json AS tagsJson,
        q.is_correct AS isCorrect
      FROM practice_quiz_attempt_questions q
      JOIN practice_quiz_attempts a
        ON a.id = q.attempt_id
      WHERE a.user_id = ?
      ORDER BY q.id DESC
      LIMIT 2000
    `).all(user.id) as Array<{
      tagsJson: string;
      isCorrect: number;
    }>;

    const quizTopicStats = new Map<string, { attempts: number; misses: number; correct: number }>();
    for (const row of quizTopicRows) {
      const tags = parseQuestionTags(row.tagsJson);
      if (tags.length === 0) continue;
      const isCorrect = Number(row.isCorrect) === 1;
      for (const tag of tags) {
        const stat = quizTopicStats.get(tag) ?? { attempts: 0, misses: 0, correct: 0 };
        stat.attempts += 1;
        if (isCorrect) {
          stat.correct += 1;
        } else {
          stat.misses += 1;
        }
        quizTopicStats.set(tag, stat);
      }
    }

    const weakTopics = [...quizTopicStats.entries()]
      .map(([tag, stats]) => ({
        tag,
        attempts: stats.attempts,
        misses: stats.misses,
        accuracy: stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0,
      }))
      .filter((topic) => topic.misses > 0)
      .sort((a, b) => (
        b.misses - a.misses
        || a.accuracy - b.accuracy
        || b.attempts - a.attempts
        || a.tag.localeCompare(b.tag)
      ))
      .slice(0, 6);

    const tagRows = db.prepare(`
      SELECT p.tags AS tags
      FROM daily_challenge_completions c
      JOIN daily_challenge_pool p
        ON p.id = c.challenge_id
      WHERE c.user_id = ?
      ORDER BY c.completed_at DESC
      LIMIT 120
    `).all(user.id) as { tags: string | null }[];

    const tagCounts = new Map<string, number>();
    for (const row of tagRows) {
      let tags: unknown = [];
      try {
        tags = JSON.parse(row.tags ?? '[]');
      } catch {
        tags = [];
      }
      if (!Array.isArray(tags)) continue;
      for (const rawTag of tags) {
        if (typeof rawTag !== 'string') continue;
        const normalized = rawTag.trim().toLowerCase();
        if (!normalized) continue;
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }
    for (const [tag, stats] of quizTopicStats.entries()) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + stats.attempts);
    }
    const tagSignals = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([tag, count]) => ({ tag, count }));

    return c.json({
      streakDays,
      percentile,
      streakWeek,
      recentSessions: sessions,
      skillBreakdown: [
        { name: 'Algorithms', score: 88 },
        { name: 'System Design', score: 64 },
        { name: 'Concurrency', score: 92 },
      ],
      tagSignals,
      quizAnalytics: {
        totalAttempts: totalQuizAttempts,
        totalQuestions: totalQuizQuestions,
        overallAccuracy: overallQuizAccuracy,
        accuracyTrend,
        byDifficulty,
        byMode,
        weakTopics,
      },
    });
  });

  return router;
}
