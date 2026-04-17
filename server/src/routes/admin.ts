import { Hono } from 'hono';
import type Database from 'better-sqlite3';

interface ChallengeRow {
  id: number;
  title: string;
  difficulty: string | null;
  leetcode_url: string | null;
  description_markdown: string | null;
  starter_code: string | null;
  function_name: string | null;
  test_cases: string | null;
  tags: string | null;
  duration_mins: number | null;
  active_date: string;
}

interface QuizSpecRow {
  id: number;
  slug: string;
  mode: string;
  track_id: string;
  module_id: string;
  title: string;
  description_markdown: string;
  default_duration_mins: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  question_count?: number;
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
  created_at: string;
  updated_at: string;
}

function toChallenge(row: ChallengeRow) {
  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    leetcodeUrl: row.leetcode_url,
    descriptionMarkdown: row.description_markdown,
    starterCode: row.starter_code,
    functionName: row.function_name,
    testCases: JSON.parse(row.test_cases ?? '[]'),
    tags: JSON.parse(row.tags ?? '[]'),
    durationMins: row.duration_mins,
    activeDate: row.active_date,
  };
}

function parseJsonArray(value: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseOptions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const options = raw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  if (options.length < 2) return null;
  return options;
}

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags = raw
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 12);
  return [...new Set(tags)];
}

function normalizeDifficulty(value: unknown, fallback = 'Medium'): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'easy') return 'Easy';
  if (normalized === 'hard') return 'Hard';
  if (normalized === 'medium') return 'Medium';
  return fallback;
}

function normalizeSlug(value: unknown): string {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!slug) return '';
  if (!/^[a-z0-9._-]+$/.test(slug)) return '';
  return slug;
}

function toQuizSpec(row: QuizSpecRow) {
  return {
    id: row.id,
    slug: row.slug,
    mode: row.mode,
    trackId: row.track_id,
    moduleId: row.module_id,
    title: row.title,
    descriptionMarkdown: row.description_markdown,
    defaultDurationMins: row.default_duration_mins,
    isActive: row.is_active === 1,
    questionCount: row.question_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQuizQuestion(row: QuizQuestionRow) {
  return {
    id: row.id,
    specId: row.spec_id,
    position: row.position,
    difficulty: normalizeDifficulty(row.difficulty),
    prompt: row.prompt,
    options: parseJsonArray(row.options_json).filter((entry): entry is string => typeof entry === 'string'),
    answerIndex: row.answer_index,
    explanation: row.explanation,
    tags: parseJsonArray(row.tags_json).filter((entry): entry is string => typeof entry === 'string'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getQuizSpecById(db: Database.Database, id: number): QuizSpecRow | undefined {
  return db.prepare(`
    SELECT
      s.*,
      COUNT(q.id) as question_count
    FROM practice_quiz_specs s
    LEFT JOIN practice_quiz_questions q
      ON q.spec_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `).get(id) as QuizSpecRow | undefined;
}

function getQuizQuestionById(db: Database.Database, specId: number, questionId: number): QuizQuestionRow | undefined {
  return db.prepare(`
    SELECT *
    FROM practice_quiz_questions
    WHERE id = ? AND spec_id = ?
  `).get(questionId, specId) as QuizQuestionRow | undefined;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export function makeAdminRouter(db: Database.Database): Hono {
  const router = new Hono();

  router.use('*', async (c, next) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || c.req.header('X-Admin-Secret') !== secret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  });

  router.get('/challenges', (c) => {
    const rows = db
      .prepare('SELECT * FROM daily_challenge_pool ORDER BY active_date DESC')
      .all() as ChallengeRow[];
    return c.json(rows.map(toChallenge));
  });

  router.post('/challenges', async (c) => {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body?.title || !body?.activeDate || !body?.functionName) {
      return c.json({ error: 'Missing required fields: title, activeDate, functionName' }, 400);
    }

    const result = db.prepare(`
      INSERT INTO daily_challenge_pool
        (title, difficulty, leetcode_url, description_markdown, starter_code,
         function_name, test_cases, tags, duration_mins, active_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.title,
      body.difficulty ?? 'Medium',
      body.leetcodeUrl ?? null,
      body.descriptionMarkdown ?? '',
      body.starterCode ?? '',
      body.functionName,
      JSON.stringify(body.testCases ?? []),
      JSON.stringify(body.tags ?? []),
      body.durationMins ?? 30,
      body.activeDate,
    );

    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(result.lastInsertRowid) as ChallengeRow;
    return c.json(toChallenge(row), 201);
  });

  router.put('/challenges/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return c.json({ error: 'Invalid body' }, 400);
    }

    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as ChallengeRow | undefined;
    if (!row) {
      return c.json({ error: 'Not found' }, 404);
    }

    db.prepare(`
      UPDATE daily_challenge_pool SET
        title = ?, difficulty = ?, leetcode_url = ?, description_markdown = ?,
        starter_code = ?, function_name = ?, test_cases = ?, tags = ?,
        duration_mins = ?, active_date = ?
      WHERE id = ?
    `).run(
      body.title ?? row.title,
      body.difficulty ?? row.difficulty,
      body.leetcodeUrl ?? row.leetcode_url,
      body.descriptionMarkdown ?? row.description_markdown,
      body.starterCode ?? row.starter_code,
      body.functionName ?? row.function_name,
      body.testCases !== undefined ? JSON.stringify(body.testCases) : row.test_cases,
      body.tags !== undefined ? JSON.stringify(body.tags) : row.tags,
      body.durationMins ?? row.duration_mins,
      body.activeDate ?? row.active_date,
      id,
    );

    const updated = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as ChallengeRow;
    return c.json(toChallenge(updated));
  });

  router.delete('/challenges/:id', (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare('SELECT id FROM daily_challenge_pool WHERE id = ?').get(id) as { id: number } | undefined;
    if (!row) {
      return c.json({ error: 'Not found' }, 404);
    }

    db.prepare('DELETE FROM daily_challenge_pool WHERE id = ?').run(id);
    return c.json({ ok: true });
  });

  router.get('/quizzes', (c) => {
    const rows = db.prepare(`
      SELECT
        s.*,
        COUNT(q.id) as question_count
      FROM practice_quiz_specs s
      LEFT JOIN practice_quiz_questions q
        ON q.spec_id = s.id
      GROUP BY s.id
      ORDER BY s.mode ASC, s.slug ASC
    `).all() as QuizSpecRow[];

    return c.json(rows.map(toQuizSpec));
  });

  router.get('/quizzes/:id', (c) => {
    const id = Number(c.req.param('id'));
    const row = getQuizSpecById(db, id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json(toQuizSpec(row));
  });

  router.post('/quizzes', async (c) => {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid body' }, 400);

    const slug = normalizeSlug(body.slug);
    const mode = typeof body.mode === 'string' ? body.mode.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!slug || !mode || !title) {
      return c.json({ error: 'Missing required fields: slug, mode, title' }, 400);
    }

    const trackId = typeof body.trackId === 'string' ? body.trackId.trim() : '';
    const moduleId = typeof body.moduleId === 'string' ? body.moduleId.trim() : '';
    const descriptionMarkdown = typeof body.descriptionMarkdown === 'string' ? body.descriptionMarkdown : '';
    const defaultDurationMins = parseOptionalInt(body.defaultDurationMins) ?? 30;
    const isActive = body.isActive === false ? 0 : 1;

    if (defaultDurationMins < 5 || defaultDurationMins > 180) {
      return c.json({ error: 'defaultDurationMins must be between 5 and 180' }, 400);
    }

    try {
      const result = db.prepare(`
        INSERT INTO practice_quiz_specs
          (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(slug, mode, trackId, moduleId, title, descriptionMarkdown, defaultDurationMins, isActive);

      const row = getQuizSpecById(db, Number(result.lastInsertRowid)) as QuizSpecRow;
      return c.json(toQuizSpec(row), 201);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('unique')) {
        return c.json({ error: 'Quiz spec slug must be unique' }, 409);
      }
      throw error;
    }
  });

  router.put('/quizzes/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid body' }, 400);

    const row = getQuizSpecById(db, id);
    if (!row) return c.json({ error: 'Not found' }, 404);

    const slug = body.slug !== undefined ? normalizeSlug(body.slug) : row.slug;
    const mode = body.mode !== undefined
      ? (typeof body.mode === 'string' ? body.mode.trim() : '')
      : row.mode;
    const title = body.title !== undefined
      ? (typeof body.title === 'string' ? body.title.trim() : '')
      : row.title;
    if (!slug || !mode || !title) {
      return c.json({ error: 'slug, mode, and title cannot be empty' }, 400);
    }

    const trackId = body.trackId !== undefined
      ? (typeof body.trackId === 'string' ? body.trackId.trim() : '')
      : row.track_id;
    const moduleId = body.moduleId !== undefined
      ? (typeof body.moduleId === 'string' ? body.moduleId.trim() : '')
      : row.module_id;
    const descriptionMarkdown = body.descriptionMarkdown !== undefined
      ? (typeof body.descriptionMarkdown === 'string' ? body.descriptionMarkdown : '')
      : row.description_markdown;
    const defaultDurationMins = body.defaultDurationMins !== undefined
      ? parseOptionalInt(body.defaultDurationMins)
      : row.default_duration_mins;
    const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : row.is_active;

    if (defaultDurationMins === null || defaultDurationMins < 5 || defaultDurationMins > 180) {
      return c.json({ error: 'defaultDurationMins must be between 5 and 180' }, 400);
    }

    try {
      db.prepare(`
        UPDATE practice_quiz_specs
        SET
          slug = ?,
          mode = ?,
          track_id = ?,
          module_id = ?,
          title = ?,
          description_markdown = ?,
          default_duration_mins = ?,
          is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(slug, mode, trackId, moduleId, title, descriptionMarkdown, defaultDurationMins, isActive, id);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('unique')) {
        return c.json({ error: 'Quiz spec slug must be unique' }, 409);
      }
      throw error;
    }

    const updated = getQuizSpecById(db, id) as QuizSpecRow;
    return c.json(toQuizSpec(updated));
  });

  router.delete('/quizzes/:id', (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare('SELECT id FROM practice_quiz_specs WHERE id = ?').get(id) as { id: number } | undefined;
    if (!row) return c.json({ error: 'Not found' }, 404);
    db.prepare('DELETE FROM practice_quiz_specs WHERE id = ?').run(id);
    return c.json({ ok: true });
  });

  router.get('/quizzes/:id/questions', (c) => {
    const specId = Number(c.req.param('id'));
    const spec = db.prepare('SELECT id FROM practice_quiz_specs WHERE id = ?').get(specId) as { id: number } | undefined;
    if (!spec) return c.json({ error: 'Quiz spec not found' }, 404);

    const rows = db.prepare(`
      SELECT *
      FROM practice_quiz_questions
      WHERE spec_id = ?
      ORDER BY position ASC, id ASC
    `).all(specId) as QuizQuestionRow[];
    return c.json(rows.map(toQuizQuestion));
  });

  router.post('/quizzes/:id/questions', async (c) => {
    const specId = Number(c.req.param('id'));
    const spec = db.prepare('SELECT id FROM practice_quiz_specs WHERE id = ?').get(specId) as { id: number } | undefined;
    if (!spec) return c.json({ error: 'Quiz spec not found' }, 404);

    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid body' }, 400);

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const options = parseOptions(body.options);
    const answerIndex = parseOptionalInt(body.answerIndex);
    const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : '';
    const difficulty = normalizeDifficulty(body.difficulty);
    const tags = parseTags(body.tags);

    if (!prompt || !options || answerIndex === null) {
      return c.json({ error: 'Missing required fields: prompt, options, answerIndex' }, 400);
    }
    if (answerIndex < 0 || answerIndex >= options.length) {
      return c.json({ error: 'answerIndex out of range' }, 400);
    }

    const fallbackPosition = db.prepare(`
      SELECT COALESCE(MAX(position), 0) + 1 as nextPosition
      FROM practice_quiz_questions
      WHERE spec_id = ?
    `).get(specId) as { nextPosition: number };
    const positionCandidate = parseOptionalInt(body.position);
    const position = positionCandidate === null ? fallbackPosition.nextPosition : Math.max(0, positionCandidate);

    const result = db.prepare(`
      INSERT INTO practice_quiz_questions
        (spec_id, position, difficulty, prompt, options_json, answer_index, explanation, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(specId, position, difficulty, prompt, JSON.stringify(options), answerIndex, explanation, JSON.stringify(tags));

    const row = db.prepare('SELECT * FROM practice_quiz_questions WHERE id = ?').get(result.lastInsertRowid) as QuizQuestionRow;
    return c.json(toQuizQuestion(row), 201);
  });

  router.put('/quizzes/:id/questions/:questionId', async (c) => {
    const specId = Number(c.req.param('id'));
    const questionId = Number(c.req.param('questionId'));

    const spec = db.prepare('SELECT id FROM practice_quiz_specs WHERE id = ?').get(specId) as { id: number } | undefined;
    if (!spec) return c.json({ error: 'Quiz spec not found' }, 404);

    const row = getQuizQuestionById(db, specId, questionId);
    if (!row) return c.json({ error: 'Question not found' }, 404);

    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid body' }, 400);

    const nextPrompt = body.prompt !== undefined
      ? (typeof body.prompt === 'string' ? body.prompt.trim() : '')
      : row.prompt;
    if (!nextPrompt) {
      return c.json({ error: 'prompt cannot be empty' }, 400);
    }

    const nextOptions = body.options !== undefined
      ? parseOptions(body.options)
      : parseJsonArray(row.options_json).filter((entry): entry is string => typeof entry === 'string');
    if (!nextOptions || nextOptions.length < 2) {
      return c.json({ error: 'options must contain at least two values' }, 400);
    }

    const nextAnswerIndex = body.answerIndex !== undefined ? parseOptionalInt(body.answerIndex) : row.answer_index;
    if (nextAnswerIndex === null || nextAnswerIndex < 0 || nextAnswerIndex >= nextOptions.length) {
      return c.json({ error: 'answerIndex out of range' }, 400);
    }

    const nextPosition = body.position !== undefined ? parseOptionalInt(body.position) : row.position;
    if (nextPosition === null || nextPosition < 0) {
      return c.json({ error: 'position must be a non-negative integer' }, 400);
    }

    const nextDifficulty = body.difficulty !== undefined ? normalizeDifficulty(body.difficulty, row.difficulty) : row.difficulty;
    const nextExplanation = body.explanation !== undefined
      ? (typeof body.explanation === 'string' ? body.explanation.trim() : '')
      : row.explanation;
    const nextTags = body.tags !== undefined
      ? parseTags(body.tags)
      : parseJsonArray(row.tags_json).filter((entry): entry is string => typeof entry === 'string');

    db.prepare(`
      UPDATE practice_quiz_questions
      SET
        position = ?,
        difficulty = ?,
        prompt = ?,
        options_json = ?,
        answer_index = ?,
        explanation = ?,
        tags_json = ?,
        updated_at = datetime('now')
      WHERE id = ? AND spec_id = ?
    `).run(
      nextPosition,
      nextDifficulty,
      nextPrompt,
      JSON.stringify(nextOptions),
      nextAnswerIndex,
      nextExplanation,
      JSON.stringify(nextTags),
      questionId,
      specId,
    );

    const updated = getQuizQuestionById(db, specId, questionId) as QuizQuestionRow;
    return c.json(toQuizQuestion(updated));
  });

  router.delete('/quizzes/:id/questions/:questionId', (c) => {
    const specId = Number(c.req.param('id'));
    const questionId = Number(c.req.param('questionId'));

    const row = getQuizQuestionById(db, specId, questionId);
    if (!row) return c.json({ error: 'Question not found' }, 404);

    db.prepare('DELETE FROM practice_quiz_questions WHERE id = ? AND spec_id = ?').run(questionId, specId);
    return c.json({ ok: true });
  });

  return router;
}
