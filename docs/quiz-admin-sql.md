# Quiz Spec SQL Cheatsheet

These tables are created automatically by `applySchema`:

- `practice_quiz_specs`
- `practice_quiz_questions`

Use this SQL directly in SQLite if you want to manage quiz content without API calls.

## 1) Create or update a quiz spec

```sql
INSERT INTO practice_quiz_specs
  (slug, mode, track_id, module_id, title, description_markdown, default_duration_mins, is_active, created_at, updated_at)
VALUES
  ('system-design-mcq', 'system-design-mcq', 'system-design', 'system-design-mcq',
   'System Design MCQ Set', 'Tradeoff practice prompts.', 30, 1, datetime('now'), datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
  mode = excluded.mode,
  track_id = excluded.track_id,
  module_id = excluded.module_id,
  title = excluded.title,
  description_markdown = excluded.description_markdown,
  default_duration_mins = excluded.default_duration_mins,
  is_active = excluded.is_active,
  updated_at = datetime('now');
```

## 2) Add questions to a spec

```sql
INSERT INTO practice_quiz_questions
  (spec_id, position, difficulty, prompt, options_json, answer_index, explanation, created_at, updated_at)
VALUES
  (
    (SELECT id FROM practice_quiz_specs WHERE slug = 'system-design-mcq'),
    1,
    'Medium',
    'Payment clients retry on timeout. Where should idempotency live?',
    '["Client only","Server write boundary","CDN edge","DNS"]',
    1,
    'Server-side idempotency avoids duplicate writes/charges.',
    datetime('now'),
    datetime('now')
  );
```

## 3) Replace all questions for a spec

```sql
DELETE FROM practice_quiz_questions
WHERE spec_id = (SELECT id FROM practice_quiz_specs WHERE slug = 'system-design-mcq');
```

Then re-insert your new question set.

## 4) Disable a spec without deleting it

```sql
UPDATE practice_quiz_specs
SET is_active = 0, updated_at = datetime('now')
WHERE slug = 'system-design-mcq';
```
