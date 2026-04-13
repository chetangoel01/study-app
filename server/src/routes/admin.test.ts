import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeAdminRouter } from './admin.js';

let db: Database.Database;
let app: Hono;

beforeEach(() => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/admin', makeAdminRouter(db));
  process.env.ADMIN_SECRET = 'test-secret';
});

afterEach(() => {
  db.close();
  delete process.env.ADMIN_SECRET;
});

describe('GET /api/admin/challenges', () => {
  it('returns 401 without correct secret', async () => {
    const res = await app.request('/api/admin/challenges');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await app.request('/api/admin/challenges', {
      headers: { 'X-Admin-Secret': 'wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('returns empty array when pool is empty', async () => {
    const res = await app.request('/api/admin/challenges', {
      headers: { 'X-Admin-Secret': 'test-secret' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('POST /api/admin/challenges', () => {
  it('creates a challenge', async () => {
    const body = {
      title: 'Two Sum',
      difficulty: 'Easy',
      functionName: 'two_sum',
      descriptionMarkdown: '## Two Sum\n\nGiven an array.',
      starterCode: 'def two_sum(nums, target):\n    pass',
      testCases: [{ args: [[2, 7, 11, 15], 9], expected: [0, 1] }],
      tags: ['arrays'],
      durationMins: 30,
      activeDate: '2026-01-01',
      leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    };
    const res = await app.request('/api/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'test-secret' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    const data = await res.json() as { id: number; title: string };
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Two Sum');
  });
});

describe('PUT /api/admin/challenges/:id', () => {
  it('updates a challenge title', async () => {
    db.prepare(`
      INSERT INTO daily_challenge_pool (title, active_date, function_name, test_cases, tags)
      VALUES ('Old Title', '2026-02-01', 'fn', '[]', '[]')
    `).run();
    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/admin/challenges/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'test-secret' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT title FROM daily_challenge_pool WHERE id = ?').get(id) as { title: string };
    expect(row.title).toBe('New Title');
  });
});

describe('DELETE /api/admin/challenges/:id', () => {
  it('deletes a challenge', async () => {
    db.prepare(`
      INSERT INTO daily_challenge_pool (title, active_date, function_name, test_cases, tags)
      VALUES ('To Delete', '2026-03-01', 'fn', '[]', '[]')
    `).run();
    const { id } = db.prepare('SELECT id FROM daily_challenge_pool LIMIT 1').get() as { id: number };
    const res = await app.request(`/api/admin/challenges/${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': 'test-secret' },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT id FROM daily_challenge_pool WHERE id = ?').get(id);
    expect(row).toBeUndefined();
  });
});

describe('quiz spec admin routes', () => {
  it('creates and lists quiz specs', async () => {
    const createRes = await app.request('/api/admin/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'test-secret' },
      body: JSON.stringify({
        slug: 'system-design-mcq',
        mode: 'system-design-mcq',
        trackId: 'system-design',
        moduleId: 'system-design-mcq',
        title: 'System Design MCQ Set',
        descriptionMarkdown: 'Tradeoff drills',
        defaultDurationMins: 30,
        isActive: true,
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as { id: number; slug: string };
    expect(created.slug).toBe('system-design-mcq');

    const listRes = await app.request('/api/admin/quizzes', {
      headers: { 'X-Admin-Secret': 'test-secret' },
    });
    expect(listRes.status).toBe(200);
    const list = await listRes.json() as Array<{ id: number; slug: string; questionCount: number }>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
    expect(list[0].questionCount).toBe(0);
  });

  it('updates and deletes quiz specs', async () => {
    const result = db.prepare(`
      INSERT INTO practice_quiz_specs
        (slug, mode, title, description_markdown, default_duration_mins, is_active)
      VALUES ('quiz-1', 'system-design-mcq', 'Old title', '', 30, 1)
    `).run();
    const quizId = Number(result.lastInsertRowid);

    const updateRes = await app.request(`/api/admin/quizzes/${quizId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'test-secret' },
      body: JSON.stringify({
        title: 'Updated title',
        defaultDurationMins: 45,
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated = db.prepare('SELECT title, default_duration_mins as defaultDurationMins FROM practice_quiz_specs WHERE id = ?').get(quizId) as {
      title: string;
      defaultDurationMins: number;
    };
    expect(updated.title).toBe('Updated title');
    expect(updated.defaultDurationMins).toBe(45);

    const deleteRes = await app.request(`/api/admin/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': 'test-secret' },
    });
    expect(deleteRes.status).toBe(200);
    const deleted = db.prepare('SELECT id FROM practice_quiz_specs WHERE id = ?').get(quizId);
    expect(deleted).toBeUndefined();
  });

  it('supports question CRUD for a quiz spec', async () => {
    const specResult = db.prepare(`
      INSERT INTO practice_quiz_specs
        (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active)
      VALUES ('system-design-mcq', 'system-design-mcq', 'system-design', 'system-design-mcq', 'System Design MCQ Set', '', 30, 1)
    `).run();
    const quizId = Number(specResult.lastInsertRowid);

    const createQuestionRes = await app.request(`/api/admin/quizzes/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'test-secret' },
      body: JSON.stringify({
        prompt: 'Where should idempotency be enforced for payment retries?',
        options: ['Client only', 'Server write boundary', 'CDN edge', 'DNS'],
        answerIndex: 1,
        difficulty: 'Medium',
        explanation: 'Server-side idempotency prevents duplicate writes.',
        position: 1,
      }),
    });
    expect(createQuestionRes.status).toBe(201);
    const createdQuestion = await createQuestionRes.json() as { id: number };

    const listRes = await app.request(`/api/admin/quizzes/${quizId}/questions`, {
      headers: { 'X-Admin-Secret': 'test-secret' },
    });
    expect(listRes.status).toBe(200);
    const questions = await listRes.json() as Array<{ id: number; prompt: string; answerIndex: number; options: string[] }>;
    expect(questions).toHaveLength(1);
    expect(questions[0].prompt).toContain('idempotency');
    expect(questions[0].options).toHaveLength(4);

    const updateRes = await app.request(`/api/admin/quizzes/${quizId}/questions/${createdQuestion.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'test-secret' },
      body: JSON.stringify({
        prompt: 'Updated prompt',
        options: ['A', 'B', 'C'],
        answerIndex: 2,
        difficulty: 'Hard',
      }),
    });
    expect(updateRes.status).toBe(200);

    const row = db.prepare(`
      SELECT prompt, difficulty, answer_index as answerIndex
      FROM practice_quiz_questions
      WHERE id = ?
    `).get(createdQuestion.id) as { prompt: string; difficulty: string; answerIndex: number };
    expect(row.prompt).toBe('Updated prompt');
    expect(row.difficulty).toBe('Hard');
    expect(row.answerIndex).toBe(2);

    const deleteRes = await app.request(`/api/admin/quizzes/${quizId}/questions/${createdQuestion.id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': 'test-secret' },
    });
    expect(deleteRes.status).toBe(200);
    const gone = db.prepare('SELECT id FROM practice_quiz_questions WHERE id = ?').get(createdQuestion.id);
    expect(gone).toBeUndefined();
  });
});
