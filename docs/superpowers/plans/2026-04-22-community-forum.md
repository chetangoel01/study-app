# Community Forum v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/community` placeholder into a working multi-user forum (threads + replies + tags + subscribe + trending + views + edits + deletes).

**Architecture:** Four new SQLite tables (`forum_threads`, `forum_replies`, `forum_subscriptions`, `forum_thread_views`). One new Hono router (`/api/community`). One new React page (`/community/t/:id`) plus a rewrite of the existing `CommunityPage`. Reuses existing auth middleware, markdown renderer, and API client patterns.

**Tech Stack:** Hono + better-sqlite3 on the server; React + react-router + react-markdown on the client; vitest for tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-22-community-forum-design.md`

---

## Conventions used in this plan

- **IDs** for threads and replies: `randomUUID()` from `node:crypto` (TEXT PK). `users.id` is INTEGER (existing).
- **User display:** `users.full_name` if non-empty, else local part of `users.email`. No `username` or `avatar_url` columns — `AuthorChip` always renders initials.
- **Validation:** manual string/length checks matching existing code style (see `server/src/routes/notes.ts`). No zod.
- **Sanitization:** `react-markdown` v9 is safe by default (no raw HTML unless `rehype-raw` is enabled — which we do not enable).
- **Timestamps:** all stored as SQLite `datetime('now')` TEXT. Client renders relative via the existing helper pattern in the app.
- **Tag enum:** `system-design | dsa | career | behavioral | devops`.

---

## Task 1: Add schema + indexes for forum tables

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/db/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `server/src/db/schema.test.ts` (inside the existing `describe('applySchema', ...)`):

```ts
it('creates the four forum tables', () => {
  const db = new Database(':memory:');
  applySchema(db);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  const names = tables.map((t) => t.name);

  expect(names).toContain('forum_threads');
  expect(names).toContain('forum_replies');
  expect(names).toContain('forum_subscriptions');
  expect(names).toContain('forum_thread_views');
});

it('creates the forum indexes', () => {
  const db = new Database(':memory:');
  applySchema(db);

  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all() as { name: string }[];
  const names = indexes.map((i) => i.name);

  expect(names).toContain('idx_forum_threads_activity');
  expect(names).toContain('idx_forum_threads_tag_activity');
  expect(names).toContain('idx_forum_replies_thread');
});

it('forum schema is idempotent', () => {
  const db = new Database(':memory:');
  expect(() => {
    applySchema(db);
    applySchema(db);
  }).not.toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- schema.test.ts`
Expected: FAIL — the three new tests fail because tables/indexes don't exist.

- [ ] **Step 3: Add the DDL**

Append the following inside the `SCHEMA_DDL` template string in `server/src/db/schema.ts`, *before* the closing backtick (around line 209):

```sql
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- schema.test.ts`
Expected: PASS on all schema tests (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema.ts server/src/db/schema.test.ts
git commit -m "feat(server): add forum_threads/replies/subscriptions/views schema"
```

---

## Task 2: Community lib — constants + small helpers

**Files:**
- Create: `server/src/lib/community.ts`
- Create: `server/src/lib/community.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/lib/community.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import {
  COMMUNITY_TAGS,
  isValidTag,
  TITLE_MAX,
  THREAD_BODY_MAX,
  REPLY_BODY_MAX,
  displayName,
  recordView,
  totalViewCount,
} from './community.js';

describe('community lib', () => {
  it('COMMUNITY_TAGS has the five v1 tags', () => {
    expect(COMMUNITY_TAGS).toEqual([
      'system-design', 'dsa', 'career', 'behavioral', 'devops',
    ]);
  });

  it('isValidTag accepts enum values and rejects others', () => {
    expect(isValidTag('dsa')).toBe(true);
    expect(isValidTag('ceo-tips')).toBe(false);
    expect(isValidTag('')).toBe(false);
  });

  it('character limits are the documented values', () => {
    expect(TITLE_MAX).toBe(200);
    expect(THREAD_BODY_MAX).toBe(20_000);
    expect(REPLY_BODY_MAX).toBe(10_000);
  });

  it('displayName prefers full_name, falls back to email local part', () => {
    expect(displayName({ full_name: 'Chetan Goel', email: 'c@x.com' })).toBe('Chetan Goel');
    expect(displayName({ full_name: '', email: 'alice@example.com' })).toBe('alice');
    expect(displayName({ full_name: '   ', email: 'bob@b.io' })).toBe('bob');
  });

  describe('view tracking', () => {
    let db: Database.Database;
    beforeEach(() => {
      db = new Database(':memory:');
      applySchema(db);
      db.prepare("INSERT INTO users (id, email) VALUES (1, 'u@x.com')").run();
      db.prepare(`INSERT INTO forum_threads (id, author_id, title, body_md, tag)
                  VALUES ('t1', 1, 'x', 'y', 'dsa')`).run();
    });
    afterEach(() => db.close());

    it('recordView inserts on first call', () => {
      recordView(db, 1, 't1');
      expect(totalViewCount(db, 't1')).toBe(1);
    });

    it('recordView is idempotent within 24h', () => {
      recordView(db, 1, 't1');
      recordView(db, 1, 't1');
      expect(totalViewCount(db, 't1')).toBe(1);
    });

    it('totalViewCount counts distinct users', () => {
      db.prepare("INSERT INTO users (id, email) VALUES (2, 'u2@x.com')").run();
      recordView(db, 1, 't1');
      recordView(db, 2, 't1');
      expect(totalViewCount(db, 't1')).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- community.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

Create `server/src/lib/community.ts`:

```ts
import type Database from 'better-sqlite3';

export const COMMUNITY_TAGS = [
  'system-design',
  'dsa',
  'career',
  'behavioral',
  'devops',
] as const;

export type CommunityTag = (typeof COMMUNITY_TAGS)[number];

export function isValidTag(x: unknown): x is CommunityTag {
  return typeof x === 'string' && (COMMUNITY_TAGS as readonly string[]).includes(x);
}

export const TITLE_MAX = 200;
export const THREAD_BODY_MAX = 20_000;
export const REPLY_BODY_MAX = 10_000;

export function displayName(user: { full_name?: string | null; email: string }): string {
  const fn = (user.full_name ?? '').trim();
  if (fn.length > 0) return fn;
  return user.email.split('@')[0] ?? user.email;
}

/**
 * Insert-or-conditional-update the viewer's view row. The row exists after
 * the first call (so distinct-user view count is stable); subsequent calls
 * within 24h do nothing. After 24h, last_viewed_at advances — still one row.
 */
export function recordView(db: Database.Database, userId: number, threadId: string): void {
  db.prepare(
    `INSERT INTO forum_thread_views (user_id, thread_id, last_viewed_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id, thread_id) DO UPDATE SET
       last_viewed_at = excluded.last_viewed_at
     WHERE last_viewed_at < datetime('now', '-24 hours')`
  ).run(userId, threadId);
}

export function totalViewCount(db: Database.Database, threadId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM forum_thread_views WHERE thread_id = ?')
    .get(threadId) as { n: number };
  return row.n;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- community.test.ts`
Expected: PASS on all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/community.ts server/src/lib/community.test.ts
git commit -m "feat(server): add community lib (tags, limits, view tracking)"
```

---

## Task 3: Community router — create + get thread + list (filter=all)

**Files:**
- Create: `server/src/routes/community.ts`
- Create: `server/src/routes/community.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/community.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeCommunityRouter } from './community.js';

let db: Database.Database;
let app: Hono;

async function authedCookie(email: string): Promise<string> {
  await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  return match ? `access_token=${match[1]}` : '';
}

beforeEach(() => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/community', makeCommunityRouter(db));
});
afterEach(() => db.close());

describe('POST /api/community/threads', () => {
  it('creates a thread and auto-subscribes the author', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Hello', body_md: '# Hi', tag: 'dsa' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.thread.title).toBe('Hello');
    expect(body.thread.tag).toBe('dsa');
    expect(body.thread.isSubscribed).toBe(true);
    expect(body.thread.id).toMatch(/^[0-9a-f-]{36}$/);

    const sub = db
      .prepare('SELECT * FROM forum_subscriptions WHERE thread_id = ?')
      .all(body.thread.id);
    expect(sub.length).toBe(1);
  });

  it('rejects invalid tag', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'x', body_md: 'y', tag: 'not-a-tag' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversized title (413)', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'x'.repeat(201), body_md: 'y', tag: 'dsa' }),
    });
    expect(res.status).toBe(413);
  });

  it('rejects oversized body (413)', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 't', body_md: 'y'.repeat(20_001), tag: 'dsa' }),
    });
    expect(res.status).toBe(413);
  });

  it('rejects unauthenticated', async () => {
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 't', body_md: 'y', tag: 'dsa' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/community/threads/:id', () => {
  it('returns thread detail for logged-in user', async () => {
    const cookie = await authedCookie('a@x.com');
    const create = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    });
    const { thread } = await create.json();
    const get = await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: cookie },
    });
    expect(get.status).toBe(200);
    const body = await get.json();
    expect(body.thread.body_md).toBe('B');
    expect(body.replies).toEqual([]);
    expect(body.canEdit).toBe(true);
  });

  it('returns 404 for unknown thread', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads/missing', { headers: { Cookie: cookie } });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/community/threads (filter=all, default)', () => {
  it('returns threads sorted by last_activity_at DESC', async () => {
    const cookie = await authedCookie('a@x.com');
    const t1 = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'First', body_md: 'x', tag: 'dsa' }),
    })).json();
    // Force a later last_activity_at on t2 by manual update to avoid timing flake.
    const t2 = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Second', body_md: 'x', tag: 'dsa' }),
    })).json();
    db.prepare("UPDATE forum_threads SET last_activity_at = datetime('now', '+1 hour') WHERE id = ?")
      .run(t2.thread.id);

    const res = await app.request('/api/community/threads', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threads.map((t: { id: string }) => t.id)).toEqual([t2.thread.id, t1.thread.id]);
    expect(body.threads[0].isSubscribed).toBe(true); // author auto-subscribed
  });

  it('omits soft-deleted threads', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'X', body_md: 'x', tag: 'dsa' }),
    })).json();
    db.prepare("UPDATE forum_threads SET deleted_at = datetime('now') WHERE id = ?").run(thread.id);
    const res = await app.request('/api/community/threads', { headers: { Cookie: cookie } });
    expect((await res.json()).threads).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- community.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the router (create + get + list all)**

Create `server/src/routes/community.ts`:

```ts
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import {
  isValidTag,
  TITLE_MAX,
  THREAD_BODY_MAX,
  displayName,
  totalViewCount,
} from '../lib/community.js';

type UserRow = { id: number; email: string; full_name: string | null };

type ThreadRow = {
  id: string;
  author_id: number;
  title: string;
  body_md: string;
  tag: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  reply_count: number;
  edited_at: string | null;
  deleted_at: string | null;
};

function shapeThread(
  db: Database.Database,
  row: ThreadRow,
  viewerId: number,
  includeBody: boolean,
) {
  const author = db
    .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
    .get(row.author_id) as UserRow | undefined;

  const isSubscribed =
    db
      .prepare('SELECT 1 FROM forum_subscriptions WHERE user_id = ? AND thread_id = ?')
      .get(viewerId, row.id) !== undefined;

  const excerpt = row.deleted_at
    ? ''
    : row.body_md.slice(0, 200).replace(/\s+/g, ' ').trim();

  return {
    id: row.id,
    title: row.deleted_at ? '[deleted thread]' : row.title,
    tag: row.tag,
    author: author
      ? { id: author.id, name: displayName(author), avatarUrl: null }
      : null,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    replyCount: row.reply_count,
    viewCount: totalViewCount(db, row.id),
    isSubscribed,
    excerpt,
    ...(includeBody
      ? { body_md: row.deleted_at ? '' : row.body_md }
      : {}),
  };
}

export function makeCommunityRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  // ---- Create thread ----
  router.post('/threads', async (c) => {
    const user = c.get('user') as { id: number };
    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return c.json({ error: 'invalid body' }, 400);
    }
    const { title, body_md, tag } = payload as Record<string, unknown>;
    if (typeof title !== 'string' || typeof body_md !== 'string' || !isValidTag(tag)) {
      return c.json({ error: 'title, body_md, tag required; tag must be a known value' }, 400);
    }
    const titleTrim = title.trim();
    if (titleTrim.length === 0) {
      return c.json({ error: 'title cannot be empty' }, 400);
    }
    if (titleTrim.length > TITLE_MAX) {
      return c.json({ error: `title exceeds ${TITLE_MAX} chars` }, 413);
    }
    if (body_md.length > THREAD_BODY_MAX) {
      return c.json({ error: `body exceeds ${THREAD_BODY_MAX} chars` }, 413);
    }

    const id = randomUUID();
    const insertThread = db.prepare(
      `INSERT INTO forum_threads (id, author_id, title, body_md, tag)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insertSub = db.prepare(
      `INSERT INTO forum_subscriptions (user_id, thread_id) VALUES (?, ?)`,
    );
    const txn = db.transaction(() => {
      insertThread.run(id, user.id, titleTrim, body_md, tag);
      insertSub.run(user.id, id);
    });
    txn();

    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as ThreadRow;
    return c.json({ thread: shapeThread(db, row, user.id, true) }, 201);
  });

  // ---- Get one thread ----
  router.get('/threads/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);

    // Replies are empty for now; filled in Task 5.
    return c.json({
      thread: shapeThread(db, row, user.id, true),
      replies: [],
      canEdit: row.author_id === user.id && !row.deleted_at,
    });
  });

  // ---- List threads ----
  router.get('/threads', (c) => {
    const user = c.get('user') as { id: number };
    const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 50);

    const rows = db
      .prepare(
        `SELECT * FROM forum_threads
         WHERE deleted_at IS NULL
         ORDER BY last_activity_at DESC, id DESC
         LIMIT ?`,
      )
      .all(limit) as ThreadRow[];

    return c.json({
      threads: rows.map((r) => shapeThread(db, r, user.id, false)),
      nextCursor: null,
    });
  });

  return router;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- community.test.ts`
Expected: PASS on all tests in this file so far.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/community.ts server/src/routes/community.test.ts
git commit -m "feat(server): add community router (create, get, list threads)"
```

---

## Task 4: Edit + delete thread (with ownership enforcement)

**Files:**
- Modify: `server/src/routes/community.ts`
- Modify: `server/src/routes/community.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/routes/community.test.ts`:

```ts
describe('PUT /api/community/threads/:id', () => {
  it('author can edit; sets edited_at', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T2', body_md: 'B2', tag: 'career' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread.title).toBe('T2');
    expect(body.thread.tag).toBe('career');
    expect(body.thread.editedAt).not.toBeNull();
  });

  it('non-author gets 403', async () => {
    const authorCookie = await authedCookie('a@x.com');
    const otherCookie = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: authorCookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: otherCookie },
      body: JSON.stringify({ title: 'hacked' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/community/threads/:id', () => {
  it('hard-deletes thread with no replies', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const exists = db.prepare('SELECT 1 FROM forum_threads WHERE id = ?').get(thread.id);
    expect(exists).toBeUndefined();
  });

  it('soft-deletes thread when replies exist', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    // Manually insert a reply so this test is independent of Task 5.
    db.prepare(
      `INSERT INTO forum_replies (id, thread_id, author_id, body_md)
       VALUES ('r1', ?, 1, 'hi')`,
    ).run(thread.id);
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT deleted_at FROM forum_threads WHERE id = ?')
      .get(thread.id) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });

  it('non-author gets 403', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: b },
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- community.test.ts`
Expected: FAIL — PUT and DELETE routes not yet defined.

- [ ] **Step 3: Add edit + delete handlers**

Insert the following inside `makeCommunityRouter`, immediately after the `router.get('/threads', ...)` block (before `return router`):

```ts
  // ---- Edit thread ----
  router.put('/threads/:id', async (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.deleted_at) return c.json({ error: 'cannot edit deleted thread' }, 409);

    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload) return c.json({ error: 'invalid body' }, 400);

    let title = row.title;
    let body_md = row.body_md;
    let tag = row.tag;

    if (payload.title !== undefined) {
      if (typeof payload.title !== 'string') return c.json({ error: 'title must be a string' }, 400);
      const t = payload.title.trim();
      if (t.length === 0) return c.json({ error: 'title cannot be empty' }, 400);
      if (t.length > TITLE_MAX) return c.json({ error: `title exceeds ${TITLE_MAX} chars` }, 413);
      title = t;
    }
    if (payload.body_md !== undefined) {
      if (typeof payload.body_md !== 'string') return c.json({ error: 'body_md must be a string' }, 400);
      if (payload.body_md.length > THREAD_BODY_MAX) {
        return c.json({ error: `body exceeds ${THREAD_BODY_MAX} chars` }, 413);
      }
      body_md = payload.body_md;
    }
    if (payload.tag !== undefined) {
      if (!isValidTag(payload.tag)) return c.json({ error: 'invalid tag' }, 400);
      tag = payload.tag;
    }

    db.prepare(
      `UPDATE forum_threads
       SET title = ?, body_md = ?, tag = ?,
           updated_at = datetime('now'),
           edited_at = datetime('now')
       WHERE id = ?`,
    ).run(title, body_md, tag, id);

    const updated = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as ThreadRow;
    return c.json({ thread: shapeThread(db, updated, user.id, true) });
  });

  // ---- Delete thread ----
  router.delete('/threads/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);

    const replyCount = (
      db
        .prepare('SELECT COUNT(*) AS n FROM forum_replies WHERE thread_id = ?')
        .get(id) as { n: number }
    ).n;

    if (replyCount === 0) {
      db.prepare('DELETE FROM forum_threads WHERE id = ?').run(id);
      return c.json({ deleted: 'hard' });
    } else {
      db.prepare(
        `UPDATE forum_threads SET deleted_at = datetime('now') WHERE id = ?`,
      ).run(id);
      return c.json({ deleted: 'soft' });
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- community.test.ts`
Expected: PASS on all tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/community.ts server/src/routes/community.test.ts
git commit -m "feat(server): add thread edit + delete with ownership + soft-delete"
```

---

## Task 5: Replies (create, edit, soft-delete)

**Files:**
- Modify: `server/src/routes/community.ts`
- Modify: `server/src/routes/community.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/routes/community.test.ts`:

```ts
describe('replies', () => {
  it('POST reply bumps last_activity_at and reply_count; auto-subscribes replier', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();

    // Pin thread activity to the past so we can detect the bump.
    db.prepare("UPDATE forum_threads SET last_activity_at = '2000-01-01 00:00:00' WHERE id = ?")
      .run(thread.id);

    const res = await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: b },
      body: JSON.stringify({ body_md: 'nice post' }),
    });
    expect(res.status).toBe(201);
    const { reply } = await res.json();
    expect(reply.body_md).toBe('nice post');

    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(thread.id) as {
      reply_count: number; last_activity_at: string;
    };
    expect(row.reply_count).toBe(1);
    expect(row.last_activity_at > '2000-01-01 00:00:00').toBe(true);

    // b was auto-subscribed
    const sub = db.prepare('SELECT 1 FROM forum_subscriptions WHERE thread_id = ? AND user_id = 2')
      .get(thread.id);
    expect(sub).toBeDefined();
  });

  it('GET thread includes replies in chronological order', async () => {
    const a = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'first' }),
    });
    await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'second' }),
    });
    const detail = await (await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: a },
    })).json();
    expect(detail.replies.map((r: { body_md: string }) => r.body_md)).toEqual(['first', 'second']);
    expect(detail.replies[0].canEdit).toBe(true);
  });

  it('PUT reply: author-only edit sets edited_at; does not bump last_activity_at', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const { reply } = await (await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'orig' }),
    })).json();

    db.prepare("UPDATE forum_threads SET last_activity_at = '2000-01-01 00:00:00' WHERE id = ?")
      .run(thread.id);

    const forbid = await app.request(`/api/community/replies/${reply.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: b },
      body: JSON.stringify({ body_md: 'hacked' }),
    });
    expect(forbid.status).toBe(403);

    const edit = await app.request(`/api/community/replies/${reply.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'updated' }),
    });
    expect(edit.status).toBe(200);
    const { reply: updated } = await edit.json();
    expect(updated.body_md).toBe('updated');
    expect(updated.editedAt).not.toBeNull();

    const activity = db.prepare('SELECT last_activity_at FROM forum_threads WHERE id = ?')
      .get(thread.id) as { last_activity_at: string };
    expect(activity.last_activity_at).toBe('2000-01-01 00:00:00');
  });

  it('DELETE reply: soft-delete strips body + author', async () => {
    const a = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const { reply } = await (await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'gone soon' }),
    })).json();
    const del = await app.request(`/api/community/replies/${reply.id}`, {
      method: 'DELETE', headers: { Cookie: a },
    });
    expect(del.status).toBe(200);

    const detail = await (await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: a },
    })).json();
    expect(detail.replies[0].body_md).toBe('[deleted]');
    expect(detail.replies[0].author).toBeNull();
    expect(detail.replies[0].deletedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- community.test.ts`
Expected: FAIL — reply routes not defined; GET thread does not yet include replies.

- [ ] **Step 3: Add reply handlers and wire replies into GET thread**

In `server/src/routes/community.ts`:

Add at the top imports section:

```ts
import { REPLY_BODY_MAX } from '../lib/community.js';
```

(merge this into the existing `import { ... } from '../lib/community.js'` block).

Add a helper near `shapeThread`:

```ts
type ReplyRow = {
  id: string;
  thread_id: string;
  author_id: number;
  body_md: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

function shapeReply(db: Database.Database, row: ReplyRow, viewerId: number) {
  if (row.deleted_at) {
    return {
      id: row.id,
      author: null,
      body_md: '[deleted]',
      createdAt: row.created_at,
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
      canEdit: false,
    };
  }
  const author = db
    .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
    .get(row.author_id) as UserRow | undefined;
  return {
    id: row.id,
    author: author
      ? { id: author.id, name: displayName(author), avatarUrl: null }
      : null,
    body_md: row.body_md,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: null,
    canEdit: row.author_id === viewerId,
  };
}
```

Update the existing `router.get('/threads/:id', ...)` handler — replace the empty `replies: []` with a real fetch:

```ts
  router.get('/threads/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);

    const replyRows = db
      .prepare('SELECT * FROM forum_replies WHERE thread_id = ? ORDER BY created_at ASC, id ASC')
      .all(id) as ReplyRow[];

    return c.json({
      thread: shapeThread(db, row, user.id, true),
      replies: replyRows.map((r) => shapeReply(db, r, user.id)),
      canEdit: row.author_id === user.id && !row.deleted_at,
    });
  });
```

Add new reply handlers inside `makeCommunityRouter` (before `return router`):

```ts
  // ---- Create reply ----
  router.post('/threads/:id/replies', async (c) => {
    const user = c.get('user') as { id: number };
    const threadId = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(threadId) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.deleted_at) return c.json({ error: 'thread deleted' }, 409);

    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload.body_md !== 'string') {
      return c.json({ error: 'body_md required' }, 400);
    }
    if (payload.body_md.trim().length === 0) {
      return c.json({ error: 'body_md cannot be empty' }, 400);
    }
    if (payload.body_md.length > REPLY_BODY_MAX) {
      return c.json({ error: `body exceeds ${REPLY_BODY_MAX} chars` }, 413);
    }

    const id = randomUUID();
    const insertReply = db.prepare(
      `INSERT INTO forum_replies (id, thread_id, author_id, body_md) VALUES (?, ?, ?, ?)`,
    );
    const bumpThread = db.prepare(
      `UPDATE forum_threads
       SET reply_count = reply_count + 1, last_activity_at = datetime('now')
       WHERE id = ?`,
    );
    const subUpsert = db.prepare(
      `INSERT OR IGNORE INTO forum_subscriptions (user_id, thread_id) VALUES (?, ?)`,
    );
    db.transaction(() => {
      insertReply.run(id, threadId, user.id, payload.body_md);
      bumpThread.run(threadId);
      subUpsert.run(user.id, threadId);
    })();

    const inserted = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as ReplyRow;
    return c.json({ reply: shapeReply(db, inserted, user.id) }, 201);
  });

  // ---- Edit reply ----
  router.put('/replies/:id', async (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as
      | ReplyRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.deleted_at) return c.json({ error: 'cannot edit deleted reply' }, 409);

    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload.body_md !== 'string') {
      return c.json({ error: 'body_md required' }, 400);
    }
    if (payload.body_md.trim().length === 0) {
      return c.json({ error: 'body_md cannot be empty' }, 400);
    }
    if (payload.body_md.length > REPLY_BODY_MAX) {
      return c.json({ error: `body exceeds ${REPLY_BODY_MAX} chars` }, 413);
    }

    db.prepare(
      `UPDATE forum_replies SET body_md = ?, edited_at = datetime('now') WHERE id = ?`,
    ).run(payload.body_md, id);

    const updated = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as ReplyRow;
    return c.json({ reply: shapeReply(db, updated, user.id) });
  });

  // ---- Delete reply (soft) ----
  router.delete('/replies/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as
      | ReplyRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.deleted_at) return c.json({ deleted: 'soft' });

    db.prepare(
      `UPDATE forum_replies SET deleted_at = datetime('now') WHERE id = ?`,
    ).run(id);
    return c.json({ deleted: 'soft' });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- community.test.ts`
Expected: PASS on all tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/community.ts server/src/routes/community.test.ts
git commit -m "feat(server): add replies (create, edit, soft-delete, auto-subscribe)"
```

---

## Task 6: Subscribe/unsubscribe + filter=subscribed

**Files:**
- Modify: `server/src/routes/community.ts`
- Modify: `server/src/routes/community.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/routes/community.test.ts`:

```ts
describe('subscribe / unsubscribe', () => {
  it('subscribe is idempotent; unsubscribe is idempotent', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();

    const s1 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'POST', headers: { Cookie: b },
    });
    expect(s1.status).toBe(200);
    const s2 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'POST', headers: { Cookie: b },
    });
    expect(s2.status).toBe(200);
    const count1 = (db.prepare('SELECT COUNT(*) AS n FROM forum_subscriptions WHERE user_id = 2')
      .get() as { n: number }).n;
    expect(count1).toBe(1);

    const u1 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'DELETE', headers: { Cookie: b },
    });
    expect(u1.status).toBe(200);
    const u2 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'DELETE', headers: { Cookie: b },
    });
    expect(u2.status).toBe(200);
    const count2 = (db.prepare('SELECT COUNT(*) AS n FROM forum_subscriptions WHERE user_id = 2')
      .get() as { n: number }).n;
    expect(count2).toBe(0);
  });

  it('filter=subscribed returns only threads the caller subscribes to', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread: ta } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'A', body_md: 'x', tag: 'dsa' }),
    })).json();
    const { thread: tb } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: b },
      body: JSON.stringify({ title: 'B', body_md: 'y', tag: 'career' }),
    })).json();

    const res = await app.request('/api/community/threads?filter=subscribed', {
      headers: { Cookie: a },
    });
    const body = await res.json();
    const ids = body.threads.map((t: { id: string }) => t.id);
    expect(ids).toContain(ta.id);
    expect(ids).not.toContain(tb.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- community.test.ts`
Expected: FAIL — no subscribe routes; filter=subscribed not honored.

- [ ] **Step 3: Add subscribe routes + filter handling**

In `server/src/routes/community.ts`, add **before** `return router`:

```ts
  // ---- Subscribe ----
  router.post('/threads/:id/subscribe', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT 1 FROM forum_threads WHERE id = ?').get(id);
    if (!row) return c.json({ error: 'not found' }, 404);
    db.prepare(
      `INSERT OR IGNORE INTO forum_subscriptions (user_id, thread_id) VALUES (?, ?)`,
    ).run(user.id, id);
    return c.json({ subscribed: true });
  });

  // ---- Unsubscribe ----
  router.delete('/threads/:id/subscribe', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    db.prepare(
      `DELETE FROM forum_subscriptions WHERE user_id = ? AND thread_id = ?`,
    ).run(user.id, id);
    return c.json({ subscribed: false });
  });
```

Now update the list handler to honor `filter`. Replace the existing `router.get('/threads', ...)` with:

```ts
  router.get('/threads', (c) => {
    const user = c.get('user') as { id: number };
    const filter = c.req.query('filter') ?? 'all';
    const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 50);

    let rows: ThreadRow[];
    if (filter === 'subscribed') {
      rows = db
        .prepare(
          `SELECT t.* FROM forum_threads t
           INNER JOIN forum_subscriptions s ON s.thread_id = t.id AND s.user_id = ?
           WHERE t.deleted_at IS NULL
           ORDER BY t.last_activity_at DESC, t.id DESC
           LIMIT ?`,
        )
        .all(user.id, limit) as ThreadRow[];
    } else {
      rows = db
        .prepare(
          `SELECT * FROM forum_threads
           WHERE deleted_at IS NULL
           ORDER BY last_activity_at DESC, id DESC
           LIMIT ?`,
        )
        .all(limit) as ThreadRow[];
    }

    return c.json({
      threads: rows.map((r) => shapeThread(db, r, user.id, false)),
      nextCursor: null,
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- community.test.ts`
Expected: PASS on all tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/community.ts server/src/routes/community.test.ts
git commit -m "feat(server): add subscribe/unsubscribe + filter=subscribed list"
```

---

## Task 7: Views, filter=trending, tag filter

**Files:**
- Modify: `server/src/routes/community.ts`
- Modify: `server/src/routes/community.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/routes/community.test.ts`:

```ts
describe('views + trending + tag filter', () => {
  it('GET thread records a view; dedups within 24h', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();

    await app.request(`/api/community/threads/${thread.id}`, { headers: { Cookie: b } });
    await app.request(`/api/community/threads/${thread.id}`, { headers: { Cookie: b } });
    const view1 = (db.prepare('SELECT COUNT(*) AS n FROM forum_thread_views WHERE thread_id = ?')
      .get(thread.id) as { n: number }).n;
    expect(view1).toBe(1);

    // Author does not count twice against themselves but does register a row.
    await app.request(`/api/community/threads/${thread.id}`, { headers: { Cookie: a } });
    const view2 = (db.prepare('SELECT COUNT(*) AS n FROM forum_thread_views WHERE thread_id = ?')
      .get(thread.id) as { n: number }).n;
    expect(view2).toBe(2);
  });

  it('filter=trending returns threads in score order within 7-day window', async () => {
    const a = await authedCookie('a@x.com');
    const { thread: hot } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'Hot', body_md: 'x', tag: 'dsa' }),
    })).json();
    const { thread: cold } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'Cold', body_md: 'y', tag: 'dsa' }),
    })).json();
    const { thread: stale } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'Stale', body_md: 'z', tag: 'dsa' }),
    })).json();

    // Give 'hot' many replies (denormalized count only; real inserts not needed for score).
    db.prepare('UPDATE forum_threads SET reply_count = 20 WHERE id = ?').run(hot.id);
    // Put 'stale' outside the 7-day window.
    db.prepare("UPDATE forum_threads SET last_activity_at = datetime('now', '-10 days') WHERE id = ?")
      .run(stale.id);

    const res = await app.request('/api/community/threads?filter=trending', {
      headers: { Cookie: a },
    });
    const body = await res.json();
    const ids = body.threads.map((t: { id: string }) => t.id);
    expect(ids).toContain(hot.id);
    expect(ids).toContain(cold.id);
    expect(ids).not.toContain(stale.id);
    expect(ids[0]).toBe(hot.id); // hot first
  });

  it('tag filter narrows results', async () => {
    const a = await authedCookie('a@x.com');
    const { thread: tDsa } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'DSA', body_md: 'x', tag: 'dsa' }),
    })).json();
    const { thread: tCareer } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'CAREER', body_md: 'y', tag: 'career' }),
    })).json();

    const res = await app.request('/api/community/threads?tag=dsa', { headers: { Cookie: a } });
    const ids = (await res.json()).threads.map((t: { id: string }) => t.id);
    expect(ids).toContain(tDsa.id);
    expect(ids).not.toContain(tCareer.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- community.test.ts`
Expected: FAIL — view recording not wired; trending + tag filter unimplemented.

- [ ] **Step 3: Wire view recording and extend the list handler**

In `server/src/routes/community.ts`:

Merge `recordView` into the existing `../lib/community.js` import (it's already imported). Then update the GET thread handler to call it:

```ts
  router.get('/threads/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);

    if (!row.deleted_at) {
      recordView(db, user.id, id);
    }

    const replyRows = db
      .prepare('SELECT * FROM forum_replies WHERE thread_id = ? ORDER BY created_at ASC, id ASC')
      .all(id) as ReplyRow[];

    return c.json({
      thread: shapeThread(db, row, user.id, true),
      replies: replyRows.map((r) => shapeReply(db, r, user.id)),
      canEdit: row.author_id === user.id && !row.deleted_at,
    });
  });
```

Replace the list handler again to add tag + trending support:

```ts
  router.get('/threads', (c) => {
    const user = c.get('user') as { id: number };
    const filter = c.req.query('filter') ?? 'all';
    const tag = c.req.query('tag');
    const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 50);

    const tagOk = tag && isValidTag(tag);

    let rows: ThreadRow[];
    if (filter === 'trending') {
      const sql = `
        SELECT t.*,
          (t.reply_count * 2.0 + COALESCE(v.view_count, 0) * 0.1)
            / POW((julianday('now') - julianday(t.last_activity_at)) * 24 + 2, 1.5) AS score
        FROM forum_threads t
          LEFT JOIN (
            SELECT thread_id, COUNT(*) AS view_count
            FROM forum_thread_views
            GROUP BY thread_id
          ) v ON v.thread_id = t.id
        WHERE t.deleted_at IS NULL
          AND t.last_activity_at > datetime('now', '-7 days')
          ${tagOk ? 'AND t.tag = ?' : ''}
        ORDER BY score DESC
        LIMIT ?`;
      rows = (tagOk
        ? db.prepare(sql).all(tag, limit)
        : db.prepare(sql).all(limit)) as ThreadRow[];
    } else if (filter === 'subscribed') {
      const sql = `
        SELECT t.* FROM forum_threads t
        INNER JOIN forum_subscriptions s ON s.thread_id = t.id AND s.user_id = ?
        WHERE t.deleted_at IS NULL
          ${tagOk ? 'AND t.tag = ?' : ''}
        ORDER BY t.last_activity_at DESC, t.id DESC
        LIMIT ?`;
      rows = (tagOk
        ? db.prepare(sql).all(user.id, tag, limit)
        : db.prepare(sql).all(user.id, limit)) as ThreadRow[];
    } else {
      const sql = `
        SELECT * FROM forum_threads
        WHERE deleted_at IS NULL
          ${tagOk ? 'AND tag = ?' : ''}
        ORDER BY last_activity_at DESC, id DESC
        LIMIT ?`;
      rows = (tagOk
        ? db.prepare(sql).all(tag, limit)
        : db.prepare(sql).all(limit)) as ThreadRow[];
    }

    return c.json({
      threads: rows.map((r) => shapeThread(db, r, user.id, false)),
      nextCursor: null,
    });
  });
```

Also add `recordView` to the imports from `'../lib/community.js'` if not already present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test -- community.test.ts`
Expected: PASS on all tests (across all 7 task test blocks).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/community.ts server/src/routes/community.test.ts
git commit -m "feat(server): add view tracking, trending score, and tag filter"
```

---

## Task 8: Wire router into server/src/index.ts

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Import and mount**

In `server/src/index.ts`, add to the imports near the top:

```ts
import { makeCommunityRouter } from './routes/community.js';
```

Then after the other `app.route('/api/...', ...)` calls, add:

```ts
app.route('/api/community', makeCommunityRouter(db));
```

- [ ] **Step 2: Verify build**

Run: `cd server && npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Run the full server test suite**

Run: `cd server && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): mount community router at /api/community"
```

---

## Task 9: Client types + `useCommunity` hook

**Files:**
- Modify: `client/src/types.ts`
- Create: `client/src/hooks/useCommunity.ts`
- Create: `client/src/hooks/useCommunity.test.tsx`

- [ ] **Step 1: Add client types**

Append to `client/src/types.ts`:

```ts
export const COMMUNITY_TAGS = [
  'system-design', 'dsa', 'career', 'behavioral', 'devops',
] as const;
export type CommunityTag = (typeof COMMUNITY_TAGS)[number];

export const COMMUNITY_TAG_LABELS: Record<CommunityTag, string> = {
  'system-design': 'System design',
  'dsa': 'DSA',
  'career': 'Career',
  'behavioral': 'Behavioral',
  'devops': 'DevOps',
};

export interface CommunityAuthor {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface CommunityThread {
  id: string;
  title: string;
  tag: CommunityTag;
  author: CommunityAuthor | null;
  createdAt: string;
  lastActivityAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyCount: number;
  viewCount: number;
  isSubscribed: boolean;
  excerpt: string;
}

export interface CommunityThreadFull extends CommunityThread {
  body_md: string;
}

export interface CommunityReply {
  id: string;
  author: CommunityAuthor | null;
  body_md: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  canEdit: boolean;
}

export type CommunityFilter = 'all' | 'subscribed' | 'trending';
```

- [ ] **Step 2: Write a failing hook test**

Create `client/src/hooks/useCommunity.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCommunityThreads } from './useCommunity.js';

beforeEach(() => {
  (global.fetch as unknown) = vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes('/api/community/threads')) {
      return new Response(
        JSON.stringify({
          threads: [
            {
              id: 't1', title: 'Hi', tag: 'dsa',
              author: { id: 1, name: 'A', avatarUrl: null },
              createdAt: '', lastActivityAt: '', editedAt: null, deletedAt: null,
              replyCount: 0, viewCount: 0, isSubscribed: false, excerpt: '',
            },
          ],
          nextCursor: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 404 });
  });
});

describe('useCommunityThreads', () => {
  it('fetches threads for the given filter + tag', async () => {
    const { result } = renderHook(() =>
      useCommunityThreads({ filter: 'all', tag: null }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0].id).toBe('t1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('filter=all'),
      expect.anything(),
    );
  });

  it('passes tag in the query string when provided', async () => {
    renderHook(() => useCommunityThreads({ filter: 'all', tag: 'dsa' }));
    await waitFor(() => {
      expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
        (call) => String(call[0]).includes('tag=dsa'),
      )).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd client && npm test -- useCommunity.test.tsx`
Expected: FAIL — hook module does not exist.

- [ ] **Step 4: Write the hook**

Create `client/src/hooks/useCommunity.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type {
  CommunityFilter,
  CommunityReply,
  CommunityTag,
  CommunityThread,
  CommunityThreadFull,
} from '../types.js';

interface ListResponse {
  threads: CommunityThread[];
  nextCursor: string | null;
}

interface DetailResponse {
  thread: CommunityThreadFull;
  replies: CommunityReply[];
  canEdit: boolean;
}

export function useCommunityThreads(params: {
  filter: CommunityFilter;
  tag: CommunityTag | null;
}) {
  const { filter, tag } = params;
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ filter });
      if (tag) qs.set('tag', tag);
      const res = await api.get<ListResponse>(`/api/community/threads?${qs.toString()}`);
      setThreads(res.threads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setLoading(false);
    }
  }, [filter, tag]);

  useEffect(() => { refresh(); }, [refresh]);

  return { threads, loading, error, refresh };
}

export function useCommunityThread(id: string | undefined) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DetailResponse>(`/api/community/threads/${id}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export async function createThread(input: {
  title: string;
  body_md: string;
  tag: CommunityTag;
}): Promise<{ thread: CommunityThreadFull }> {
  return api.post('/api/community/threads', input);
}

export async function updateThread(
  id: string,
  patch: Partial<{ title: string; body_md: string; tag: CommunityTag }>,
): Promise<{ thread: CommunityThreadFull }> {
  return api.put(`/api/community/threads/${id}`, patch);
}

export async function deleteThread(id: string): Promise<{ deleted: 'hard' | 'soft' }> {
  return api.delete(`/api/community/threads/${id}`);
}

export async function createReply(
  threadId: string,
  body_md: string,
): Promise<{ reply: CommunityReply }> {
  return api.post(`/api/community/threads/${threadId}/replies`, { body_md });
}

export async function updateReply(
  id: string,
  body_md: string,
): Promise<{ reply: CommunityReply }> {
  return api.put(`/api/community/replies/${id}`, { body_md });
}

export async function deleteReply(id: string): Promise<{ deleted: 'soft' }> {
  return api.delete(`/api/community/replies/${id}`);
}

export async function subscribe(threadId: string): Promise<void> {
  await api.post(`/api/community/threads/${threadId}/subscribe`);
}

export async function unsubscribe(threadId: string): Promise<void> {
  await api.delete(`/api/community/threads/${threadId}/subscribe`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd client && npm test -- useCommunity.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/types.ts client/src/hooks/useCommunity.ts client/src/hooks/useCommunity.test.tsx
git commit -m "feat(client): add community types + useCommunity hooks"
```

---

## Task 10: `AuthorChip` component

**Files:**
- Create: `client/src/components/AuthorChip.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/AuthorChip.tsx`:

```tsx
import type { CommunityAuthor } from '../types.js';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function AuthorChip({
  author,
  timestamp,
  editedAt,
}: {
  author: CommunityAuthor | null;
  timestamp: string;
  editedAt?: string | null;
}) {
  const name = author?.name ?? 'Unknown';
  return (
    <span className="author-chip">
      <span className="author-chip-avatar" aria-hidden="true">{initials(name)}</span>
      <span className="author-chip-meta">
        <span className="author-chip-name">{name}</span>
        <span className="author-chip-time">
          {relativeTime(timestamp)}
          {editedAt ? <span className="author-chip-edited"> · edited</span> : null}
        </span>
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/AuthorChip.tsx
git commit -m "feat(client): add AuthorChip component"
```

---

## Task 11: `ThreadListItem` + CSS classes

**Files:**
- Create: `client/src/components/ThreadListItem.tsx`
- Modify: `client/src/styles/components.css`

- [ ] **Step 1: Write the component**

Create `client/src/components/ThreadListItem.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { CommunityThread } from '../types.js';
import { COMMUNITY_TAG_LABELS } from '../types.js';
import { AuthorChip } from './AuthorChip.js';

export function ThreadListItem({ thread }: { thread: CommunityThread }) {
  return (
    <Link to={`/community/t/${thread.id}`} className="thread-row card">
      <div className="thread-row-head">
        <span className="badge" data-tag={thread.tag}>
          {COMMUNITY_TAG_LABELS[thread.tag]}
        </span>
        {thread.isSubscribed ? (
          <span className="badge badge-subtle">Subscribed</span>
        ) : null}
      </div>
      <h2 className="thread-row-title">{thread.title}</h2>
      <p className="thread-row-excerpt">{thread.excerpt}</p>
      <div className="thread-row-foot">
        <AuthorChip
          author={thread.author}
          timestamp={thread.createdAt}
          editedAt={thread.editedAt}
        />
        <span className="thread-row-stats">
          <span>{thread.replyCount} replies</span>
          <span aria-hidden="true">·</span>
          <span>{thread.viewCount} views</span>
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Add canonical classes to components.css**

Append to `client/src/styles/components.css`:

```css
/* Community: thread row */
.thread-row {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4);
  text-decoration: none;
  color: inherit;
  transition: background var(--dur-1) var(--ease-out);
}
.thread-row:hover { background: var(--surface-2); }

.thread-row-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.thread-row-title {
  font-size: var(--text-lg);
  font-family: var(--font-display);
  margin: 0;
}
.thread-row-excerpt {
  color: var(--ink-muted);
  font-size: var(--text-sm);
  margin: 0;
}
.thread-row-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-1);
  font-size: var(--text-xs);
  color: var(--ink-muted);
}
.thread-row-stats {
  display: inline-flex;
  gap: var(--sp-2);
  white-space: nowrap;
}

/* Author chip (reused in threads and replies) */
.author-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.author-chip-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--r-pill);
  background: var(--surface-3);
  color: var(--ink-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-2xs);
  font-weight: 600;
}
.author-chip-meta {
  display: inline-flex;
  flex-direction: column;
  line-height: 1.2;
}
.author-chip-name {
  font-size: var(--text-sm);
  color: var(--ink);
}
.author-chip-time {
  font-size: var(--text-2xs);
  color: var(--ink-muted);
}
.author-chip-edited { font-style: italic; }
```

> **Note:** If any of `--r-pill`, `--text-2xs`, or `.badge-subtle` do not yet exist in the design tokens, either use the nearest equivalent already in `tokens.css` or add them following the patterns already in `components.css`. Do not introduce raw hex or px values.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ThreadListItem.tsx client/src/styles/components.css
git commit -m "feat(client): add ThreadListItem + forum CSS tokens"
```

---

## Task 12: `NewThreadModal`

**Files:**
- Create: `client/src/components/NewThreadModal.tsx`

- [ ] **Step 1: Write the component**

Create `client/src/components/NewThreadModal.tsx`:

```tsx
import { useState } from 'react';
import { createThread } from '../hooks/useCommunity.js';
import { COMMUNITY_TAGS, COMMUNITY_TAG_LABELS } from '../types.js';
import type { CommunityTag } from '../types.js';

const TITLE_MAX = 200;
const BODY_MAX = 20_000;

export function NewThreadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<CommunityTag>('dsa');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleTrim = title.trim();
  const bodyOk = body.length > 0 && body.length <= BODY_MAX;
  const canSubmit = titleTrim.length > 0 && titleTrim.length <= TITLE_MAX && bodyOk && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { thread } = await createThread({ title: titleTrim, body_md: body, tag });
      onCreated(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="new-thread-form">
          <header>
            <h2>New discussion</h2>
          </header>
          <div className="field">
            <label htmlFor="nt-title">Title</label>
            <input
              id="nt-title" className="input"
              value={title} onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX + 1}
              placeholder="A clear question or topic"
            />
          </div>
          <div className="field">
            <label htmlFor="nt-tag">Tag</label>
            <select
              id="nt-tag" className="select"
              value={tag} onChange={(e) => setTag(e.target.value as CommunityTag)}
            >
              {COMMUNITY_TAGS.map((t) => (
                <option key={t} value={t}>{COMMUNITY_TAG_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-body">Body (Markdown supported)</label>
            <textarea
              id="nt-body" className="textarea"
              rows={10}
              value={body} onChange={(e) => setBody(e.target.value)}
            />
            <p className="field-help">
              {body.length} / {BODY_MAX}
            </p>
          </div>
          {error ? <p className="state state-error" role="alert">{error}</p> : null}
          <footer>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/NewThreadModal.tsx
git commit -m "feat(client): add NewThreadModal"
```

---

## Task 13: `ReplyComposer` + `ReplyItem`

**Files:**
- Create: `client/src/components/ReplyComposer.tsx`
- Create: `client/src/components/ReplyItem.tsx`

- [ ] **Step 1: Write ReplyComposer**

Create `client/src/components/ReplyComposer.tsx`:

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { createReply } from '../hooks/useCommunity.js';

const REPLY_MAX = 10_000;

export function ReplyComposer({
  threadId,
  onPosted,
}: {
  threadId: string;
  onPosted: () => void;
}) {
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ok = body.trim().length > 0 && body.length <= REPLY_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReply(threadId, body);
      setBody('');
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="reply-composer card" onSubmit={submit}>
      <div className="reply-composer-tabs tabs">
        <button
          type="button"
          className={`tab ${!preview ? 'tab-active' : ''}`}
          onClick={() => setPreview(false)}
        >
          Write
        </button>
        <button
          type="button"
          className={`tab ${preview ? 'tab-active' : ''}`}
          onClick={() => setPreview(true)}
        >
          Preview
        </button>
      </div>
      {preview ? (
        <div className="markdown-body reply-composer-preview">
          <ReactMarkdown>{body || '*(nothing to preview)*'}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          className="textarea"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your reply (Markdown supported)"
        />
      )}
      <div className="reply-composer-foot">
        <span className="field-help">{body.length} / {REPLY_MAX}</span>
        {error ? <span className="state state-error">{error}</span> : null}
        <button type="submit" className="btn btn-primary" disabled={!ok || submitting}>
          {submitting ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write ReplyItem**

Create `client/src/components/ReplyItem.tsx`:

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { CommunityReply } from '../types.js';
import { AuthorChip } from './AuthorChip.js';
import { deleteReply, updateReply } from '../hooks/useCommunity.js';

export function ReplyItem({
  reply,
  onChanged,
}: {
  reply: CommunityReply;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body_md);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateReply(reply.id, draft);
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this reply?')) return;
    setBusy(true);
    try {
      await deleteReply(reply.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`reply card-subtle ${reply.deletedAt ? 'reply-deleted' : ''}`}>
      <header className="reply-head">
        <AuthorChip
          author={reply.author}
          timestamp={reply.createdAt}
          editedAt={reply.editedAt}
        />
        {reply.canEdit && !editing ? (
          <div className="reply-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove} disabled={busy}>Delete</button>
          </div>
        ) : null}
      </header>
      {editing ? (
        <>
          <textarea
            className="textarea"
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="reply-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setDraft(reply.body_md); }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Save</button>
          </div>
        </>
      ) : (
        <div className="markdown-body">
          <ReactMarkdown>{reply.body_md}</ReactMarkdown>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ReplyComposer.tsx client/src/components/ReplyItem.tsx
git commit -m "feat(client): add ReplyComposer + ReplyItem components"
```

---

## Task 14: `ThreadDetailView` + `ThreadDetailPage`

**Files:**
- Create: `client/src/components/ThreadDetailView.tsx`
- Create: `client/src/pages/ThreadDetailPage.tsx`

- [ ] **Step 1: Write ThreadDetailView**

Create `client/src/components/ThreadDetailView.tsx`:

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import type { CommunityTag, CommunityThreadFull } from '../types.js';
import { COMMUNITY_TAG_LABELS, COMMUNITY_TAGS } from '../types.js';
import { AuthorChip } from './AuthorChip.js';
import {
  deleteThread,
  subscribe,
  unsubscribe,
  updateThread,
} from '../hooks/useCommunity.js';

export function ThreadDetailView({
  thread,
  canEdit,
  onChanged,
}: {
  thread: CommunityThreadFull;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const [body, setBody] = useState(thread.body_md);
  const [tag, setTag] = useState<CommunityTag>(thread.tag);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(thread.isSubscribed);

  async function save() {
    setBusy(true);
    try {
      await updateThread(thread.id, { title: title.trim(), body_md: body, tag });
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this thread?')) return;
    setBusy(true);
    try {
      await deleteThread(thread.id);
      navigate('/community');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSub() {
    const next = !subscribed;
    setSubscribed(next); // optimistic
    try {
      if (next) await subscribe(thread.id);
      else await unsubscribe(thread.id);
    } catch {
      setSubscribed(!next); // revert on failure
    }
  }

  return (
    <article className="thread-detail card-lg">
      <header className="thread-detail-head">
        <span className="badge" data-tag={thread.tag}>
          {COMMUNITY_TAG_LABELS[thread.tag]}
        </span>
        <button
          type="button"
          className={`btn ${subscribed ? 'btn-ghost' : 'btn-primary'}`}
          onClick={toggleSub}
        >
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </header>
      {editing ? (
        <>
          <div className="field">
            <label>Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Tag</label>
            <select className="select" value={tag} onChange={(e) => setTag(e.target.value as CommunityTag)}>
              {COMMUNITY_TAGS.map((t) => (
                <option key={t} value={t}>{COMMUNITY_TAG_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Body</label>
            <textarea className="textarea" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="thread-detail-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={() => {
              setEditing(false);
              setTitle(thread.title); setBody(thread.body_md); setTag(thread.tag);
            }}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Save</button>
          </div>
        </>
      ) : (
        <>
          <h1 className="thread-detail-title">{thread.title}</h1>
          <AuthorChip
            author={thread.author}
            timestamp={thread.createdAt}
            editedAt={thread.editedAt}
          />
          <div className="markdown-body thread-detail-body">
            <ReactMarkdown>{thread.body_md || ''}</ReactMarkdown>
          </div>
          {canEdit ? (
            <div className="thread-detail-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}>Delete</button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Write ThreadDetailPage**

Create `client/src/pages/ThreadDetailPage.tsx`:

```tsx
import { Link, useParams } from 'react-router-dom';
import { useCommunityThread } from '../hooks/useCommunity.js';
import { ThreadDetailView } from '../components/ThreadDetailView.js';
import { ReplyItem } from '../components/ReplyItem.js';
import { ReplyComposer } from '../components/ReplyComposer.js';

export function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refresh } = useCommunityThread(id);

  if (loading) return <div className="state" role="status">Loading…</div>;
  if (error) return <div className="state state-error" role="alert">{error}</div>;
  if (!data || !id) return null;

  return (
    <div className="thread-detail-page">
      <p className="thread-detail-crumbs">
        <Link to="/community">← Back to discussions</Link>
      </p>
      <ThreadDetailView thread={data.thread} canEdit={data.canEdit} onChanged={refresh} />
      <section className="thread-replies">
        <h2>Replies ({data.replies.length})</h2>
        {data.replies.map((r) => (
          <ReplyItem key={r.id} reply={r} onChanged={refresh} />
        ))}
        {!data.thread.deletedAt ? (
          <ReplyComposer threadId={id} onPosted={refresh} />
        ) : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ThreadDetailView.tsx client/src/pages/ThreadDetailPage.tsx
git commit -m "feat(client): add ThreadDetailView + ThreadDetailPage"
```

---

## Task 15: Rewrite `CommunityPage` + add route

**Files:**
- Modify: `client/src/pages/CommunityPage.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Rewrite CommunityPage**

Replace the contents of `client/src/pages/CommunityPage.tsx` with:

```tsx
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCommunityThreads } from '../hooks/useCommunity.js';
import {
  COMMUNITY_TAGS,
  COMMUNITY_TAG_LABELS,
  type CommunityFilter,
  type CommunityTag,
} from '../types.js';
import { ThreadListItem } from '../components/ThreadListItem.js';
import { NewThreadModal } from '../components/NewThreadModal.js';

const FILTERS: Array<{ id: CommunityFilter; label: string; icon: string }> = [
  { id: 'all',        label: 'All discussions', icon: 'forum' },
  { id: 'subscribed', label: 'Subscribed',      icon: 'star' },
  { id: 'trending',   label: 'Trending',        icon: 'trending_up' },
];

export function CommunityPage() {
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as CommunityFilter) ?? 'all';
  const tagParam = params.get('tag');
  const tag = (COMMUNITY_TAGS as readonly string[]).includes(tagParam ?? '')
    ? (tagParam as CommunityTag)
    : null;
  const [showNew, setShowNew] = useState(false);
  const { threads, loading, error, refresh } = useCommunityThreads({ filter, tag });

  function setFilter(next: CommunityFilter) {
    const p = new URLSearchParams(params);
    p.set('filter', next);
    setParams(p, { replace: true });
  }
  function toggleTag(next: CommunityTag) {
    const p = new URLSearchParams(params);
    if (tag === next) p.delete('tag');
    else p.set('tag', next);
    setParams(p, { replace: true });
  }

  return (
    <div className="community-page">
      <aside className="community-sidebar card" aria-label="Forum navigation">
        <p className="community-sidebar-heading">Navigation</p>
        <nav className="community-nav">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`community-nav-item ${filter === f.id ? 'community-nav-item--active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </nav>
        <div>
          <p className="community-sidebar-heading">Tags</p>
          <div className="community-tags">
            {COMMUNITY_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`community-tag ${tag === t ? 'community-tag--active' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {COMMUNITY_TAG_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="community-main">
        <div className="community-main-header">
          <div>
            <h1 className="community-title">Community forum</h1>
            <p className="community-lede">
              A focused space for mindful collaboration and technical growth.
            </p>
          </div>
          <button type="button" className="btn btn-primary community-new-post" onClick={() => setShowNew(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            New post
          </button>
        </div>

        {loading ? (
          <p className="state" role="status">Loading discussions…</p>
        ) : error ? (
          <p className="state state-error" role="alert">{error}</p>
        ) : threads.length === 0 ? (
          <EmptyState filter={filter} tag={tag} />
        ) : (
          <div className="community-thread-list">
            {threads.map((t) => <ThreadListItem key={t.id} thread={t} />)}
          </div>
        )}

        <p className="community-footer-note">
          Prefer structured study first? <Link to="/">Back to dashboard</Link>
        </p>
      </section>

      {showNew ? (
        <NewThreadModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            window.location.assign(`/community/t/${id}`);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ filter, tag }: { filter: CommunityFilter; tag: CommunityTag | null }) {
  if (filter === 'subscribed') {
    return (
      <div className="state">
        <strong>No subscribed threads yet</strong>
        <p>Subscribe to threads and they'll collect here. <Link to="/community?filter=all">Browse all</Link>.</p>
      </div>
    );
  }
  if (filter === 'trending') {
    return (
      <div className="state">
        <strong>Nothing hot right now</strong>
        <p>Check back after folks post.</p>
      </div>
    );
  }
  return (
    <div className="state">
      <strong>Be the first to start a discussion</strong>
      <p>{tag ? `No threads tagged ${tag}.` : 'This space is waiting for its first post.'}</p>
    </div>
  );
}
```

- [ ] **Step 2: Register the detail route**

In `client/src/main.tsx`, find the existing `/community` route entry. Add a sibling route for the detail page. Minimal example — adjust to the surrounding router style:

```ts
import { ThreadDetailPage } from './pages/ThreadDetailPage.js';
// ...
{ path: '/community/t/:id', element: <ThreadDetailPage /> },
```

Place it alongside the existing `{ path: '/community', element: <CommunityPage /> }` entry inside the same protected-route group.

- [ ] **Step 3: Build + smoke test**

```bash
npm run build
```
Expected: both server and client build successfully.

Start dev servers (in two terminals or background):
```bash
npm run dev:server
npm run dev:client
```
Expected: `/community` loads, shows the empty state, "New post" opens the modal. Submitting a thread navigates to `/community/t/<id>`. The detail page shows the body, allows a reply, edit, delete, subscribe toggle.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CommunityPage.tsx client/src/main.tsx
git commit -m "feat(client): wire community list + detail routes"
```

---

## Task 16: End-to-end verification + full test suite

**Files:** none modified

- [ ] **Step 1: Run the full test suite**

Run from the repo root:

```bash
npm test
```
Expected: all server + client tests pass (existing + new).

- [ ] **Step 2: Manual smoke test checklist**

With both dev servers running, confirm:

1. Sign up two users in separate browser profiles.
2. User A creates a thread (tag: dsa). Verify it appears on `/community` for both users.
3. User B subscribes to the thread and posts a reply. Verify `reply_count` bumps on the list, `last_activity_at` sort puts it first.
4. User B visits the thread again — view count stays at the same number of distinct users.
5. User A edits their thread — "edited" indicator renders; the thread body updates.
6. User A tries to edit user B's reply from dev tools → 403.
7. User A deletes their thread while B has a reply on it → soft delete (title shows `[deleted thread]` but thread is still visible with replies).
8. User A creates a second thread with no replies and deletes it → hard delete, gone from list.
9. Switch filter to "Subscribed" for each user — only their subscribed threads appear.
10. Switch filter to "Trending" — threads with recent activity + replies rank above quieter ones.
11. Click tag chips — list narrows to only that tag.
12. New post button opens modal; validation rejects empty title and oversized body.
13. Sign out user A; visit `/community/t/:id` → redirected to login (existing ProtectedRoute behavior).

- [ ] **Step 3: Final commit (if any fixes needed)**

If anything above fails, fix it and commit. If everything passes, this task is complete with no commit.

```bash
git log --oneline -20
```

Expected: clean commit history mirroring the task list.

---

## Self-Review Summary

- **Spec coverage:** tables ✓ (Task 1), lib helpers ✓ (Task 2), create/read/list ✓ (Task 3), edit/delete ✓ (Task 4), replies ✓ (Task 5), subscribe ✓ (Task 6), views/trending/tag ✓ (Task 7), wiring ✓ (Task 8), types + hooks ✓ (Task 9), UI components ✓ (Tasks 10–14), page wiring ✓ (Task 15), verification ✓ (Task 16).
- **No placeholders:** every step has real code; no TBD/TODO.
- **Type consistency:** `ThreadRow`, `ReplyRow`, `UserRow`, `CommunityThread`, `CommunityThreadFull`, `CommunityReply`, `CommunityAuthor`, `CommunityTag`, `CommunityFilter` are used consistently. Router method names match client hook calls (`createThread` → `POST /api/community/threads`, etc.).
- **One consciously deferred item:** `nextCursor: null` in list responses is stubbed — the spec calls for cursor pagination but v1 caps at 20-50 threads per query and we ship with no "Load more" in the UI. If the forum fills past that, cursor pagination is a small follow-up on top of the composite `(last_activity_at, id)` ordering already in place.
