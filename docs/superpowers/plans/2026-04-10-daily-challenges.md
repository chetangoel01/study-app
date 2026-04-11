# Daily Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub daily challenge experience with a fully functional in-app Python code editor at `/practice/challenge/:id`, backed by the Piston API for real code execution against stored test cases.

**Architecture:** The existing `SolveChallengePage.tsx` (already has Monaco + ReactMarkdown) is overhauled to use a route param `/:id`, a new `useChallenge(id)` hook, and per-test result display. The server gains a Piston execution service, admin CRUD routes for the challenge pool, and a seed script for 30 classic LeetCode problems. Schema migration adds `function_name`, `test_cases`, and `tags` columns to `daily_challenge_pool`.

**Tech Stack:** Hono + better-sqlite3 (server), React + Monaco Editor + ReactMarkdown (client), Piston public API (`emkc.org/api/v2/piston/execute`, no key needed), Vitest (tests), tsx (seed script runner).

---

## File Map

### New files
| File | Purpose |
|---|---|
| `server/src/services/piston.ts` | Harness builder + Piston HTTP call |
| `server/src/services/piston.test.ts` | Tests for harness builder |
| `server/src/routes/admin.ts` | CRUD routes for `daily_challenge_pool` |
| `server/src/routes/admin.test.ts` | Tests for admin routes |
| `server/src/db/seed-challenges.ts` | One-time seed script (30 problems) |
| `client/src/components/TestResultsPanel.tsx` | Per-test pass/fail display |

### Modified files
| File | Change |
|---|---|
| `server/src/db/schema.ts` | Add `function_name`, `test_cases`, `tags` columns via `addCol` |
| `server/src/db/schema.test.ts` | Add column-presence tests |
| `server/src/routes/practice.ts` | Add `GET /challenge/:id`; replace submit stub with Piston |
| `server/src/routes/practice.test.ts` | Add tests for new routes (create if missing) |
| `server/src/index.ts` | Mount admin router at `/api/admin` |
| `server/package.json` | Add `seed:challenges` script |
| `client/src/hooks/usePractice.ts` | Add `useChallenge(id)` hook |
| `client/src/pages/SolveChallengePage.tsx` | Full overhaul: Python Monaco, timer, Run/Submit, TestResultsPanel |
| `client/src/main.tsx` | Change route from `practice/challenge` → `practice/challenge/:id` |
| `client/src/pages/PracticePage.tsx` | Change "Solve Challenge" button to `navigate(...)` |
| `client/src/index.css` | Add `.solve-*` and `.test-results-*` CSS |

---

## Task 1: Schema Migration

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/db/schema.test.ts`

### Steps

- [ ] **Step 1: Add three columns to `daily_challenge_pool` via `addCol`**

In `server/src/db/schema.ts`, add three lines inside the `applySchema` function after the existing `addCol` calls:

```typescript
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN function_name TEXT DEFAULT ''");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN test_cases TEXT DEFAULT '[]'");
  addCol("ALTER TABLE daily_challenge_pool ADD COLUMN tags TEXT DEFAULT '[]'");
```

- [ ] **Step 2: Add column-presence test**

In `server/src/db/schema.test.ts`, add a new `it` block inside the existing `describe('applySchema', ...)`:

```typescript
  it('daily_challenge_pool has function_name, test_cases, and tags columns', () => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare(`
      INSERT INTO daily_challenge_pool (title, active_date, function_name, test_cases, tags)
      VALUES ('Test', '2026-01-01', 'solve', '[]', '[]')
    `).run();
    const row = db.prepare('SELECT function_name, test_cases, tags FROM daily_challenge_pool LIMIT 1').get() as any;
    expect(row.function_name).toBe('solve');
    expect(row.test_cases).toBe('[]');
    expect(row.tags).toBe('[]');
  });
```

- [ ] **Step 3: Run schema tests**

```bash
cd server && npx vitest run src/db/schema.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/schema.ts server/src/db/schema.test.ts
git commit -m "feat: add function_name, test_cases, tags columns to daily_challenge_pool"
```

---

## Task 2: Piston Execution Service

**Files:**
- Create: `server/src/services/piston.ts`
- Create: `server/src/services/piston.test.ts`

### Steps

- [ ] **Step 1: Write failing test for `buildHarness`**

Create `server/src/services/piston.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildHarness } from './piston.js';

describe('buildHarness', () => {
  it('includes user code verbatim', () => {
    const harness = buildHarness('def two_sum(nums, t):\n    return []', [{ args: [[1, 2], 3], expected: [0, 1] }], 'two_sum');
    expect(harness).toContain('def two_sum(nums, t):');
  });

  it('injects test cases as JSON literal', () => {
    const cases = [{ args: [[1, 2], 3], expected: [0, 1] }];
    const harness = buildHarness('', cases, 'two_sum');
    expect(harness).toContain(JSON.stringify(cases));
  });

  it('calls the function with spread args', () => {
    const harness = buildHarness('', [{ args: [42], expected: true }], 'is_power_of_two');
    expect(harness).toContain('is_power_of_two');
    expect(harness).toContain('*_case["args"]');
  });

  it('prints JSON to stdout', () => {
    const harness = buildHarness('', [], 'fn');
    expect(harness).toContain('print(_json.dumps(_results))');
  });
});
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
cd server && npx vitest run src/services/piston.test.ts
```

Expected: FAIL — `Cannot find module './piston.js'`.

- [ ] **Step 3: Create `server/src/services/piston.ts`**

```typescript
export interface TestCase {
  args: unknown[];
  expected: unknown;
}

export interface TestResult {
  passed: boolean;
  output: string;
  expected: string;
}

export function buildHarness(userCode: string, testCases: TestCase[], functionName: string): string {
  const casesJson = JSON.stringify(testCases);
  return `${userCode}

import _json as _json
_results = []
_cases = _json.loads(${JSON.stringify(casesJson)})
for _case in _cases:
    try:
        _result = ${functionName}(*_case["args"])
        _results.append({
            "passed": _result == _case["expected"],
            "output": repr(_result),
            "expected": repr(_case["expected"])
        })
    except Exception as _e:
        _results.append({
            "passed": False,
            "output": str(_e),
            "expected": repr(_case["expected"])
        })
print(_json.dumps(_results))
`;
}

export async function runWithPiston(harness: string): Promise<TestResult[]> {
  let response: Response;
  try {
    response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'python',
        version: '3.10.0',
        files: [{ content: harness }],
      }),
    });
  } catch {
    throw new Error('Execution service unavailable');
  }

  if (!response.ok) {
    throw new Error('Execution service unavailable');
  }

  const data = await response.json() as {
    run: { stdout: string; stderr: string; output: string };
    compile?: { stderr: string };
  };

  const stderr = data.compile?.stderr || data.run?.stderr || '';
  const stdout = data.run?.stdout?.trim() ?? '';

  if (!stdout) {
    const errorMsg = stderr || 'No output returned';
    return [{ passed: false, output: errorMsg, expected: '' }];
  }

  try {
    return JSON.parse(stdout) as TestResult[];
  } catch {
    return [{ passed: false, output: stdout, expected: '' }];
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/services/piston.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/piston.ts server/src/services/piston.test.ts
git commit -m "feat: add Piston execution service with harness builder"
```

---

## Task 3: Admin Routes

**Files:**
- Create: `server/src/routes/admin.ts`
- Create: `server/src/routes/admin.test.ts`

### Steps

- [ ] **Step 1: Write failing tests**

Create `server/src/routes/admin.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeAdminRouter } from './admin.js';

let db: Database.Database;
let app: Hono;

beforeEach(async () => {
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
    const data = await res.json() as any;
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
    const row = db.prepare('SELECT title FROM daily_challenge_pool WHERE id = ?').get(id) as any;
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
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd server && npx vitest run src/routes/admin.test.ts
```

Expected: FAIL — `Cannot find module './admin.js'`.

- [ ] **Step 3: Create `server/src/routes/admin.ts`**

```typescript
import { Hono } from 'hono';
import type Database from 'better-sqlite3';

export function makeAdminRouter(db: Database.Database): Hono {
  const router = new Hono();

  router.use('*', (c, next) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || c.req.header('X-Admin-Secret') !== secret) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return next();
  });

  router.get('/challenges', (c) => {
    const rows = db.prepare('SELECT * FROM daily_challenge_pool ORDER BY active_date DESC').all() as any[];
    return c.json(rows.map(toChallenge));
  });

  router.post('/challenges', async (c) => {
    const body = await c.req.json().catch(() => null);
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
    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(result.lastInsertRowid) as any;
    return c.json(toChallenge(row), 201);
  });

  router.put('/challenges/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'Invalid body' }, 400);
    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as any;
    if (!row) return c.json({ error: 'Not found' }, 404);
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
    const updated = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as any;
    return c.json(toChallenge(updated));
  });

  router.delete('/challenges/:id', (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare('SELECT id FROM daily_challenge_pool WHERE id = ?').get(id);
    if (!row) return c.json({ error: 'Not found' }, 404);
    db.prepare('DELETE FROM daily_challenge_pool WHERE id = ?').run(id);
    return c.json({ ok: true });
  });

  return router;
}

function toChallenge(row: any) {
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/admin.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/admin.ts server/src/routes/admin.test.ts
git commit -m "feat: add admin CRUD routes for daily_challenge_pool"
```

---

## Task 4: Update Practice Routes

**Files:**
- Modify: `server/src/routes/practice.ts`
- Create: `server/src/routes/practice.test.ts`

### Steps

- [ ] **Step 1: Write failing tests**

Create `server/src/routes/practice.test.ts`:

```typescript
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
    'Two Sum', 'Easy', 'https://leetcode.com/problems/two-sum/',
    '## Two Sum\n\nGiven an array.', 'def two_sum(nums, target):\n    pass',
    'two_sum', JSON.stringify([{ args: [[2, 7, 11, 15], 9], expected: [0, 1] }]),
    JSON.stringify(['arrays']), 30, '2026-01-01',
  );
});

afterEach(() => db.close());

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
    }));

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

    vi.unstubAllGlobals();
  });

  it('records completion when submit=true and all tests pass', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        run: { stdout: JSON.stringify([{ passed: true, output: '[0, 1]', expected: '[0, 1]' }]), stderr: '' },
      }),
    }));

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

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd server && npx vitest run src/routes/practice.test.ts
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 3: Add routes to `server/src/routes/practice.ts`**

Add these two imports at the top of the file (after the existing imports):

```typescript
import { buildHarness, runWithPiston } from '../services/piston.js';
```

Then add two new route handlers inside `makePracticeRouter`, **before** the `return router;` line. Replace the existing `router.post('/challenge/submit', ...)` handler entirely with the new submit route below:

```typescript
  // Get challenge by ID
  router.get('/challenge/:id', (c) => {
    const id = Number(c.req.param('id'));
    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as any;
    if (!row) return c.json({ error: 'Not found' }, 404);

    const user = c.get('user');
    const completion = db.prepare(
      'SELECT completed_at FROM daily_challenge_completions WHERE user_id = ? AND challenge_id = ?'
    ).get(user.id, row.id) as any;

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
      completed: !!completion,
      completedAt: completion?.completed_at ?? null,
    });
  });

  // Submit code for a challenge
  router.post('/challenge/:id/submit', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const { code, submit } = await c.req.json().catch(() => ({ code: null, submit: false }));
    if (!code) return c.json({ error: 'Missing code' }, 400);

    const row = db.prepare('SELECT * FROM daily_challenge_pool WHERE id = ?').get(id) as any;
    if (!row) return c.json({ error: 'Not found' }, 404);

    const testCases = JSON.parse(row.test_cases ?? '[]');
    const harness = buildHarness(code, testCases, row.function_name || 'solve');

    let results;
    try {
      results = await runWithPiston(harness);
    } catch {
      return c.json({ error: 'Execution service unavailable' }, 502);
    }

    const allPassed = results.length > 0 && results.every((r) => r.passed);

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
```

Also **delete** the old `router.post('/challenge/submit', ...)` handler that was there before (the mock one that just checked `code.includes('return')`).

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/practice.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/practice.ts server/src/routes/practice.test.ts
git commit -m "feat: add GET /challenge/:id and real submit route via Piston"
```

---

## Task 5: Mount Admin Router + Fix PracticePage Navigation

**Files:**
- Modify: `server/src/index.ts`
- Modify: `client/src/pages/PracticePage.tsx`

### Steps

- [ ] **Step 1: Mount admin router in `server/src/index.ts`**

Add this import near the other route imports (around line 13):

```typescript
import { makeAdminRouter } from './routes/admin.js';
```

Add this mount line after the existing `app.route('/api/practice', ...)` line:

```typescript
app.route('/api/admin', makeAdminRouter(db));
```

- [ ] **Step 2: Update "Solve Challenge" button in `client/src/pages/PracticePage.tsx`**

Find this block in `PracticePage.tsx` (around line 81–91):

```typescript
                onClick={() => {
                    if (dailyChallenge?.leetcodeUrl) {
                      window.open(dailyChallenge.leetcodeUrl, '_blank');
                      markComplete().then(refetchStats);
                    }
                  }}
```

Replace it with:

```typescript
                onClick={() => {
                    if (dailyChallenge?.id) {
                      navigate(`/practice/challenge/${dailyChallenge.id}`);
                    }
                  }}
```

Also update the button text/disabled logic. Find:

```typescript
                  {dailyChallenge?.completed ? 'Completed ✓' : dailyChallenge?.leetcodeUrl ? 'Solve Challenge' : 'Coming Soon'}
                  {!dailyChallenge?.completed && dailyChallenge?.leetcodeUrl && <span className="practice-btn-icon">→</span>}
```

Replace with:

```typescript
                  {dailyChallenge?.completed ? 'Completed ✓' : dailyChallenge?.id ? 'Solve Challenge' : 'Coming Soon'}
                  {!dailyChallenge?.completed && dailyChallenge?.id && <span className="practice-btn-icon">→</span>}
```

Also update the `disabled` and `className` on the button. Find:

```typescript
                  className={`practice-btn-solve ${dailyChallenge?.completed ? 'completed' : ''} ${!dailyChallenge?.leetcodeUrl ? 'disabled' : ''}`}
                  disabled={!dailyChallenge?.leetcodeUrl || dailyChallenge?.completed}
```

Replace with:

```typescript
                  className={`practice-btn-solve ${dailyChallenge?.completed ? 'completed' : ''} ${!dailyChallenge?.id ? 'disabled' : ''}`}
                  disabled={!dailyChallenge?.id || dailyChallenge?.completed}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts client/src/pages/PracticePage.tsx
git commit -m "feat: mount admin router; navigate to challenge page from practice hero"
```

---

## Task 6: Seed Script

**Files:**
- Create: `server/src/db/seed-challenges.ts`
- Modify: `server/package.json`

### Steps

- [ ] **Step 1: Create `server/src/db/seed-challenges.ts`**

```typescript
import { createDb } from './client.js';

const db = createDb();

const challenges = [
  // ── Easy ──────────────────────────────────────────────────────────────
  {
    title: 'Two Sum',
    difficulty: 'Easy',
    functionName: 'two_sum',
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    descriptionMarkdown: `## Two Sum\n\nGiven an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.\n\nYou may assume each input has exactly one solution. Return the indices in ascending order.\n\n**Example:**\n\`\`\`\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n\`\`\``,
    starterCode: `def two_sum(nums, target):\n    pass`,
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
    ],
    tags: ['arrays', 'hash-map'],
    durationMins: 25,
    activeDate: '2026-04-10',
  },
  {
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    functionName: 'is_valid',
    leetcodeUrl: 'https://leetcode.com/problems/valid-parentheses/',
    descriptionMarkdown: `## Valid Parentheses\n\nGiven a string \`s\` containing \`(\`, \`)\`, \`{\`, \`}\`, \`[\`, \`]\`, determine if it is valid.\n\nA string is valid if open brackets are closed by the same type in the correct order.\n\n**Example:**\n\`\`\`\nInput: s = "()[]{}"\nOutput: True\n\`\`\``,
    starterCode: `def is_valid(s):\n    pass`,
    testCases: [
      { args: ['()'], expected: true },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([)]'], expected: false },
    ],
    tags: ['stack', 'strings'],
    durationMins: 20,
    activeDate: '2026-04-11',
  },
  {
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    functionName: 'max_profit',
    leetcodeUrl: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    descriptionMarkdown: `## Best Time to Buy and Sell Stock\n\nGiven an array \`prices\` where \`prices[i]\` is the price on day \`i\`, return the maximum profit from buying and selling once. Return \`0\` if no profit is possible.\n\n**Example:**\n\`\`\`\nInput: prices = [7,1,5,3,6,4]\nOutput: 5\n\`\`\``,
    starterCode: `def max_profit(prices):\n    pass`,
    testCases: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[1, 2]], expected: 1 },
    ],
    tags: ['arrays', 'greedy'],
    durationMins: 20,
    activeDate: '2026-04-12',
  },
  {
    title: 'Contains Duplicate',
    difficulty: 'Easy',
    functionName: 'contains_duplicate',
    leetcodeUrl: 'https://leetcode.com/problems/contains-duplicate/',
    descriptionMarkdown: `## Contains Duplicate\n\nGiven an integer array \`nums\`, return \`True\` if any value appears at least twice, and \`False\` if every element is distinct.\n\n**Example:**\n\`\`\`\nInput: nums = [1,2,3,1]\nOutput: True\n\`\`\``,
    starterCode: `def contains_duplicate(nums):\n    pass`,
    testCases: [
      { args: [[1, 2, 3, 1]], expected: true },
      { args: [[1, 2, 3, 4]], expected: false },
      { args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
    ],
    tags: ['arrays', 'hash-set'],
    durationMins: 15,
    activeDate: '2026-04-13',
  },
  {
    title: 'Maximum Subarray',
    difficulty: 'Easy',
    functionName: 'max_subarray',
    leetcodeUrl: 'https://leetcode.com/problems/maximum-subarray/',
    descriptionMarkdown: `## Maximum Subarray\n\nGiven an integer array \`nums\`, find the subarray with the largest sum and return its sum.\n\n**Example:**\n\`\`\`\nInput: nums = [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6  # subarray [4,-1,2,1]\n\`\`\``,
    starterCode: `def max_subarray(nums):\n    pass`,
    testCases: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
    tags: ['arrays', 'dynamic-programming'],
    durationMins: 25,
    activeDate: '2026-04-14',
  },
  {
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    functionName: 'climb_stairs',
    leetcodeUrl: 'https://leetcode.com/problems/climbing-stairs/',
    descriptionMarkdown: `## Climbing Stairs\n\nYou are climbing a staircase with \`n\` steps. Each time you can climb 1 or 2 steps. How many distinct ways can you climb to the top?\n\n**Example:**\n\`\`\`\nInput: n = 3\nOutput: 3  # (1,1,1), (1,2), (2,1)\n\`\`\``,
    starterCode: `def climb_stairs(n):\n    pass`,
    testCases: [
      { args: [2], expected: 2 },
      { args: [3], expected: 3 },
      { args: [5], expected: 8 },
    ],
    tags: ['dynamic-programming', 'math'],
    durationMins: 20,
    activeDate: '2026-04-15',
  },
  {
    title: 'Single Number',
    difficulty: 'Easy',
    functionName: 'single_number',
    leetcodeUrl: 'https://leetcode.com/problems/single-number/',
    descriptionMarkdown: `## Single Number\n\nGiven a non-empty array of integers where every element appears twice except for one, find that single one.\n\nSolve in O(n) time and O(1) space.\n\n**Example:**\n\`\`\`\nInput: nums = [4,1,2,1,2]\nOutput: 4\n\`\`\``,
    starterCode: `def single_number(nums):\n    pass`,
    testCases: [
      { args: [[2, 2, 1]], expected: 1 },
      { args: [[4, 1, 2, 1, 2]], expected: 4 },
      { args: [[1]], expected: 1 },
    ],
    tags: ['arrays', 'bit-manipulation'],
    durationMins: 20,
    activeDate: '2026-04-16',
  },
  {
    title: 'Missing Number',
    difficulty: 'Easy',
    functionName: 'missing_number',
    leetcodeUrl: 'https://leetcode.com/problems/missing-number/',
    descriptionMarkdown: `## Missing Number\n\nGiven an array \`nums\` containing \`n\` distinct numbers in the range \`[0, n]\`, return the only number in the range that is missing.\n\n**Example:**\n\`\`\`\nInput: nums = [3,0,1]\nOutput: 2\n\`\`\``,
    starterCode: `def missing_number(nums):\n    pass`,
    testCases: [
      { args: [[3, 0, 1]], expected: 2 },
      { args: [[0, 1]], expected: 2 },
      { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expected: 8 },
    ],
    tags: ['arrays', 'math'],
    durationMins: 20,
    activeDate: '2026-04-17',
  },
  {
    title: 'Palindrome Number',
    difficulty: 'Easy',
    functionName: 'is_palindrome_number',
    leetcodeUrl: 'https://leetcode.com/problems/palindrome-number/',
    descriptionMarkdown: `## Palindrome Number\n\nGiven an integer \`x\`, return \`True\` if \`x\` is a palindrome, and \`False\` otherwise.\n\nAn integer is a palindrome when it reads the same forward and backward.\n\n**Example:**\n\`\`\`\nInput: x = 121\nOutput: True\n\`\`\``,
    starterCode: `def is_palindrome_number(x):\n    pass`,
    testCases: [
      { args: [121], expected: true },
      { args: [-121], expected: false },
      { args: [10], expected: false },
      { args: [0], expected: true },
    ],
    tags: ['math'],
    durationMins: 15,
    activeDate: '2026-04-18',
  },
  {
    title: 'Power of Two',
    difficulty: 'Easy',
    functionName: 'is_power_of_two',
    leetcodeUrl: 'https://leetcode.com/problems/power-of-two/',
    descriptionMarkdown: `## Power of Two\n\nGiven an integer \`n\`, return \`True\` if it is a power of two, otherwise return \`False\`.\n\n**Example:**\n\`\`\`\nInput: n = 16\nOutput: True\n\`\`\``,
    starterCode: `def is_power_of_two(n):\n    pass`,
    testCases: [
      { args: [1], expected: true },
      { args: [16], expected: true },
      { args: [3], expected: false },
      { args: [0], expected: false },
    ],
    tags: ['math', 'bit-manipulation'],
    durationMins: 15,
    activeDate: '2026-04-19',
  },
  {
    title: 'Roman to Integer',
    difficulty: 'Easy',
    functionName: 'roman_to_int',
    leetcodeUrl: 'https://leetcode.com/problems/roman-to-integer/',
    descriptionMarkdown: `## Roman to Integer\n\nGiven a Roman numeral string \`s\`, convert it to an integer.\n\nRoman numerals: I=1, V=5, X=10, L=50, C=100, D=500, M=1000. Subtraction rules apply (e.g. IV=4, IX=9).\n\n**Example:**\n\`\`\`\nInput: s = "MCMXCIV"\nOutput: 1994\n\`\`\``,
    starterCode: `def roman_to_int(s):\n    pass`,
    testCases: [
      { args: ['III'], expected: 3 },
      { args: ['LVIII'], expected: 58 },
      { args: ['MCMXCIV'], expected: 1994 },
    ],
    tags: ['strings', 'math'],
    durationMins: 20,
    activeDate: '2026-04-20',
  },
  {
    title: 'First Unique Character in a String',
    difficulty: 'Easy',
    functionName: 'first_uniq_char',
    leetcodeUrl: 'https://leetcode.com/problems/first-unique-character-in-a-string/',
    descriptionMarkdown: `## First Unique Character\n\nGiven a string \`s\`, find the first non-repeating character and return its index. If it does not exist, return \`-1\`.\n\n**Example:**\n\`\`\`\nInput: s = "leetcode"\nOutput: 0\n\`\`\``,
    starterCode: `def first_uniq_char(s):\n    pass`,
    testCases: [
      { args: ['leetcode'], expected: 0 },
      { args: ['loveleetcode'], expected: 2 },
      { args: ['aabb'], expected: -1 },
    ],
    tags: ['strings', 'hash-map'],
    durationMins: 20,
    activeDate: '2026-04-21',
  },
  {
    title: 'Counting Bits',
    difficulty: 'Easy',
    functionName: 'count_bits',
    leetcodeUrl: 'https://leetcode.com/problems/counting-bits/',
    descriptionMarkdown: `## Counting Bits\n\nGiven an integer \`n\`, return an array \`ans\` of length \`n + 1\` such that for each \`i\` (0 ≤ i ≤ n), \`ans[i]\` is the number of 1's in the binary representation of \`i\`.\n\n**Example:**\n\`\`\`\nInput: n = 5\nOutput: [0,1,1,2,1,2]\n\`\`\``,
    starterCode: `def count_bits(n):\n    pass`,
    testCases: [
      { args: [2], expected: [0, 1, 1] },
      { args: [5], expected: [0, 1, 1, 2, 1, 2] },
    ],
    tags: ['dynamic-programming', 'bit-manipulation'],
    durationMins: 20,
    activeDate: '2026-04-22',
  },
  {
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    functionName: 'is_palindrome',
    leetcodeUrl: 'https://leetcode.com/problems/valid-palindrome/',
    descriptionMarkdown: `## Valid Palindrome\n\nA phrase is a palindrome if, after converting all uppercase letters to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string \`s\`, return \`True\` if it is a palindrome, otherwise \`False\`.\n\n**Example:**\n\`\`\`\nInput: s = "A man, a plan, a canal: Panama"\nOutput: True\n\`\`\``,
    starterCode: `def is_palindrome(s):\n    pass`,
    testCases: [
      { args: ['A man, a plan, a canal: Panama'], expected: true },
      { args: ['race a car'], expected: false },
      { args: [' '], expected: true },
    ],
    tags: ['strings', 'two-pointers'],
    durationMins: 20,
    activeDate: '2026-04-23',
  },
  {
    title: 'Fizz Buzz',
    difficulty: 'Easy',
    functionName: 'fizz_buzz',
    leetcodeUrl: 'https://leetcode.com/problems/fizz-buzz/',
    descriptionMarkdown: `## Fizz Buzz\n\nGiven an integer \`n\`, return a list of strings for numbers 1 to n:\n- "FizzBuzz" for multiples of both 3 and 5\n- "Fizz" for multiples of 3\n- "Buzz" for multiples of 5\n- The number itself otherwise\n\n**Example:**\n\`\`\`\nInput: n = 5\nOutput: ["1","2","Fizz","4","Buzz"]\n\`\`\``,
    starterCode: `def fizz_buzz(n):\n    pass`,
    testCases: [
      { args: [3], expected: ['1', '2', 'Fizz'] },
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
      { args: [15], expected: ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz'] },
    ],
    tags: ['math', 'strings'],
    durationMins: 15,
    activeDate: '2026-04-24',
  },
  // ── Medium ────────────────────────────────────────────────────────────
  {
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    functionName: 'length_of_longest_substring',
    leetcodeUrl: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    descriptionMarkdown: `## Longest Substring Without Repeating Characters\n\nGiven a string \`s\`, find the length of the longest substring without repeating characters.\n\n**Example:**\n\`\`\`\nInput: s = "abcabcbb"\nOutput: 3  # "abc"\n\`\`\``,
    starterCode: `def length_of_longest_substring(s):\n    pass`,
    testCases: [
      { args: ['abcabcbb'], expected: 3 },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3 },
      { args: [''], expected: 0 },
    ],
    tags: ['strings', 'sliding-window', 'hash-map'],
    durationMins: 30,
    activeDate: '2026-04-25',
  },
  {
    title: 'Container With Most Water',
    difficulty: 'Medium',
    functionName: 'max_area',
    leetcodeUrl: 'https://leetcode.com/problems/container-with-most-water/',
    descriptionMarkdown: `## Container With Most Water\n\nGiven an array \`height\` of \`n\` non-negative integers, find two lines that together with the x-axis form a container holding the most water. Return the maximum amount of water.\n\n**Example:**\n\`\`\`\nInput: height = [1,8,6,2,5,4,8,3,7]\nOutput: 49\n\`\`\``,
    starterCode: `def max_area(height):\n    pass`,
    testCases: [
      { args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], expected: 49 },
      { args: [[1, 1]], expected: 1 },
    ],
    tags: ['arrays', 'two-pointers', 'greedy'],
    durationMins: 30,
    activeDate: '2026-04-26',
  },
  {
    title: 'Product of Array Except Self',
    difficulty: 'Medium',
    functionName: 'product_except_self',
    leetcodeUrl: 'https://leetcode.com/problems/product-of-array-except-self/',
    descriptionMarkdown: `## Product of Array Except Self\n\nGiven an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is the product of all elements except \`nums[i]\`. Solve in O(n) without using division.\n\n**Example:**\n\`\`\`\nInput: nums = [1,2,3,4]\nOutput: [24,12,8,6]\n\`\`\``,
    starterCode: `def product_except_self(nums):\n    pass`,
    testCases: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
    ],
    tags: ['arrays', 'prefix-sum'],
    durationMins: 30,
    activeDate: '2026-04-27',
  },
  {
    title: 'Find Minimum in Rotated Sorted Array',
    difficulty: 'Medium',
    functionName: 'find_min',
    leetcodeUrl: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/',
    descriptionMarkdown: `## Find Minimum in Rotated Sorted Array\n\nGiven a sorted array rotated at some pivot, find the minimum element. The array has no duplicates.\n\n**Example:**\n\`\`\`\nInput: nums = [3,4,5,1,2]\nOutput: 1\n\`\`\``,
    starterCode: `def find_min(nums):\n    pass`,
    testCases: [
      { args: [[3, 4, 5, 1, 2]], expected: 1 },
      { args: [[4, 5, 6, 7, 0, 1, 2]], expected: 0 },
      { args: [[11, 13, 15, 17]], expected: 11 },
    ],
    tags: ['arrays', 'binary-search'],
    durationMins: 30,
    activeDate: '2026-04-28',
  },
  {
    title: 'Jump Game',
    difficulty: 'Medium',
    functionName: 'can_jump',
    leetcodeUrl: 'https://leetcode.com/problems/jump-game/',
    descriptionMarkdown: `## Jump Game\n\nGiven an integer array \`nums\` where \`nums[i]\` is the max jump length from position \`i\`, return \`True\` if you can reach the last index starting from index 0.\n\n**Example:**\n\`\`\`\nInput: nums = [2,3,1,1,4]\nOutput: True\n\`\`\``,
    starterCode: `def can_jump(nums):\n    pass`,
    testCases: [
      { args: [[2, 3, 1, 1, 4]], expected: true },
      { args: [[3, 2, 1, 0, 4]], expected: false },
      { args: [[0]], expected: true },
    ],
    tags: ['arrays', 'greedy'],
    durationMins: 30,
    activeDate: '2026-04-29',
  },
  {
    title: 'Coin Change',
    difficulty: 'Medium',
    functionName: 'coin_change',
    leetcodeUrl: 'https://leetcode.com/problems/coin-change/',
    descriptionMarkdown: `## Coin Change\n\nGiven an array of coin denominations \`coins\` and an integer \`amount\`, return the fewest number of coins needed to make up \`amount\`. Return \`-1\` if it's not possible.\n\n**Example:**\n\`\`\`\nInput: coins = [1,2,5], amount = 11\nOutput: 3  # 5+5+1\n\`\`\``,
    starterCode: `def coin_change(coins, amount):\n    pass`,
    testCases: [
      { args: [[1, 2, 5], 11], expected: 3 },
      { args: [[2], 3], expected: -1 },
      { args: [[1], 0], expected: 0 },
      { args: [[1, 5, 11], 11], expected: 1 },
    ],
    tags: ['dynamic-programming'],
    durationMins: 35,
    activeDate: '2026-04-30',
  },
  {
    title: 'Unique Paths',
    difficulty: 'Medium',
    functionName: 'unique_paths',
    leetcodeUrl: 'https://leetcode.com/problems/unique-paths/',
    descriptionMarkdown: `## Unique Paths\n\nA robot starts at the top-left corner of an \`m x n\` grid and can only move right or down. How many unique paths are there to the bottom-right corner?\n\n**Example:**\n\`\`\`\nInput: m = 3, n = 7\nOutput: 28\n\`\`\``,
    starterCode: `def unique_paths(m, n):\n    pass`,
    testCases: [
      { args: [3, 7], expected: 28 },
      { args: [3, 2], expected: 3 },
      { args: [1, 1], expected: 1 },
    ],
    tags: ['dynamic-programming', 'math'],
    durationMins: 25,
    activeDate: '2026-05-01',
  },
  {
    title: 'House Robber',
    difficulty: 'Medium',
    functionName: 'rob',
    leetcodeUrl: 'https://leetcode.com/problems/house-robber/',
    descriptionMarkdown: `## House Robber\n\nGiven an array \`nums\` of non-negative integers representing the amount of money in each house, return the maximum amount you can rob without robbing two adjacent houses.\n\n**Example:**\n\`\`\`\nInput: nums = [2,7,9,3,1]\nOutput: 12\n\`\`\``,
    starterCode: `def rob(nums):\n    pass`,
    testCases: [
      { args: [[1, 2, 3, 1]], expected: 4 },
      { args: [[2, 7, 9, 3, 1]], expected: 12 },
      { args: [[0]], expected: 0 },
    ],
    tags: ['dynamic-programming'],
    durationMins: 30,
    activeDate: '2026-05-02',
  },
  {
    title: 'Decode Ways',
    difficulty: 'Medium',
    functionName: 'num_decodings',
    leetcodeUrl: 'https://leetcode.com/problems/decode-ways/',
    descriptionMarkdown: `## Decode Ways\n\nA message is encoded where \`A→1\`, \`B→2\`, …, \`Z→26\`. Given a string \`s\` of digits, return the number of ways to decode it.\n\n**Example:**\n\`\`\`\nInput: s = "226"\nOutput: 3  # "BZ", "VF", "BBF"\n\`\`\``,
    starterCode: `def num_decodings(s):\n    pass`,
    testCases: [
      { args: ['12'], expected: 2 },
      { args: ['226'], expected: 3 },
      { args: ['06'], expected: 0 },
    ],
    tags: ['dynamic-programming', 'strings'],
    durationMins: 35,
    activeDate: '2026-05-03',
  },
  {
    title: 'Word Break',
    difficulty: 'Medium',
    functionName: 'word_break',
    leetcodeUrl: 'https://leetcode.com/problems/word-break/',
    descriptionMarkdown: `## Word Break\n\nGiven a string \`s\` and a list \`word_dict\`, return \`True\` if \`s\` can be segmented into one or more space-separated words from \`word_dict\`.\n\n**Example:**\n\`\`\`\nInput: s = "leetcode", word_dict = ["leet","code"]\nOutput: True\n\`\`\``,
    starterCode: `def word_break(s, word_dict):\n    pass`,
    testCases: [
      { args: ['leetcode', ['leet', 'code']], expected: true },
      { args: ['applepenapple', ['apple', 'pen']], expected: true },
      { args: ['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], expected: false },
    ],
    tags: ['dynamic-programming', 'strings'],
    durationMins: 35,
    activeDate: '2026-05-04',
  },
  {
    title: 'Maximum Product Subarray',
    difficulty: 'Medium',
    functionName: 'max_product',
    leetcodeUrl: 'https://leetcode.com/problems/maximum-product-subarray/',
    descriptionMarkdown: `## Maximum Product Subarray\n\nGiven an integer array \`nums\`, find the contiguous subarray with the largest product and return the product.\n\n**Example:**\n\`\`\`\nInput: nums = [2,3,-2,4]\nOutput: 6  # [2,3]\n\`\`\``,
    starterCode: `def max_product(nums):\n    pass`,
    testCases: [
      { args: [[2, 3, -2, 4]], expected: 6 },
      { args: [[-2, 0, -1]], expected: 0 },
      { args: [[-2, 3, -4]], expected: 24 },
    ],
    tags: ['arrays', 'dynamic-programming'],
    durationMins: 30,
    activeDate: '2026-05-05',
  },
  // ── Hard ──────────────────────────────────────────────────────────────
  {
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    functionName: 'trap',
    leetcodeUrl: 'https://leetcode.com/problems/trapping-rain-water/',
    descriptionMarkdown: `## Trapping Rain Water\n\nGiven \`n\` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water can be trapped after raining.\n\n**Example:**\n\`\`\`\nInput: height = [0,1,0,2,1,0,1,3,2,1,2,1]\nOutput: 6\n\`\`\``,
    starterCode: `def trap(height):\n    pass`,
    testCases: [
      { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6 },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 9 },
    ],
    tags: ['arrays', 'two-pointers', 'dynamic-programming'],
    durationMins: 45,
    activeDate: '2026-05-06',
  },
  {
    title: 'Longest Valid Parentheses',
    difficulty: 'Hard',
    functionName: 'longest_valid_parentheses',
    leetcodeUrl: 'https://leetcode.com/problems/longest-valid-parentheses/',
    descriptionMarkdown: `## Longest Valid Parentheses\n\nGiven a string \`s\` containing only \`(\` and \`)\`, return the length of the longest valid (well-formed) parentheses substring.\n\n**Example:**\n\`\`\`\nInput: s = ")()())"\nOutput: 4\n\`\`\``,
    starterCode: `def longest_valid_parentheses(s):\n    pass`,
    testCases: [
      { args: ['(()'], expected: 2 },
      { args: [')()())'], expected: 4 },
      { args: [''], expected: 0 },
    ],
    tags: ['strings', 'stack', 'dynamic-programming'],
    durationMins: 45,
    activeDate: '2026-05-07',
  },
  {
    title: 'Edit Distance',
    difficulty: 'Hard',
    functionName: 'min_distance',
    leetcodeUrl: 'https://leetcode.com/problems/edit-distance/',
    descriptionMarkdown: `## Edit Distance\n\nGiven two strings \`word1\` and \`word2\`, return the minimum number of operations (insert, delete, replace) required to convert \`word1\` to \`word2\`.\n\n**Example:**\n\`\`\`\nInput: word1 = "horse", word2 = "ros"\nOutput: 3\n\`\`\``,
    starterCode: `def min_distance(word1, word2):\n    pass`,
    testCases: [
      { args: ['horse', 'ros'], expected: 3 },
      { args: ['intention', 'execution'], expected: 5 },
      { args: ['', ''], expected: 0 },
    ],
    tags: ['dynamic-programming', 'strings'],
    durationMins: 45,
    activeDate: '2026-05-08',
  },
  {
    title: 'Median of Two Sorted Arrays',
    difficulty: 'Hard',
    functionName: 'find_median_sorted_arrays',
    leetcodeUrl: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
    descriptionMarkdown: `## Median of Two Sorted Arrays\n\nGiven two sorted arrays \`nums1\` and \`nums2\`, return the median of the two sorted arrays. The overall run time complexity should be O(log(m+n)).\n\n**Example:**\n\`\`\`\nInput: nums1 = [1,2], nums2 = [3,4]\nOutput: 2.5\n\`\`\``,
    starterCode: `def find_median_sorted_arrays(nums1, nums2):\n    pass`,
    testCases: [
      { args: [[1, 3], [2]], expected: 2.0 },
      { args: [[1, 2], [3, 4]], expected: 2.5 },
      { args: [[0, 0], [0, 0]], expected: 0.0 },
    ],
    tags: ['arrays', 'binary-search', 'divide-and-conquer'],
    durationMins: 50,
    activeDate: '2026-05-09',
  },
] as const;

const insert = db.prepare(`
  INSERT OR IGNORE INTO daily_challenge_pool
    (title, difficulty, leetcode_url, description_markdown, starter_code,
     function_name, test_cases, tags, duration_mins, active_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const c of challenges) {
    insert.run(
      c.title,
      c.difficulty,
      c.leetcodeUrl,
      c.descriptionMarkdown,
      c.starterCode,
      c.functionName,
      JSON.stringify(c.testCases),
      JSON.stringify(c.tags),
      c.durationMins,
      c.activeDate,
    );
  }
});

insertMany();

const count = (db.prepare('SELECT COUNT(*) as n FROM daily_challenge_pool').get() as { n: number }).n;
console.log(`Seed complete. daily_challenge_pool now has ${count} row(s).`);
db.close();
```

- [ ] **Step 2: Add `seed:challenges` script to `server/package.json`**

In `server/package.json`, add this to the `"scripts"` object:

```json
"seed:challenges": "tsx src/db/seed-challenges.ts"
```

- [ ] **Step 3: Run the seed script**

```bash
cd server && npm run seed:challenges
```

Expected output: `Seed complete. daily_challenge_pool now has 30 row(s).`

- [ ] **Step 4: Commit**

```bash
git add server/src/db/seed-challenges.ts server/package.json
git commit -m "feat: add seed script with 30 classic LeetCode challenges"
```

---

## Task 7: Frontend Hook — `useChallenge`

**Files:**
- Modify: `client/src/hooks/usePractice.ts`

### Steps

- [ ] **Step 1: Add `useChallenge` hook**

Add the following export to the bottom of `client/src/hooks/usePractice.ts`:

```typescript
export interface ChallengeTestCase {
  args: unknown[];
  expected: unknown;
}

export interface ChallengeTestResult {
  passed: boolean;
  output: string;
  expected: string;
}

export interface Challenge {
  id: number;
  title: string;
  difficulty: string;
  leetcodeUrl: string | null;
  descriptionMarkdown: string;
  starterCode: string;
  functionName: string;
  testCases: ChallengeTestCase[];
  tags: string[];
  durationMins: number;
  completed: boolean;
  completedAt: string | null;
}

export function useChallenge(id: string | undefined) {
  const [data, setData] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<Challenge>(`/api/practice/challenge/${id}`)
      .then(setData)
      .catch(() => setError('Failed to load challenge'))
      .finally(() => setLoading(false));
  }, [id]);

  const runTests = async (code: string): Promise<{ results: ChallengeTestResult[]; allPassed: boolean }> => {
    return api.post<{ results: ChallengeTestResult[]; allPassed: boolean }>(
      `/api/practice/challenge/${id}/submit`,
      { code }
    );
  };

  const submitCode = async (code: string): Promise<{ results: ChallengeTestResult[]; allPassed: boolean }> => {
    const result = await api.post<{ results: ChallengeTestResult[]; allPassed: boolean }>(
      `/api/practice/challenge/${id}/submit`,
      { code, submit: true }
    );
    if (result.allPassed) {
      setData((prev) => prev ? { ...prev, completed: true, completedAt: new Date().toISOString() } : prev);
    }
    return result;
  };

  return { data, loading, error, runTests, submitCode };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/usePractice.ts
git commit -m "feat: add useChallenge hook with runTests and submitCode"
```

---

## Task 8: TestResultsPanel Component

**Files:**
- Create: `client/src/components/TestResultsPanel.tsx`
- Modify: `client/src/index.css`

### Steps

- [ ] **Step 1: Create `client/src/components/TestResultsPanel.tsx`**

```typescript
import type { ChallengeTestResult } from '../hooks/usePractice.js';

interface Props {
  results: ChallengeTestResult[];
  isRunning: boolean;
}

export function TestResultsPanel({ results, isRunning }: Props) {
  if (isRunning) {
    return (
      <div className="test-results-panel">
        <div className="test-results-header">Running tests…</div>
      </div>
    );
  }

  if (results.length === 0) return null;

  const passed = results.filter((r) => r.passed).length;

  return (
    <div className="test-results-panel">
      <div className="test-results-header">
        {passed}/{results.length} tests passed
      </div>
      {results.map((r, i) => (
        <div key={i} className={`test-result-row ${r.passed ? 'passed' : 'failed'}`}>
          <span className="test-result-icon">{r.passed ? '✓' : '✗'}</span>
          <div className="test-result-detail">
            <span>Test {i + 1}: {r.passed ? 'Passed' : 'Failed'}</span>
            {!r.passed && (
              <>
                <span>Got: {r.output}</span>
                <span>Expected: {r.expected}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS to `client/src/index.css`**

Append the following CSS to the end of `client/src/index.css`:

```css
/* ── Solve Challenge Page ─────────────────────────────────────────────── */

.solve-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  overflow: hidden;
  background: var(--bg);
}

.solve-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-strong);
  flex-shrink: 0;
}

.solve-back-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
  flex-shrink: 0;
}

.solve-back-btn:hover { color: var(--text); }

.solve-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.solve-title h2 {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.solve-badge {
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-sans);
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.solve-badge.easy   { background: var(--success-bg); color: var(--success-text); }
.solve-badge.medium { background: var(--warning-bg); color: var(--warning-text); }
.solve-badge.hard   { background: var(--danger-bg);  color: var(--danger-text); }

.solve-timer {
  font-family: 'Courier New', monospace;
  font-size: 15px;
  font-weight: 600;
  color: var(--muted);
  flex-shrink: 0;
}

.solve-timer.urgent { color: var(--danger-text); }

.solve-workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.solve-problem {
  overflow-y: auto;
  padding: 24px;
  border-right: 1px solid var(--border);
}

.solve-problem .markdown-body h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 16px;
}

.solve-problem .markdown-body p,
.solve-problem .markdown-body li {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.7;
  color: var(--muted-strong);
}

.solve-problem .markdown-body pre {
  background: var(--surface-container);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  font-size: 13px;
  overflow-x: auto;
}

.solve-problem .markdown-body code {
  font-family: 'Courier New', monospace;
  background: var(--surface-container-high);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
}

.solve-editor-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.solve-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  background: var(--surface-strong);
  flex-shrink: 0;
}

.solve-btn-run {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.solve-btn-run:hover:not(:disabled) { background: var(--surface-container); }
.solve-btn-run:disabled { opacity: 0.45; cursor: not-allowed; }

.solve-btn-submit {
  padding: 7px 18px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: #fff;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.solve-btn-submit:hover:not(:disabled) { background: var(--accent-deep); }
.solve-btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }

.solve-completed-badge {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--success-text);
  background: var(--success-bg);
  padding: 5px 12px;
  border-radius: 99px;
}

/* Test Results Panel */
.test-results-panel {
  border-top: 1px solid var(--border);
  background: var(--surface-container-low);
  max-height: 220px;
  overflow-y: auto;
  flex-shrink: 0;
}

html[data-theme="dark"] .test-results-panel {
  background: var(--surface-dim);
}

.test-results-header {
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-sans);
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  border-bottom: 1px solid var(--border);
}

.test-result-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.test-result-row:first-of-type { border-top: none; }

.test-result-icon {
  font-size: 13px;
  flex-shrink: 0;
  margin-top: 1px;
}

.test-result-row.passed .test-result-icon { color: var(--success-text); }
.test-result-row.failed .test-result-icon { color: var(--danger-text); }

.test-result-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--muted);
}

.test-result-row.passed .test-result-detail { color: var(--success-text); }
.test-result-row.failed .test-result-detail span:first-child { color: var(--text); }
.test-result-row.failed .test-result-detail span:not(:first-child) { color: var(--danger-text); }
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/TestResultsPanel.tsx client/src/index.css
git commit -m "feat: add TestResultsPanel component and solve page CSS"
```

---

## Task 9: Overhaul `SolveChallengePage.tsx`

**Files:**
- Modify: `client/src/pages/SolveChallengePage.tsx`

### Steps

- [ ] **Step 1: Replace `SolveChallengePage.tsx` entirely**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import { useChallenge } from '../hooks/usePractice.js';
import { TestResultsPanel } from '../components/TestResultsPanel.js';
import type { ChallengeTestResult } from '../hooks/usePractice.js';

export function SolveChallengePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, loading, error, runTests, submitCode } = useChallenge(id);

  const [code, setCode] = useState('');
  const [results, setResults] = useState<ChallengeTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (data?.starterCode && !code) {
      setCode(data.starterCode);
    }
  }, [data?.starterCode]);

  useEffect(() => {
    if (data?.durationMins && timeLeft === null) {
      setTimeLeft(data.durationMins * 60);
    }
  }, [data?.durationMins]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft !== null]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const { results: res } = await runTests(code);
      setResults(res);
    } catch {
      setResults([{ passed: false, output: 'Execution service unavailable', expected: '' }]);
    }
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    setIsRunning(true);
    try {
      const { results: res, allPassed } = await submitCode(code);
      setResults(res);
      if (allPassed) {
        setTimeout(() => navigate('/practice'), 1500);
      }
    } catch {
      setResults([{ passed: false, output: 'Execution service unavailable', expected: '' }]);
    }
    setIsRunning(false);
  };

  if (loading) return <div className="loading" role="status">Loading challenge…</div>;
  if (error || !data) return <div className="error" role="alert">{error ?? 'Challenge not found.'}</div>;

  const isUrgent = timeLeft !== null && timeLeft < 300;

  return (
    <div className="solve-page">
      <header className="solve-header">
        <button className="solve-back-btn" onClick={() => navigate('/practice')}>
          ← Back
        </button>
        <div className="solve-title">
          <h2>{data.title}</h2>
          <span className={`solve-badge ${data.difficulty?.toLowerCase()}`}>
            {data.difficulty}
          </span>
        </div>
        {timeLeft !== null && (
          <span className={`solve-timer${isUrgent ? ' urgent' : ''}`}>
            {formatTime(timeLeft)}
          </span>
        )}
      </header>

      <div className="solve-workspace">
        {/* Left — problem description */}
        <div className="solve-problem">
          <div className="markdown-body">
            <ReactMarkdown>{data.descriptionMarkdown}</ReactMarkdown>
          </div>
        </div>

        {/* Right — editor + actions + results */}
        <div className="solve-editor-section">
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                padding: { top: 12 },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                tabSize: 4,
              }}
            />
          </div>

          <div className="solve-actions">
            {data.completed ? (
              <span className="solve-completed-badge">Completed ✓</span>
            ) : (
              <>
                <button
                  className="solve-btn-run"
                  onClick={handleRun}
                  disabled={isRunning}
                >
                  {isRunning ? 'Running…' : '▶ Run Tests'}
                </button>
                <button
                  className="solve-btn-submit"
                  onClick={handleSubmit}
                  disabled={isRunning}
                >
                  Submit
                </button>
              </>
            )}
          </div>

          <TestResultsPanel results={results} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/SolveChallengePage.tsx
git commit -m "feat: overhaul SolveChallengePage with Python editor, timer, and per-test results"
```

---

## Task 10: Route Update in `main.tsx`

**Files:**
- Modify: `client/src/main.tsx`

### Steps

- [ ] **Step 1: Update route from `practice/challenge` to `practice/challenge/:id`**

In `client/src/main.tsx`, find:

```typescript
      { path: 'practice/challenge', element: <SolveChallengePage /> },
```

Replace with:

```typescript
      { path: 'practice/challenge/:id', element: <SolveChallengePage /> },
```

- [ ] **Step 2: Run full test suite**

```bash
cd /path/to/study-app && npm test
```

Expected: all existing tests pass (server + client).

- [ ] **Step 3: Commit**

```bash
git add client/src/main.tsx
git commit -m "feat: update challenge route to /practice/challenge/:id"
```

---

## Verification

After all tasks are complete, manually verify end-to-end:

1. Start the server: `npm run dev:server`
2. Start the client: `npm run dev:client`
3. Open `http://localhost:5173/practice` — the daily challenge hero should show "Two Sum" (today's challenge)
4. Click "Solve Challenge" — should navigate to `/practice/challenge/1`
5. The problem description, starter code in the Python editor, and timer should all appear
6. Write a correct solution (`def two_sum(nums, target): return [i for i,v in enumerate(nums) if target-v in nums[nums.index(v)+1:]]` or simpler) and click "Run Tests" — per-test results should appear
7. Click "Submit" with all tests passing — should redirect to `/practice` after 1.5 seconds
8. Verify the streak data updates (recent sessions should show the completed challenge)
