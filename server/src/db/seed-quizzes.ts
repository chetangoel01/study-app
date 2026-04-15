import { createDb } from './client.js';

const db = createDb();

const quizSpec = {
  slug: 'system-design-mcq',
  mode: 'system-design-mcq',
  trackId: 'system-design',
  moduleId: 'system-design-mcq',
  title: 'System Design MCQ Set',
  descriptionMarkdown: 'Practice architecture tradeoffs with quick multiple-choice prompts.',
  defaultDurationMins: 30,
  isActive: 1,
};

const questions = [
  {
    position: 1,
    difficulty: 'Easy',
    prompt: 'Your service is read-heavy and mostly static. What should you add first?',
    options: [
      'A read-through cache in front of the database',
      'Immediate cross-region active-active writes',
      'Synchronous replication on every request',
      'A larger timeout for all clients',
    ],
    answerIndex: 0,
    explanation: 'A read-through cache reduces repeated load without forcing large architecture changes.',
    tags: ['caching', 'read-heavy'],
  },
  {
    position: 2,
    difficulty: 'Medium',
    prompt: 'Payment requests can be retried by clients. Where is idempotency most critical?',
    options: [
      'Only in frontend code',
      'At the server write boundary',
      'Inside CDN rules',
      'In browser local storage',
    ],
    answerIndex: 1,
    explanation: 'Server-side idempotency at write time prevents duplicate charges from network retries.',
    tags: ['idempotency', 'payments'],
  },
  {
    position: 3,
    difficulty: 'Medium',
    prompt: 'A downstream dependency is overloaded. Which protective pattern helps most immediately?',
    options: [
      'Aggressive no-delay retries',
      'Circuit breaker with bounded queue backpressure',
      'Disable all logging',
      'Increase payload size',
    ],
    answerIndex: 1,
    explanation: 'Backpressure and circuit breaking reduce cascading failures when dependencies degrade.',
    tags: ['backpressure', 'circuit-breaker'],
  },
  {
    position: 4,
    difficulty: 'Hard',
    prompt: 'You need multi-region active-active writes with merge behavior. Which approach fits best?',
    options: [
      'Single leader only and no replicas',
      'CRDTs or deterministic conflict resolution strategy',
      'Disable all clocks',
      'Local files per node',
    ],
    answerIndex: 1,
    explanation: 'Active-active writes require deterministic conflict handling, often with versioning or CRDT patterns.',
    tags: ['active-active', 'conflict-resolution'],
  },
  {
    position: 5,
    difficulty: 'Hard',
    prompt: 'Global total ordering across partitions is required. What tradeoff is unavoidable?',
    options: [
      'Higher coordination overhead and lower throughput',
      'Zero additional latency',
      'No need for consensus primitives',
      'No impact on write scalability',
    ],
    answerIndex: 0,
    explanation: 'Total ordering introduces coordination costs that constrain horizontal throughput.',
    tags: ['ordering', 'distributed-systems'],
  },
];

const seed = db.transaction(() => {
  db.prepare(`
    INSERT INTO practice_quiz_specs
      (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      mode = excluded.mode,
      track_id = excluded.track_id,
      module_id = excluded.module_id,
      title = excluded.title,
      description_markdown = excluded.description_markdown,
      default_duration_mins = excluded.default_duration_mins,
      is_active = excluded.is_active,
      updated_at = datetime('now')
  `).run(
    quizSpec.slug,
    quizSpec.mode,
    quizSpec.trackId,
    quizSpec.moduleId,
    quizSpec.title,
    quizSpec.descriptionMarkdown,
    quizSpec.defaultDurationMins,
    quizSpec.isActive,
  );

  const spec = db.prepare('SELECT id FROM practice_quiz_specs WHERE slug = ?').get(quizSpec.slug) as { id: number };
  db.prepare('DELETE FROM practice_quiz_questions WHERE spec_id = ?').run(spec.id);

  const insertQuestion = db.prepare(`
    INSERT INTO practice_quiz_questions
      (spec_id, position, difficulty, prompt, options_json, answer_index, explanation, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  for (const question of questions) {
    insertQuestion.run(
      spec.id,
      question.position,
      question.difficulty,
      question.prompt,
      JSON.stringify(question.options),
      question.answerIndex,
      question.explanation,
      JSON.stringify(question.tags ?? []),
    );
  }

  return { specId: spec.id, questionCount: questions.length };
});

const result = seed();
console.log(`Seeded quiz spec ${quizSpec.slug} (id=${result.specId}) with ${result.questionCount} questions.`);
