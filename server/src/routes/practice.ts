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
}

function getInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
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

    const normalizedType = type.slice(0, 64);
    const fallbackTitle = normalizedType
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const normalizedTitle = (titleInput || fallbackTitle || 'Practice Session').slice(0, 140);

    db.prepare(`
      INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(user.id, normalizedType, normalizedTitle, Math.round(durationSeconds), Math.round(score));

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
    });
  });

  // Peers for mock interviews
  router.get('/peers', (c) => {
    const user = c.get('user');
    const peers = db.prepare(`
      SELECT u.id, u.full_name, u.bio
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
      WHERE p.allow_mock_interviews = 1
        AND u.id != ?
      LIMIT 50
    `).all(user.id) as any[];

    return c.json(peers.map((p) => ({
      id: String(p.id),
      fullName: p.full_name || 'Anonymous User',
      initials: getInitials(p.full_name || '')
    })));
  });

  router.post('/mock-interviews/schedule', async (c) => {
    const user = c.get('user');
    const { peerId, scheduledFor, topic } = await c.req.json().catch(() => ({} as any));

    if (!peerId || !scheduledFor) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (Number.isNaN(Date.parse(scheduledFor))) {
      return c.json({ error: 'Invalid scheduledFor value' }, 400);
    }

    const peer = db.prepare(`
      SELECT u.id
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
      WHERE u.id = ?
        AND p.allow_mock_interviews = 1
        AND u.id != ?
    `).get(peerId, user.id) as { id: number } | undefined;

    if (!peer) {
      return c.json({ error: 'Peer unavailable' }, 404);
    }

    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, topic)
      VALUES (?, ?, 'pending_acceptance', ?, ?)
    `).run(user.id, peerId, scheduledFor, topic || 'General Technical');

    return c.json({ ok: true });
  });

  router.post('/mock-interviews/proposals', async (c) => {
    const user = c.get('user');
    const { proposedFor, durationMinutes, topic, notes } = await c.req.json().catch(() => ({} as any));

    if (!proposedFor || Number.isNaN(Date.parse(proposedFor))) {
      return c.json({ error: 'Missing or invalid proposedFor' }, 400);
    }

    const duration = Number(durationMinutes ?? 45);
    if (!Number.isFinite(duration) || duration < 15 || duration > 180) {
      return c.json({ error: 'Invalid durationMinutes' }, 400);
    }

    db.prepare(`
      INSERT INTO mock_interview_availability_proposals
        (user_id, proposed_for, duration_minutes, topic, notes, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `).run(user.id, proposedFor, Math.round(duration), topic || 'General Technical', notes || '');

    return c.json({ ok: true });
  });

  return router;
}
