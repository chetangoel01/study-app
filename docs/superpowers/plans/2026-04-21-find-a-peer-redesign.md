# Find-a-Peer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the mock-interview scheduling state machine and make invites + availability actually visible on both sides, with multi-block availability, role preferences, and an append-only event log.

**Architecture:** New `mock-interviews` and `availability` routers (split out of `practice.ts`), parent/child availability schema (`availability_proposals` + `availability_blocks`), append-only `mock_interview_events` audit table, server-side role compatibility + time-overlap conflict checks, and a four-card `MockInterviewsSection` on `PracticePage` backed by four focused modal components and two new client hooks.

**Tech Stack:** Hono + better-sqlite3 (server), Vitest (server tests), React + Vitest + React Testing Library (client), TypeScript throughout.

**Spec:** `docs/superpowers/specs/2026-04-21-find-a-peer-redesign-design.md`

---

## File Map

### New server files
| File | Purpose |
|---|---|
| `server/src/routes/mock-interviews.ts` | Invite lifecycle routes (list, detail, schedule, accept, decline, cancel, reschedule, peers) |
| `server/src/routes/mock-interviews.test.ts` | Tests for invite router |
| `server/src/routes/availability.ts` | Availability routes (create, mine, feed, claim, cancel block, cancel proposal) |
| `server/src/routes/availability.test.ts` | Tests for availability router |
| `server/src/lib/scheduling.ts` | Shared helpers: `isRoleCompatible`, `findOverlappingInvite`, `inviteSummaryRow`, `listInviteEvents` |
| `server/src/lib/scheduling.test.ts` | Tests for pure helpers |

### New client files
| File | Purpose |
|---|---|
| `client/src/hooks/useMockInterviews.ts` | List, detail, and lifecycle mutations for invites |
| `client/src/hooks/useAvailability.ts` | My availability, feed, create, claim, cancel |
| `client/src/components/mock-interviews/MockInterviewsSection.tsx` | Four-card section on PracticePage |
| `client/src/components/mock-interviews/CreateModal.tsx` | Create invite / post availability (multi-block) |
| `client/src/components/mock-interviews/InviteDetailModal.tsx` | Invite detail with event timeline |
| `client/src/components/mock-interviews/MyAvailabilityModal.tsx` | Manage posted blocks |
| `client/src/components/mock-interviews/AvailabilityFeedModal.tsx` | Browse open blocks, filter, claim |
| `client/src/components/mock-interviews/MockInterviewsSection.test.tsx` | Section smoke test |
| `client/src/components/mock-interviews/CreateModal.test.tsx` | Multi-block submit + role default |
| `client/src/components/mock-interviews/InviteDetailModal.test.tsx` | Timeline rendering |

### Modified server files
| File | Change |
|---|---|
| `server/src/db/schema.ts` | Add new tables, ALTERs on `mock_interviews` and `user_preferences`, DROP old proposals table |
| `server/src/db/schema.test.ts` | Tests for new tables and columns |
| `server/src/routes/practice.ts` | Remove `/peers`, `/mock-interviews/schedule`, `/mock-interviews/proposals` handlers |
| `server/src/routes/practice.test.ts` | Delete tests for removed handlers |
| `server/src/routes/user.ts` | Add `defaultRolePreference` to GET/PUT response + body |
| `server/src/routes/user.test.ts` | Tests for `defaultRolePreference` round-trip |
| `server/src/index.ts` | Mount `makeMockInterviewsRouter` and `makeAvailabilityRouter` |

### Modified client files
| File | Change |
|---|---|
| `client/src/types.ts` | Add `RolePreference`, `InviteStatus`, `InviteSummary`, `InviteDetail`, `InviteEvent`, `AvailabilityBlockSummary`, `MyAvailability`, `FeedBlock`, expand `AuthUser` with `defaultRolePreference` |
| `client/src/hooks/usePractice.ts` | Remove `useMockPeers` |
| `client/src/pages/PracticePage.tsx` | Swap `MockInterviewModal` import for the four new modals; render `MockInterviewsSection` |
| `client/src/pages/SettingsPage.tsx` | Add default role preference selector |
| `client/src/index.css` | New CSS for section + block picker (`.mock-section-*`, `.availability-block-row`, etc.) |

### Removed
- `client/src/components/MockInterviewModal.tsx`

---

## Task 1: Schema Migration

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/db/schema.test.ts`

### Steps

- [ ] **Step 1: Add new CREATE TABLE blocks to `SCHEMA_DDL`**

Open `server/src/db/schema.ts`. The file has a single `SCHEMA_DDL` template string. Add these three tables **before** the existing `CREATE TABLE IF NOT EXISTS mock_interviews` block (the forward-referenced FK from `mock_interviews.source_block_id` resolves as long as `availability_blocks` exists at first insert time — creating them earlier in the DDL string is simplest):

```sql
  CREATE TABLE IF NOT EXISTS availability_proposals (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    topic            TEXT,
    notes            TEXT,
    role_preference  TEXT NOT NULL DEFAULT 'either',
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability_blocks (
    id                INTEGER PRIMARY KEY,
    proposal_id       INTEGER NOT NULL REFERENCES availability_proposals(id) ON DELETE CASCADE,
    starts_at         TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'open',
    claimed_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    claimed_at        TEXT,
    mock_interview_id INTEGER REFERENCES mock_interviews(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_availability_blocks_open
    ON availability_blocks(status, starts_at)
    WHERE status = 'open';

  CREATE TABLE IF NOT EXISTS mock_interview_events (
    id          INTEGER PRIMARY KEY,
    invite_id   INTEGER NOT NULL REFERENCES mock_interviews(id) ON DELETE CASCADE,
    actor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    payload     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_mock_interview_events_invite
    ON mock_interview_events(invite_id, created_at);
```

- [ ] **Step 2: Add ALTER columns via `addCol`**

Inside `applySchema`, at the end of the existing `addCol(...)` block, add:

```typescript
  addCol("ALTER TABLE mock_interviews ADD COLUMN role_preference TEXT NOT NULL DEFAULT 'either'");
  addCol("ALTER TABLE mock_interviews ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 45");
  addCol("ALTER TABLE mock_interviews ADD COLUMN source_block_id INTEGER REFERENCES availability_blocks(id) ON DELETE SET NULL");
  addCol("ALTER TABLE mock_interviews ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))");
  addCol("ALTER TABLE user_preferences ADD COLUMN default_role_preference TEXT NOT NULL DEFAULT 'either'");
```

- [ ] **Step 3: Drop the old proposals table**

After the `addCol` block, add a one-shot DROP wrapped in try/catch (same idempotent pattern):

```typescript
  try {
    db.prepare('DROP TABLE IF EXISTS mock_interview_availability_proposals').run();
  } catch {
    // Table may already be gone.
  }
```

- [ ] **Step 4: Write tests for new schema**

In `server/src/db/schema.test.ts`, add these tests inside the existing `describe('applySchema', ...)`:

```typescript
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
    // insert minimal users first
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
```

- [ ] **Step 5: Run schema tests**

```bash
cd server && npx vitest run src/db/schema.test.ts
```

Expected: all tests pass, including the three new ones.

- [ ] **Step 6: Commit**

```bash
git add server/src/db/schema.ts server/src/db/schema.test.ts
git commit -m "feat(server): schema migration for find-a-peer redesign"
```

---

## Task 2: Scheduling helpers library

**Files:**
- Create: `server/src/lib/scheduling.ts`
- Create: `server/src/lib/scheduling.test.ts`

Pure helpers shared by both new routers. Doing these first means subsequent tasks can import them without defining inline.

### Steps

- [ ] **Step 1: Write failing tests for `isRoleCompatible`**

Create `server/src/lib/scheduling.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { isRoleCompatible, findOverlappingInvite } from './scheduling.js';

describe('isRoleCompatible', () => {
  it('accepts complementary roles', () => {
    expect(isRoleCompatible('interviewee', 'interviewer')).toBe(true);
    expect(isRoleCompatible('interviewer', 'interviewee')).toBe(true);
  });

  it('accepts either on either side', () => {
    expect(isRoleCompatible('either', 'interviewer')).toBe(true);
    expect(isRoleCompatible('interviewee', 'either')).toBe(true);
    expect(isRoleCompatible('either', 'either')).toBe(true);
  });

  it('rejects matching roles on both sides', () => {
    expect(isRoleCompatible('interviewee', 'interviewee')).toBe(false);
    expect(isRoleCompatible('interviewer', 'interviewer')).toBe(false);
  });
});

describe('findOverlappingInvite', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (1, ?, ?)').run('a@x.com', 'h');
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (2, ?, ?)').run('b@x.com', 'h');
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (3, ?, ?)').run('c@x.com', 'h');
  });

  it('returns conflicting invite id when windows overlap', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (10, 1, 2, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T14:30:00Z', 45);
    expect(conflict).toBe(10);
  });

  it('returns null when windows do not overlap', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (11, 1, 2, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T15:30:00Z', 30);
    expect(conflict).toBeNull();
  });

  it('ignores non-accepted invites', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (12, 1, 2, 'pending_acceptance', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T14:30:00Z', 60);
    expect(conflict).toBeNull();
  });

  it('ignores invites not involving the user', () => {
    db.prepare(`
      INSERT INTO mock_interviews (id, initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (13, 2, 3, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run();
    const conflict = findOverlappingInvite(db, 1, '2026-05-01T14:30:00Z', 60);
    expect(conflict).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests — expect failure (module not found)**

```bash
cd server && npx vitest run src/lib/scheduling.test.ts
```

Expected: FAIL — cannot resolve `./scheduling.js`.

- [ ] **Step 3: Implement the helpers**

Create `server/src/lib/scheduling.ts`:

```typescript
import type Database from 'better-sqlite3';

export type RolePreference = 'interviewee' | 'interviewer' | 'either';

export const ROLE_PREFERENCES: readonly RolePreference[] = ['interviewee', 'interviewer', 'either'] as const;

export function isValidRole(value: unknown): value is RolePreference {
  return typeof value === 'string' && (ROLE_PREFERENCES as readonly string[]).includes(value);
}

export function isRoleCompatible(a: RolePreference, b: RolePreference): boolean {
  if (a === 'either' || b === 'either') return true;
  return a !== b;
}

export function findOverlappingInvite(
  db: Database.Database,
  userId: number,
  windowStartIso: string,
  windowDurationMinutes: number,
  excludeInviteId?: number,
): number | null {
  const windowEndIso = new Date(
    new Date(windowStartIso).getTime() + windowDurationMinutes * 60_000,
  ).toISOString();

  const row = db.prepare(`
    SELECT id
    FROM mock_interviews
    WHERE status = 'accepted'
      AND (initiator_id = ? OR peer_id = ?)
      AND datetime(scheduled_for) < datetime(?)
      AND datetime(scheduled_for, '+' || duration_minutes || ' minutes') > datetime(?)
      ${excludeInviteId ? 'AND id != ?' : ''}
    LIMIT 1
  `).get(
    userId,
    userId,
    windowEndIso,
    windowStartIso,
    ...(excludeInviteId ? [excludeInviteId] : []),
  ) as { id: number } | undefined;

  return row ? row.id : null;
}

export interface InviteSummaryRow {
  id: number;
  initiator_id: number;
  peer_id: number;
  status: string;
  scheduled_for: string;
  duration_minutes: number;
  topic: string;
  role_preference: RolePreference;
  source_block_id: number | null;
  created_at: string;
  updated_at: string;
  counterparty_full_name: string | null;
}

export function fetchInviteSummaryRows(
  db: Database.Database,
  userId: number,
  opts: { direction?: 'sent' | 'received' | 'all'; statuses?: string[] } = {},
): InviteSummaryRow[] {
  const direction = opts.direction ?? 'all';
  const filters: string[] = [];
  const params: unknown[] = [];

  if (direction === 'sent') {
    filters.push('mi.initiator_id = ?');
    params.push(userId);
  } else if (direction === 'received') {
    filters.push('mi.peer_id = ?');
    params.push(userId);
  } else {
    filters.push('(mi.initiator_id = ? OR mi.peer_id = ?)');
    params.push(userId, userId);
  }

  if (opts.statuses && opts.statuses.length > 0) {
    filters.push(`mi.status IN (${opts.statuses.map(() => '?').join(',')})`);
    params.push(...opts.statuses);
  }

  const sql = `
    SELECT
      mi.id, mi.initiator_id, mi.peer_id, mi.status, mi.scheduled_for,
      mi.duration_minutes, mi.topic, mi.role_preference, mi.source_block_id,
      mi.created_at, mi.updated_at,
      counterparty.full_name AS counterparty_full_name
    FROM mock_interviews mi
    JOIN users counterparty ON counterparty.id = CASE WHEN mi.initiator_id = ? THEN mi.peer_id ELSE mi.initiator_id END
    WHERE ${filters.join(' AND ')}
    ORDER BY mi.scheduled_for DESC
    LIMIT 50
  `;
  return db.prepare(sql).all(userId, ...params) as InviteSummaryRow[];
}

export interface InviteEventRow {
  id: number;
  actor_id: number;
  event_type: string;
  payload: string | null;
  created_at: string;
}

export function fetchInviteEvents(db: Database.Database, inviteId: number): InviteEventRow[] {
  return db.prepare(`
    SELECT id, actor_id, event_type, payload, created_at
    FROM mock_interview_events
    WHERE invite_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(inviteId) as InviteEventRow[];
}

export function insertEvent(
  db: Database.Database,
  inviteId: number,
  actorId: number,
  eventType: 'created' | 'accepted' | 'declined' | 'cancelled' | 'rescheduled',
  payload?: Record<string, unknown>,
): void {
  db.prepare(`
    INSERT INTO mock_interview_events (invite_id, actor_id, event_type, payload)
    VALUES (?, ?, ?, ?)
  `).run(inviteId, actorId, eventType, payload ? JSON.stringify(payload) : null);
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
cd server && npx vitest run src/lib/scheduling.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/scheduling.ts server/src/lib/scheduling.test.ts
git commit -m "feat(server): add scheduling helpers for find-a-peer"
```

---

## Task 3: Mock-interviews router — scaffold + peers + list

**Files:**
- Create: `server/src/routes/mock-interviews.ts`
- Create: `server/src/routes/mock-interviews.test.ts`
- Modify: `server/src/index.ts`

### Steps

- [ ] **Step 1: Write failing tests for `/peers` and `GET /` (list)**

Create `server/src/routes/mock-interviews.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeMockInterviewsRouter } from './mock-interviews.js';

let db: Database.Database;
let app: Hono;
let cookieA: string;
let cookieB: string;
let userAId: number;
let userBId: number;

async function signup(email: string, password: string, fullName: string): Promise<{ cookie: string; id: number }> {
  await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  const cookie = match ? `access_token=${match[1]}` : '';
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number };
  return { cookie, id: row.id };
}

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/practice/mock-interviews', makeMockInterviewsRouter(db));

  const a = await signup('a@x.com', 'password123', 'Alice Adams');
  const b = await signup('b@x.com', 'password123', 'Bob Brown');
  userAId = a.id;
  userBId = b.id;
  cookieA = a.cookie;
  cookieB = b.cookie;

  // Both users allow mock interviews.
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'either')`).run(userAId);
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'interviewee')`).run(userBId);
});

describe('GET /api/practice/mock-interviews/peers', () => {
  it('lists other opted-in users with default_role_preference', async () => {
    const res = await app.request('/api/practice/mock-interviews/peers', {
      headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: String(userBId),
      fullName: 'Bob Brown',
      defaultRolePreference: 'interviewee',
    });
    expect(body[0].initials).toBe('BB');
  });

  it('excludes caller', async () => {
    const res = await app.request('/api/practice/mock-interviews/peers', {
      headers: { Cookie: cookieA },
    });
    const body = await res.json() as any[];
    expect(body.some((p) => p.id === String(userAId))).toBe(false);
  });
});

describe('GET /api/practice/mock-interviews', () => {
  it('returns empty list when no invites', async () => {
    const res = await app.request('/api/practice/mock-interviews', { headers: { Cookie: cookieA } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('filters by direction', async () => {
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
      VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45, 'DSA', 'interviewee')
    `).run(userAId, userBId);

    const sent = await app.request('/api/practice/mock-interviews?direction=sent', { headers: { Cookie: cookieA } });
    expect((await sent.json() as any[])).toHaveLength(1);
    const received = await app.request('/api/practice/mock-interviews?direction=received', { headers: { Cookie: cookieA } });
    expect((await received.json() as any[])).toHaveLength(0);
  });

  it('filters by status csv', async () => {
    db.prepare(`INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes) VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45)`).run(userAId, userBId);
    db.prepare(`INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes) VALUES (?, ?, 'declined', '2026-05-02T14:00:00Z', 45)`).run(userAId, userBId);

    const res = await app.request('/api/practice/mock-interviews?status=pending_acceptance', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('pending_acceptance');
  });
});
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts
```

Expected: FAIL — cannot resolve `./mock-interviews.js`.

- [ ] **Step 3: Create the router with peers + list handlers**

Create `server/src/routes/mock-interviews.ts`:

```typescript
import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { fetchInviteSummaryRows, getInitials, type InviteSummaryRow } from '../lib/scheduling.js';

function summaryRowToResponse(row: InviteSummaryRow, callerId: number) {
  return {
    id: String(row.id),
    direction: row.initiator_id === callerId ? 'sent' : 'received',
    counterparty: {
      id: String(row.initiator_id === callerId ? row.peer_id : row.initiator_id),
      fullName: row.counterparty_full_name || 'Anonymous User',
      initials: getInitials(row.counterparty_full_name || ''),
    },
    status: row.status,
    scheduledFor: row.scheduled_for,
    durationMinutes: row.duration_minutes,
    topic: row.topic ?? '',
    rolePreference: row.role_preference,
    sourceBlockId: row.source_block_id ? String(row.source_block_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function makeMockInterviewsRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/peers', (c) => {
    const user = c.get('user');
    const peers = db.prepare(`
      SELECT u.id, u.full_name, p.default_role_preference
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
      WHERE p.allow_mock_interviews = 1 AND u.id != ?
      LIMIT 50
    `).all(user.id) as Array<{ id: number; full_name: string | null; default_role_preference: string }>;

    return c.json(peers.map((p) => ({
      id: String(p.id),
      fullName: p.full_name || 'Anonymous User',
      initials: getInitials(p.full_name || ''),
      defaultRolePreference: p.default_role_preference,
    })));
  });

  router.get('/', (c) => {
    const user = c.get('user');
    const directionParam = c.req.query('direction');
    const direction: 'sent' | 'received' | 'all' =
      directionParam === 'sent' || directionParam === 'received' ? directionParam : 'all';
    const statusParam = c.req.query('status');
    const statuses = statusParam ? statusParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    const rows = fetchInviteSummaryRows(db, user.id, { direction, statuses });
    return c.json(rows.map((r) => summaryRowToResponse(r, user.id)));
  });

  return router;
}
```

- [ ] **Step 4: Mount the router in `server/src/index.ts`**

Add the import near the other route imports:

```typescript
import { makeMockInterviewsRouter } from './routes/mock-interviews.js';
```

Add the mount line near other `app.route(...)` calls (order matters — mount this BEFORE `app.route('/api/practice', makePracticeRouter(db))` so its `/mock-interviews` paths resolve first):

```typescript
app.route('/api/practice/mock-interviews', makeMockInterviewsRouter(db));
app.route('/api/practice', makePracticeRouter(db));
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts
```

Expected: 5 tests pass (peers × 2, list × 3).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/mock-interviews.ts server/src/routes/mock-interviews.test.ts server/src/index.ts
git commit -m "feat(server): mock-interviews router with peers and list endpoints"
```

---

## Task 4: Invite detail endpoint with event timeline

**Files:**
- Modify: `server/src/routes/mock-interviews.ts`
- Modify: `server/src/routes/mock-interviews.test.ts`

### Steps

- [ ] **Step 1: Write failing tests for `GET /:id`**

Append to `mock-interviews.test.ts`:

```typescript
describe('GET /api/practice/mock-interviews/:id', () => {
  it('returns detail with ordered event timeline when caller is a party', async () => {
    const info = db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
      VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45, 'DSA', 'interviewee')
    `).run(userAId, userBId);
    const inviteId = Number(info.lastInsertRowid);
    db.prepare(`INSERT INTO mock_interview_events (invite_id, actor_id, event_type, payload, created_at) VALUES (?, ?, 'created', NULL, '2026-04-20T10:00:00Z')`).run(inviteId, userAId);
    db.prepare(`INSERT INTO mock_interview_events (invite_id, actor_id, event_type, payload, created_at) VALUES (?, ?, 'rescheduled', '{"from":"X","to":"Y"}', '2026-04-20T11:00:00Z')`).run(inviteId, userAId);

    const res = await app.request(`/api/practice/mock-interviews/${inviteId}`, { headers: { Cookie: cookieA } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe(String(inviteId));
    expect(body.events).toHaveLength(2);
    expect(body.events[0].eventType).toBe('created');
    expect(body.events[1].eventType).toBe('rescheduled');
    expect(body.events[1].payload).toEqual({ from: 'X', to: 'Y' });
  });

  it('returns 403 when caller is not a party', async () => {
    const c = await signup('c@x.com', 'password123', 'Carol Curry');
    db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(c.id);
    const info = db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'pending_acceptance', '2026-05-01T14:00:00Z', 45)
    `).run(userAId, userBId);
    const inviteId = Number(info.lastInsertRowid);

    const res = await app.request(`/api/practice/mock-interviews/${inviteId}`, { headers: { Cookie: c.cookie } });
    expect(res.status).toBe(403);
  });

  it('returns 404 when invite does not exist', async () => {
    const res = await app.request('/api/practice/mock-interviews/999999', { headers: { Cookie: cookieA } });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts -t "GET /api/practice/mock-interviews/:id"
```

Expected: 3 failures (routes don't exist yet; likely 404 or unexpected shape).

- [ ] **Step 3: Implement detail endpoint**

Append to `mock-interviews.ts` inside `makeMockInterviewsRouter`, before `return router`:

```typescript
  router.get('/:id', (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400);

    const rows = fetchInviteSummaryRows(db, user.id, {});
    const row = rows.find((r) => r.id === id);
    if (!row) {
      // Check if invite exists at all vs. caller not party.
      const exists = db.prepare('SELECT id, initiator_id, peer_id FROM mock_interviews WHERE id = ?').get(id) as
        | { id: number; initiator_id: number; peer_id: number }
        | undefined;
      if (!exists) return c.json({ error: 'not_found' }, 404);
      if (exists.initiator_id !== user.id && exists.peer_id !== user.id) {
        return c.json({ error: 'forbidden' }, 403);
      }
      // Fall through — caller IS a party but rows weren't returned by summary helper (shouldn't happen, but defensive):
      return c.json({ error: 'not_found' }, 404);
    }

    const eventRows = fetchInviteEvents(db, id);
    const events = eventRows.map((e) => ({
      id: String(e.id),
      actorId: String(e.actor_id),
      eventType: e.event_type,
      payload: e.payload ? JSON.parse(e.payload) : null,
      createdAt: e.created_at,
    }));

    return c.json({
      ...summaryRowToResponse(row, user.id),
      events,
    });
  });
```

Also update the import line at the top of `mock-interviews.ts`:

```typescript
import { fetchInviteSummaryRows, fetchInviteEvents, getInitials, type InviteSummaryRow } from '../lib/scheduling.js';
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts
```

Expected: all tests pass (5 from Task 3 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/mock-interviews.ts server/src/routes/mock-interviews.test.ts
git commit -m "feat(server): add GET /mock-interviews/:id with event timeline"
```

---

## Task 5: Schedule endpoint (create invite)

**Files:**
- Modify: `server/src/routes/mock-interviews.ts`
- Modify: `server/src/routes/mock-interviews.test.ts`

### Steps

- [ ] **Step 1: Write failing tests for schedule endpoint**

Append to `mock-interviews.test.ts`:

```typescript
describe('POST /api/practice/mock-interviews/schedule', () => {
  it('creates invite with created event', async () => {
    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        peerId: String(userBId),
        scheduledFor: '2026-05-01T14:00:00Z',
        durationMinutes: 60,
        topic: 'System Design',
        rolePreference: 'interviewer', // A interviews, B is interviewee (compatible with B default 'interviewee')
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBeTruthy();

    const invite = db.prepare('SELECT * FROM mock_interviews WHERE id = ?').get(Number(body.id)) as any;
    expect(invite.initiator_id).toBe(userAId);
    expect(invite.peer_id).toBe(userBId);
    expect(invite.role_preference).toBe('interviewer');
    expect(invite.duration_minutes).toBe(60);

    const events = db.prepare('SELECT * FROM mock_interview_events WHERE invite_id = ?').all(Number(body.id)) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('created');
    expect(events[0].actor_id).toBe(userAId);
  });

  it('returns 409 on role incompatibility', async () => {
    // B default is 'interviewee'; A requests 'interviewee' too → incompatible.
    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        peerId: String(userBId),
        scheduledFor: '2026-05-01T14:00:00Z',
        durationMinutes: 45,
        rolePreference: 'interviewee',
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toBe('role_incompatible');
  });

  it('returns 409 on overlap with existing accepted invite', async () => {
    // Pre-seed an accepted invite for user A.
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-05-01T14:00:00Z', 60)
    `).run(userAId, userBId);

    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        peerId: String(userBId),
        scheduledFor: '2026-05-01T14:30:00Z',
        durationMinutes: 45,
        rolePreference: 'interviewer',
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toBe('overlap');
    expect(body.context.conflictingInviteId).toBeTruthy();
  });

  it('rejects invalid body', async () => {
    const res = await app.request('/api/practice/mock-interviews/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ peerId: String(userBId) }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts -t "schedule"
```

Expected: 4 failures.

- [ ] **Step 3: Implement schedule handler**

In `mock-interviews.ts`, update imports:

```typescript
import {
  fetchInviteSummaryRows,
  fetchInviteEvents,
  findOverlappingInvite,
  getInitials,
  insertEvent,
  isRoleCompatible,
  isValidRole,
  type InviteSummaryRow,
  type RolePreference,
} from '../lib/scheduling.js';
```

Add this handler inside `makeMockInterviewsRouter` (before `return router`):

```typescript
  router.post('/schedule', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({} as any));
    const { peerId, scheduledFor, durationMinutes, topic, rolePreference } = body;

    if (!peerId || !scheduledFor || !rolePreference) {
      return c.json({ error: 'missing_fields', detail: 'peerId, scheduledFor, rolePreference required' }, 400);
    }
    if (!isValidRole(rolePreference)) {
      return c.json({ error: 'invalid_role' }, 400);
    }
    if (Number.isNaN(Date.parse(scheduledFor))) {
      return c.json({ error: 'invalid_datetime' }, 400);
    }
    const duration = Number(durationMinutes ?? 45);
    if (!Number.isFinite(duration) || duration < 15 || duration > 180) {
      return c.json({ error: 'invalid_duration' }, 400);
    }
    const peerIdNum = Number(peerId);
    if (!Number.isInteger(peerIdNum) || peerIdNum === user.id) {
      return c.json({ error: 'invalid_peer' }, 400);
    }

    const peer = db.prepare(`
      SELECT u.id, p.default_role_preference
      FROM users u JOIN user_preferences p ON u.id = p.user_id
      WHERE u.id = ? AND p.allow_mock_interviews = 1
    `).get(peerIdNum) as { id: number; default_role_preference: RolePreference } | undefined;
    if (!peer) return c.json({ error: 'peer_unavailable' }, 404);

    if (!isRoleCompatible(rolePreference as RolePreference, peer.default_role_preference)) {
      return c.json({
        error: 'role_incompatible',
        detail: `Peer's default role (${peer.default_role_preference}) is not compatible with your requested role (${rolePreference}).`,
      }, 409);
    }

    const conflictId = findOverlappingInvite(db, user.id, scheduledFor, duration);
    if (conflictId != null) {
      return c.json({
        error: 'overlap',
        detail: 'This time overlaps an existing accepted invite.',
        context: { conflictingInviteId: String(conflictId) },
      }, 409);
    }

    const insertInvite = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO mock_interviews
          (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
        VALUES (?, ?, 'pending_acceptance', ?, ?, ?, ?)
      `).run(user.id, peerIdNum, scheduledFor, Math.round(duration), topic || 'General Technical', rolePreference);
      const inviteId = Number(info.lastInsertRowid);
      insertEvent(db, inviteId, user.id, 'created');
      return inviteId;
    });
    const inviteId = insertInvite();

    return c.json({ id: String(inviteId) });
  });
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts
```

Expected: all tests pass (previous + 4 new).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/mock-interviews.ts server/src/routes/mock-interviews.test.ts
git commit -m "feat(server): schedule endpoint with role + overlap checks"
```

---

## Task 6: Lifecycle transitions (accept, decline, cancel, reschedule)

**Files:**
- Modify: `server/src/routes/mock-interviews.ts`
- Modify: `server/src/routes/mock-interviews.test.ts`

### Steps

- [ ] **Step 1: Write failing tests for all four transitions**

Append to `mock-interviews.test.ts`:

```typescript
describe('lifecycle transitions', () => {
  async function createInvite(status = 'pending_acceptance'): Promise<number> {
    const info = db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, role_preference)
      VALUES (?, ?, ?, '2026-05-01T14:00:00Z', 45, 'either')
    `).run(userAId, userBId, status);
    const id = Number(info.lastInsertRowid);
    db.prepare(`INSERT INTO mock_interview_events (invite_id, actor_id, event_type) VALUES (?, ?, 'created')`).run(id, userAId);
    return id;
  }

  it('accept: peer transitions pending → accepted + event', async () => {
    const id = await createInvite();
    const res = await app.request(`/api/practice/mock-interviews/${id}/accept`, {
      method: 'POST', headers: { Cookie: cookieB },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT status FROM mock_interviews WHERE id = ?').get(id) as any;
    expect(row.status).toBe('accepted');
    const events = db.prepare('SELECT event_type, actor_id FROM mock_interview_events WHERE invite_id = ? ORDER BY id').all(id) as any[];
    expect(events.map((e) => e.event_type)).toEqual(['created', 'accepted']);
    expect(events[1].actor_id).toBe(userBId);
  });

  it('accept: 403 if caller is initiator', async () => {
    const id = await createInvite();
    const res = await app.request(`/api/practice/mock-interviews/${id}/accept`, {
      method: 'POST', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(403);
  });

  it('accept: 422 if already terminal', async () => {
    const id = await createInvite('declined');
    const res = await app.request(`/api/practice/mock-interviews/${id}/accept`, {
      method: 'POST', headers: { Cookie: cookieB },
    });
    expect(res.status).toBe(422);
  });

  it('accept: 409 if accepter has overlap', async () => {
    // Pre-seed user B with an accepted invite overlapping the target window.
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-05-01T14:15:00Z', 45)
    `).run(userBId, userAId);
    const id = await createInvite();
    const res = await app.request(`/api/practice/mock-interviews/${id}/accept`, {
      method: 'POST', headers: { Cookie: cookieB },
    });
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error).toBe('overlap');
  });

  it('decline: peer transitions pending → declined', async () => {
    const id = await createInvite();
    const res = await app.request(`/api/practice/mock-interviews/${id}/decline`, {
      method: 'POST', headers: { Cookie: cookieB },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT status FROM mock_interviews WHERE id = ?').get(id) as any;
    expect(row.status).toBe('declined');
  });

  it('cancel: either party works pre-terminal', async () => {
    const id1 = await createInvite('pending_acceptance');
    const r1 = await app.request(`/api/practice/mock-interviews/${id1}/cancel`, { method: 'POST', headers: { Cookie: cookieA } });
    expect(r1.status).toBe(200);

    const id2 = await createInvite('accepted');
    const r2 = await app.request(`/api/practice/mock-interviews/${id2}/cancel`, { method: 'POST', headers: { Cookie: cookieB } });
    expect(r2.status).toBe(200);
  });

  it('cancel: 422 on terminal', async () => {
    const id = await createInvite('cancelled');
    const res = await app.request(`/api/practice/mock-interviews/${id}/cancel`, { method: 'POST', headers: { Cookie: cookieA } });
    expect(res.status).toBe(422);
  });

  it('reschedule: transitions to pending_acceptance with new time and from/to payload', async () => {
    const id = await createInvite('accepted');
    const res = await app.request(`/api/practice/mock-interviews/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ scheduledFor: '2026-05-02T14:00:00Z' }),
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT status, scheduled_for FROM mock_interviews WHERE id = ?').get(id) as any;
    expect(row.status).toBe('pending_acceptance');
    expect(row.scheduled_for).toBe('2026-05-02T14:00:00Z');
    const event = db.prepare(`SELECT payload FROM mock_interview_events WHERE invite_id = ? AND event_type = 'rescheduled'`).get(id) as any;
    expect(JSON.parse(event.payload)).toEqual({
      from: '2026-05-01T14:00:00Z',
      to: '2026-05-02T14:00:00Z',
    });
  });

  it('reschedule: 409 on overlap', async () => {
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-06-01T10:00:00Z', 60)
    `).run(userAId, userBId);
    const id = await createInvite('accepted');
    const res = await app.request(`/api/practice/mock-interviews/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ scheduledFor: '2026-06-01T10:30:00Z' }),
    });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts -t "lifecycle"
```

Expected: 9 failures (endpoints do not exist).

- [ ] **Step 3: Implement transitions in `mock-interviews.ts`**

Add a helper at module scope (above `makeMockInterviewsRouter`):

```typescript
interface InviteRow {
  id: number;
  initiator_id: number;
  peer_id: number;
  status: string;
  scheduled_for: string;
  duration_minutes: number;
}

function loadInviteForTransition(
  db: Database.Database,
  inviteId: number,
  callerId: number,
  requiredParty: 'any' | 'peer' | 'initiator',
): { row: InviteRow; httpError: null } | { row: null; httpError: { code: number; body: any } } {
  const row = db.prepare(`
    SELECT id, initiator_id, peer_id, status, scheduled_for, duration_minutes
    FROM mock_interviews WHERE id = ?
  `).get(inviteId) as InviteRow | undefined;
  if (!row) return { row: null, httpError: { code: 404, body: { error: 'not_found' } } };
  const isInitiator = row.initiator_id === callerId;
  const isPeer = row.peer_id === callerId;
  if (!isInitiator && !isPeer) return { row: null, httpError: { code: 403, body: { error: 'forbidden' } } };
  if (requiredParty === 'peer' && !isPeer) return { row: null, httpError: { code: 403, body: { error: 'forbidden', detail: 'only peer can perform this action' } } };
  if (requiredParty === 'initiator' && !isInitiator) return { row: null, httpError: { code: 403, body: { error: 'forbidden', detail: 'only initiator can perform this action' } } };
  return { row, httpError: null };
}
```

Also update the `Database` type import:

```typescript
import type Database from 'better-sqlite3';
```

(already present).

Add the four transition handlers inside `makeMockInterviewsRouter` (before `return router`):

```typescript
  router.post('/:id/accept', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const loaded = loadInviteForTransition(db, id, user.id, 'peer');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    const { row } = loaded;
    if (row.status !== 'pending_acceptance') {
      return c.json({ error: 'invalid_transition', detail: `cannot accept from status ${row.status}` }, 422);
    }
    const conflictId = findOverlappingInvite(db, user.id, row.scheduled_for, row.duration_minutes, row.id);
    if (conflictId != null) {
      return c.json({ error: 'overlap', context: { conflictingInviteId: String(conflictId) } }, 409);
    }
    db.transaction(() => {
      db.prepare(`UPDATE mock_interviews SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`).run(id);
      insertEvent(db, id, user.id, 'accepted');
    })();
    return c.json({ ok: true });
  });

  router.post('/:id/decline', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const loaded = loadInviteForTransition(db, id, user.id, 'peer');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    if (loaded.row.status !== 'pending_acceptance') {
      return c.json({ error: 'invalid_transition' }, 422);
    }
    db.transaction(() => {
      db.prepare(`UPDATE mock_interviews SET status = 'declined', updated_at = datetime('now') WHERE id = ?`).run(id);
      insertEvent(db, id, user.id, 'declined');
    })();
    return c.json({ ok: true });
  });

  router.post('/:id/cancel', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const loaded = loadInviteForTransition(db, id, user.id, 'any');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    const { row } = loaded;
    if (row.status === 'cancelled' || row.status === 'declined') {
      return c.json({ error: 'invalid_transition' }, 422);
    }
    db.transaction(() => {
      db.prepare(`UPDATE mock_interviews SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
      insertEvent(db, id, user.id, 'cancelled');
    })();
    return c.json({ ok: true });
  });

  router.post('/:id/reschedule', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({} as any));
    const { scheduledFor } = body;
    if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) {
      return c.json({ error: 'invalid_datetime' }, 400);
    }
    const loaded = loadInviteForTransition(db, id, user.id, 'any');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    const { row } = loaded;
    if (row.status !== 'accepted' && row.status !== 'pending_acceptance') {
      return c.json({ error: 'invalid_transition' }, 422);
    }
    // Overlap check for BOTH parties at new window, excluding this invite.
    for (const partyId of [row.initiator_id, row.peer_id]) {
      const conflictId = findOverlappingInvite(db, partyId, scheduledFor, row.duration_minutes, row.id);
      if (conflictId != null) {
        return c.json({ error: 'overlap', context: { conflictingInviteId: String(conflictId) } }, 409);
      }
    }
    const from = row.scheduled_for;
    db.transaction(() => {
      db.prepare(`
        UPDATE mock_interviews
        SET scheduled_for = ?, status = 'pending_acceptance', updated_at = datetime('now')
        WHERE id = ?
      `).run(scheduledFor, id);
      insertEvent(db, id, user.id, 'rescheduled', { from, to: scheduledFor });
    })();
    return c.json({ ok: true });
  });
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/mock-interviews.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/mock-interviews.ts server/src/routes/mock-interviews.test.ts
git commit -m "feat(server): accept/decline/cancel/reschedule lifecycle transitions"
```

---

## Task 7: Availability router scaffold — create, list mine, cancel

**Files:**
- Create: `server/src/routes/availability.ts`
- Create: `server/src/routes/availability.test.ts`
- Modify: `server/src/index.ts`

### Steps

- [ ] **Step 1: Write failing tests for create, mine, cancel**

Create `server/src/routes/availability.test.ts` with the same `signup` harness pattern as `mock-interviews.test.ts`. Include these test blocks:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeAvailabilityRouter } from './availability.js';
import { makeMockInterviewsRouter } from './mock-interviews.js';

let db: Database.Database;
let app: Hono;
let cookieA: string;
let cookieB: string;
let userAId: number;
let userBId: number;

async function signup(email: string, password: string, fullName: string) {
  await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  const cookie = match ? `access_token=${match[1]}` : '';
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number };
  return { cookie, id: row.id };
}

beforeEach(async () => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/practice/mock-interviews', makeMockInterviewsRouter(db));
  app.route('/api/practice/availability', makeAvailabilityRouter(db));
  const a = await signup('a@x.com', 'password123', 'Alice Adams');
  const b = await signup('b@x.com', 'password123', 'Bob Brown');
  userAId = a.id; userBId = b.id; cookieA = a.cookie; cookieB = b.cookie;
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'either')`).run(userAId);
  db.prepare(`INSERT INTO user_preferences (user_id, allow_mock_interviews, default_role_preference) VALUES (?, 1, 'interviewee')`).run(userBId);
});

describe('POST /api/practice/availability', () => {
  it('creates proposal + N blocks', async () => {
    const res = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        durationMinutes: 45,
        topic: 'DSA',
        notes: '',
        rolePreference: 'either',
        blocks: [
          { startsAt: '2026-05-01T14:00:00Z' },
          { startsAt: '2026-05-02T15:00:00Z' },
          { startsAt: '2026-05-03T16:00:00Z' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.proposalId).toBeTruthy();

    const blocks = db.prepare('SELECT * FROM availability_blocks WHERE proposal_id = ?').all(Number(body.proposalId));
    expect(blocks).toHaveLength(3);
  });

  it('rejects overlapping blocks within duration', async () => {
    const res = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        durationMinutes: 60,
        rolePreference: 'either',
        blocks: [
          { startsAt: '2026-05-01T14:00:00Z' },
          { startsAt: '2026-05-01T14:30:00Z' },
        ],
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as any).error).toBe('blocks_overlap');
  });

  it('rejects empty or >8 blocks', async () => {
    const empty = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ durationMinutes: 45, rolePreference: 'either', blocks: [] }),
    });
    expect(empty.status).toBe(400);

    const tooMany = await app.request('/api/practice/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        durationMinutes: 45,
        rolePreference: 'either',
        blocks: Array.from({ length: 9 }, (_, i) => ({
          startsAt: `2026-05-${String(i + 1).padStart(2, '0')}T14:00:00Z`,
        })),
      }),
    });
    expect(tooMany.status).toBe(400);
  });
});

describe('GET /api/practice/availability/mine', () => {
  it('returns proposals with nested blocks', async () => {
    const proposal = db.prepare(`
      INSERT INTO availability_proposals (user_id, duration_minutes, topic, role_preference)
      VALUES (?, 45, 'DSA', 'either')
    `).run(userAId);
    const proposalId = Number(proposal.lastInsertRowid);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-01T14:00:00Z', 'open')`).run(proposalId);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-02T15:00:00Z', 'open')`).run(proposalId);

    const res = await app.request('/api/practice/availability/mine', { headers: { Cookie: cookieA } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].blocks).toHaveLength(2);
  });
});

describe('DELETE /api/practice/availability/blocks/:id and /:proposalId', () => {
  it('cancels a single open block', async () => {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id) VALUES (?)`).run(userAId);
    const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-01T14:00:00Z', 'open')`).run(Number(p.lastInsertRowid));
    const id = Number(b.lastInsertRowid);

    const res = await app.request(`/api/practice/availability/blocks/${id}`, {
      method: 'DELETE', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT status FROM availability_blocks WHERE id = ?').get(id) as any;
    expect(row.status).toBe('cancelled');
  });

  it('cancel block: 422 if already claimed', async () => {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id) VALUES (?)`).run(userAId);
    const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status, claimed_by) VALUES (?, '2026-05-01T14:00:00Z', 'claimed', ?)`).run(Number(p.lastInsertRowid), userBId);
    const res = await app.request(`/api/practice/availability/blocks/${Number(b.lastInsertRowid)}`, {
      method: 'DELETE', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(422);
  });

  it('cancel proposal: cancels open blocks, leaves claimed blocks alone', async () => {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id) VALUES (?)`).run(userAId);
    const proposalId = Number(p.lastInsertRowid);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status) VALUES (?, '2026-05-01T14:00:00Z', 'open')`).run(proposalId);
    db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at, status, claimed_by) VALUES (?, '2026-05-02T14:00:00Z', 'claimed', ?)`).run(proposalId, userBId);

    const res = await app.request(`/api/practice/availability/${proposalId}`, {
      method: 'DELETE', headers: { Cookie: cookieA },
    });
    expect(res.status).toBe(200);
    const rows = db.prepare('SELECT status FROM availability_blocks WHERE proposal_id = ? ORDER BY id').all(proposalId) as any[];
    expect(rows[0].status).toBe('cancelled');
    expect(rows[1].status).toBe('claimed');
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
cd server && npx vitest run src/routes/availability.test.ts
```

Expected: import error (router does not exist).

- [ ] **Step 3: Implement availability router**

Create `server/src/routes/availability.ts`:

```typescript
import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { isValidRole, type RolePreference } from '../lib/scheduling.js';

interface CreateBody {
  durationMinutes?: number;
  topic?: string;
  notes?: string;
  rolePreference?: string;
  blocks?: Array<{ startsAt?: string }>;
}

function blocksOverlapWithin(blocks: Array<{ startsAt: string }>, durationMinutes: number): boolean {
  const sorted = [...blocks].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(new Date(sorted[i - 1].startsAt).getTime() + durationMinutes * 60_000);
    const curStart = new Date(sorted[i].startsAt);
    if (curStart < prevEnd) return true;
  }
  return false;
}

export function makeAvailabilityRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.post('/', async (c) => {
    const user = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as CreateBody;

    const duration = Number(body.durationMinutes ?? 45);
    if (!Number.isFinite(duration) || duration < 15 || duration > 180) {
      return c.json({ error: 'invalid_duration' }, 400);
    }
    if (!isValidRole(body.rolePreference)) return c.json({ error: 'invalid_role' }, 400);
    const role = body.rolePreference as RolePreference;

    const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];
    if (rawBlocks.length < 1 || rawBlocks.length > 8) {
      return c.json({ error: 'invalid_block_count', detail: '1..8 blocks required' }, 400);
    }
    const normalized: Array<{ startsAt: string }> = [];
    for (const b of rawBlocks) {
      if (!b || typeof b.startsAt !== 'string' || Number.isNaN(Date.parse(b.startsAt))) {
        return c.json({ error: 'invalid_block_start' }, 400);
      }
      normalized.push({ startsAt: new Date(b.startsAt).toISOString() });
    }
    if (blocksOverlapWithin(normalized, duration)) {
      return c.json({ error: 'blocks_overlap', detail: 'two blocks within durationMinutes of each other' }, 400);
    }

    const topic = typeof body.topic === 'string' ? body.topic : '';
    const notes = typeof body.notes === 'string' ? body.notes : '';

    const proposalId = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO availability_proposals (user_id, duration_minutes, topic, notes, role_preference)
        VALUES (?, ?, ?, ?, ?)
      `).run(user.id, Math.round(duration), topic, notes, role);
      const id = Number(info.lastInsertRowid);
      const insertBlock = db.prepare(
        `INSERT INTO availability_blocks (proposal_id, starts_at) VALUES (?, ?)`,
      );
      for (const b of normalized) insertBlock.run(id, b.startsAt);
      return id;
    })();

    return c.json({ proposalId: String(proposalId) });
  });

  router.get('/mine', (c) => {
    const user = c.get('user');
    const proposals = db.prepare(`
      SELECT id, duration_minutes, topic, notes, role_preference, created_at
      FROM availability_proposals
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(user.id) as Array<{
      id: number; duration_minutes: number; topic: string | null; notes: string | null;
      role_preference: RolePreference; created_at: string;
    }>;

    const blocksStmt = db.prepare(`
      SELECT b.id, b.proposal_id, b.starts_at, b.status, b.mock_interview_id,
             b.claimed_by, cu.full_name AS claimer_full_name
      FROM availability_blocks b
      LEFT JOIN users cu ON cu.id = b.claimed_by
      WHERE proposal_id = ?
      ORDER BY starts_at ASC
    `);

    return c.json({
      proposals: proposals.map((p) => ({
        id: String(p.id),
        durationMinutes: p.duration_minutes,
        topic: p.topic ?? '',
        notes: p.notes ?? '',
        rolePreference: p.role_preference,
        createdAt: p.created_at,
        blocks: (blocksStmt.all(p.id) as any[]).map((b) => ({
          blockId: String(b.id),
          proposalId: String(b.proposal_id),
          startsAt: b.starts_at,
          status: b.status,
          claimedBy: b.claimed_by ? { id: String(b.claimed_by), fullName: b.claimer_full_name || 'Anonymous User' } : null,
          mockInterviewId: b.mock_interview_id ? String(b.mock_interview_id) : null,
        })),
      })),
    });
  });

  router.delete('/blocks/:id', (c) => {
    const user = c.get('user');
    const blockId = Number(c.req.param('id'));
    const row = db.prepare(`
      SELECT b.id, b.status, p.user_id
      FROM availability_blocks b
      JOIN availability_proposals p ON p.id = b.proposal_id
      WHERE b.id = ?
    `).get(blockId) as { id: number; status: string; user_id: number } | undefined;
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.status !== 'open') return c.json({ error: 'invalid_state' }, 422);
    db.prepare(`UPDATE availability_blocks SET status = 'cancelled' WHERE id = ?`).run(blockId);
    return c.json({ ok: true });
  });

  router.delete('/:proposalId', (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('proposalId'));
    const prop = db.prepare('SELECT user_id FROM availability_proposals WHERE id = ?').get(id) as { user_id: number } | undefined;
    if (!prop) return c.json({ error: 'not_found' }, 404);
    if (prop.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    db.prepare(`UPDATE availability_blocks SET status = 'cancelled' WHERE proposal_id = ? AND status = 'open'`).run(id);
    return c.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 4: Mount router in `server/src/index.ts`**

Add import:

```typescript
import { makeAvailabilityRouter } from './routes/availability.js';
```

Add mount (before `app.route('/api/practice', makePracticeRouter(db))`):

```typescript
app.route('/api/practice/availability', makeAvailabilityRouter(db));
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/availability.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/availability.ts server/src/routes/availability.test.ts server/src/index.ts
git commit -m "feat(server): availability router (create, mine, cancel)"
```

---

## Task 8: Availability feed endpoint

**Files:**
- Modify: `server/src/routes/availability.ts`
- Modify: `server/src/routes/availability.test.ts`

### Steps

- [ ] **Step 1: Write failing tests for `GET /feed`**

Append to `availability.test.ts`:

```typescript
describe('GET /api/practice/availability/feed', () => {
  async function seedProposal(userId: number, role: string, blocks: string[]): Promise<number[]> {
    const info = db.prepare(`
      INSERT INTO availability_proposals (user_id, duration_minutes, topic, role_preference)
      VALUES (?, 45, 'DSA', ?)
    `).run(userId, role);
    const proposalId = Number(info.lastInsertRowid);
    const ids: number[] = [];
    for (const startsAt of blocks) {
      const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at) VALUES (?, ?)`).run(proposalId, startsAt);
      ids.push(Number(b.lastInsertRowid));
    }
    return ids;
  }

  it('returns blocks from other users only', async () => {
    await seedProposal(userAId, 'either', ['2026-05-01T10:00:00Z']); // caller's own
    await seedProposal(userBId, 'interviewee', ['2026-05-01T11:00:00Z']);
    const res = await app.request('/api/practice/availability/feed', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].postedBy.id).toBe(String(userBId));
  });

  it('filters by role=interviewee includes interviewee + either', async () => {
    await seedProposal(userBId, 'interviewee', ['2026-05-01T10:00:00Z']);
    await seedProposal(userBId, 'interviewer', ['2026-05-02T10:00:00Z']);
    await seedProposal(userBId, 'either', ['2026-05-03T10:00:00Z']);
    const res = await app.request('/api/practice/availability/feed?role=interviewee', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(2);
    expect(body.map((b) => b.rolePreference).sort()).toEqual(['either', 'interviewee']);
  });

  it('excludes blocks that overlap caller accepted invites', async () => {
    await seedProposal(userBId, 'interviewee', ['2026-05-01T10:00:00Z', '2026-05-01T14:00:00Z']);
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-05-01T10:15:00Z', 60)
    `).run(userAId, userBId);
    const res = await app.request('/api/practice/availability/feed', { headers: { Cookie: cookieA } });
    const body = await res.json() as any[];
    expect(body).toHaveLength(1);
    expect(body[0].startsAt).toBe('2026-05-01T14:00:00Z');
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd server && npx vitest run src/routes/availability.test.ts -t "feed"
```

- [ ] **Step 3: Implement `GET /feed`**

Add to `availability.ts` inside `makeAvailabilityRouter` (before `return router`):

```typescript
  router.get('/feed', (c) => {
    const user = c.get('user');
    const roleParam = c.req.query('role');
    const topicParam = c.req.query('topic');
    const fromParam = c.req.query('from');
    const toParam = c.req.query('to');

    const filters: string[] = ['b.status = \'open\'', 'p.user_id != ?'];
    const params: unknown[] = [user.id];

    if (roleParam === 'interviewee') {
      filters.push("p.role_preference IN ('interviewee', 'either')");
    } else if (roleParam === 'interviewer') {
      filters.push("p.role_preference IN ('interviewer', 'either')");
    }
    if (topicParam) {
      filters.push('p.topic LIKE ?');
      params.push(`%${topicParam}%`);
    }
    if (fromParam) {
      filters.push('b.starts_at >= ?');
      params.push(fromParam);
    }
    if (toParam) {
      filters.push('b.starts_at < ?');
      params.push(toParam);
    }

    const rows = db.prepare(`
      SELECT b.id, b.proposal_id, b.starts_at,
             p.duration_minutes, p.topic, p.notes, p.role_preference,
             u.id AS user_id, u.full_name
      FROM availability_blocks b
      JOIN availability_proposals p ON p.id = b.proposal_id
      JOIN users u ON u.id = p.user_id
      WHERE ${filters.join(' AND ')}
      ORDER BY b.starts_at ASC
      LIMIT 100
    `).all(...params) as Array<{
      id: number; proposal_id: number; starts_at: string;
      duration_minutes: number; topic: string | null; notes: string | null;
      role_preference: RolePreference; user_id: number; full_name: string | null;
    }>;

    // Filter out blocks overlapping caller's accepted invites (do this in JS — overlap logic is non-trivial in SQL here).
    const accepted = db.prepare(`
      SELECT scheduled_for, duration_minutes
      FROM mock_interviews
      WHERE status = 'accepted' AND (initiator_id = ? OR peer_id = ?)
    `).all(user.id, user.id) as Array<{ scheduled_for: string; duration_minutes: number }>;
    const acceptedRanges = accepted.map((a) => {
      const start = new Date(a.scheduled_for).getTime();
      return { start, end: start + a.duration_minutes * 60_000 };
    });

    function getInitials(name: string): string {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'U';
      return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
    }

    const body = rows.flatMap((r) => {
      const start = new Date(r.starts_at).getTime();
      const end = start + r.duration_minutes * 60_000;
      for (const a of acceptedRanges) {
        if (start < a.end && end > a.start) return [];
      }
      return [{
        blockId: String(r.id),
        proposalId: String(r.proposal_id),
        postedBy: {
          id: String(r.user_id),
          fullName: r.full_name || 'Anonymous User',
          initials: getInitials(r.full_name || ''),
        },
        startsAt: r.starts_at,
        durationMinutes: r.duration_minutes,
        topic: r.topic ?? '',
        notes: r.notes ?? '',
        rolePreference: r.role_preference,
      }];
    });

    return c.json(body);
  });
```

Note: this adds an inner `getInitials` duplicating the one in `scheduling.ts` to keep the handler self-contained. Alternatively, import it — prefer the import:

```typescript
import { isValidRole, getInitials, type RolePreference } from '../lib/scheduling.js';
```

Then remove the inner function declaration.

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/availability.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/availability.ts server/src/routes/availability.test.ts
git commit -m "feat(server): availability feed endpoint with role + overlap filters"
```

---

## Task 9: Claim block endpoint

**Files:**
- Modify: `server/src/routes/availability.ts`
- Modify: `server/src/routes/availability.test.ts`

### Steps

- [ ] **Step 1: Write failing tests for claim**

Append to `availability.test.ts`:

```typescript
describe('POST /api/practice/availability/blocks/:id/claim', () => {
  async function seedBlock(userId: number, role: string, startsAt: string): Promise<number> {
    const p = db.prepare(`INSERT INTO availability_proposals (user_id, role_preference, duration_minutes) VALUES (?, ?, 45)`).run(userId, role);
    const b = db.prepare(`INSERT INTO availability_blocks (proposal_id, starts_at) VALUES (?, ?)`).run(Number(p.lastInsertRowid), startsAt);
    return Number(b.lastInsertRowid);
  }

  it('atomically claims block and creates invite', async () => {
    const blockId = await seedBlock(userBId, 'interviewee', '2026-05-01T14:00:00Z');
    const res = await app.request(`/api/practice/availability/blocks/${blockId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ rolePreference: 'interviewer' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.inviteId).toBeTruthy();

    const block = db.prepare('SELECT * FROM availability_blocks WHERE id = ?').get(blockId) as any;
    expect(block.status).toBe('claimed');
    expect(block.claimed_by).toBe(userAId);
    expect(block.mock_interview_id).toBe(Number(body.inviteId));

    const invite = db.prepare('SELECT * FROM mock_interviews WHERE id = ?').get(Number(body.inviteId)) as any;
    expect(invite.initiator_id).toBe(userAId);
    expect(invite.peer_id).toBe(userBId);
    expect(invite.source_block_id).toBe(blockId);
    expect(invite.status).toBe('pending_acceptance');
  });

  it('returns 409 if block already claimed', async () => {
    const blockId = await seedBlock(userBId, 'interviewee', '2026-05-01T14:00:00Z');
    db.prepare(`UPDATE availability_blocks SET status = 'claimed', claimed_by = ? WHERE id = ?`).run(userAId, blockId);
    const res = await app.request(`/api/practice/availability/blocks/${blockId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ rolePreference: 'interviewer' }),
    });
    expect(res.status).toBe(409);
    expect((await res.json() as any).error).toBe('block_already_claimed');
  });

  it('returns 409 on role incompatibility', async () => {
    const blockId = await seedBlock(userBId, 'interviewee', '2026-05-01T14:00:00Z');
    const res = await app.request(`/api/practice/availability/blocks/${blockId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ rolePreference: 'interviewee' }),
    });
    expect(res.status).toBe(409);
    expect((await res.json() as any).error).toBe('role_incompatible');
  });

  it('returns 409 on overlap', async () => {
    const blockId = await seedBlock(userBId, 'interviewee', '2026-05-01T14:00:00Z');
    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes)
      VALUES (?, ?, 'accepted', '2026-05-01T14:15:00Z', 30)
    `).run(userAId, userBId);
    const res = await app.request(`/api/practice/availability/blocks/${blockId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ rolePreference: 'interviewer' }),
    });
    expect(res.status).toBe(409);
    expect((await res.json() as any).error).toBe('overlap');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement claim handler**

Update `availability.ts` imports:

```typescript
import {
  findOverlappingInvite,
  getInitials,
  insertEvent,
  isRoleCompatible,
  isValidRole,
  type RolePreference,
} from '../lib/scheduling.js';
```

Add handler inside `makeAvailabilityRouter` before `return router`:

```typescript
  router.post('/blocks/:id/claim', async (c) => {
    const user = c.get('user');
    const blockId = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({} as any));
    const { rolePreference, notes } = body;
    if (!isValidRole(rolePreference)) return c.json({ error: 'invalid_role' }, 400);

    // Load block + proposal with FOR UPDATE equivalent — SQLite serializes writes via the transaction.
    const block = db.prepare(`
      SELECT b.id, b.status, b.claimed_by, b.starts_at,
             p.id AS proposal_id, p.user_id AS poster_id, p.duration_minutes, p.topic, p.role_preference
      FROM availability_blocks b
      JOIN availability_proposals p ON p.id = b.proposal_id
      WHERE b.id = ?
    `).get(blockId) as {
      id: number; status: string; claimed_by: number | null; starts_at: string;
      proposal_id: number; poster_id: number; duration_minutes: number; topic: string | null;
      role_preference: RolePreference;
    } | undefined;

    if (!block) return c.json({ error: 'not_found' }, 404);
    if (block.poster_id === user.id) return c.json({ error: 'cannot_claim_own_block' }, 400);

    if (!isRoleCompatible(rolePreference as RolePreference, block.role_preference)) {
      return c.json({ error: 'role_incompatible' }, 409);
    }

    // Overlap with claimant's own accepted invites.
    const conflictForClaimant = findOverlappingInvite(db, user.id, block.starts_at, block.duration_minutes);
    if (conflictForClaimant != null) {
      return c.json({ error: 'overlap', context: { conflictingInviteId: String(conflictForClaimant) } }, 409);
    }

    // Atomic claim + invite insert.
    const result = db.transaction(() => {
      const upd = db.prepare(`
        UPDATE availability_blocks
        SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now')
        WHERE id = ? AND claimed_by IS NULL AND status = 'open'
      `).run(user.id, blockId);
      if (upd.changes === 0) return { raced: true } as const;

      const ins = db.prepare(`
        INSERT INTO mock_interviews
          (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference, source_block_id)
        VALUES (?, ?, 'pending_acceptance', ?, ?, ?, ?, ?)
      `).run(user.id, block.poster_id, block.starts_at, block.duration_minutes, block.topic || 'General Technical', rolePreference, blockId);
      const inviteId = Number(ins.lastInsertRowid);
      db.prepare(`UPDATE availability_blocks SET mock_interview_id = ? WHERE id = ?`).run(inviteId, blockId);
      insertEvent(db, inviteId, user.id, 'created', { sourceBlockId: String(blockId), claimNotes: notes ?? null });
      return { raced: false, inviteId } as const;
    })();

    if (result.raced) return c.json({ error: 'block_already_claimed' }, 409);
    return c.json({ inviteId: String(result.inviteId) });
  });
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd server && npx vitest run src/routes/availability.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/availability.ts server/src/routes/availability.test.ts
git commit -m "feat(server): claim availability block creates invite atomically"
```

---

## Task 10: Remove old routes, update user preferences endpoint

**Files:**
- Modify: `server/src/routes/practice.ts`
- Modify: `server/src/routes/practice.test.ts`
- Modify: `server/src/routes/user.ts`
- Modify: `server/src/routes/user.test.ts`

### Steps

- [ ] **Step 1: Remove old mock-interview handlers from `practice.ts`**

In `server/src/routes/practice.ts`, delete the three route blocks (search for these exact strings and remove each entire `router.get(...)` / `router.post(...)` block):

- `router.get('/peers', (c) => { ... })`
- `router.post('/mock-interviews/schedule', async (c) => { ... })`
- `router.post('/mock-interviews/proposals', async (c) => { ... })`

Delete the `getInitials` function if it's now unused.

- [ ] **Step 2: Remove the corresponding tests from `practice.test.ts`**

Delete the entire `describe('POST /api/practice/mock-interviews/schedule', ...)` and `describe('POST /api/practice/mock-interviews/proposals', ...)` blocks, and the `describe('GET /api/practice/peers', ...)` block (if it exists). Keep the rest of the file intact.

- [ ] **Step 3: Run practice tests — expect pass (excluding deleted ones)**

```bash
cd server && npx vitest run src/routes/practice.test.ts
```

Expected: pass (fewer tests than before).

- [ ] **Step 4: Write failing test for `defaultRolePreference` round-trip in user prefs**

Find the existing `user.test.ts`. Add:

```typescript
it('round-trips defaultRolePreference', async () => {
  const put = await app.request('/api/user/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({ defaultRolePreference: 'interviewer' }),
  });
  expect(put.status).toBe(200);

  const get = await app.request('/api/user/preferences', { headers: { Cookie: cookieA } });
  const body = await get.json() as any;
  expect(body.defaultRolePreference).toBe('interviewer');
});

it('rejects invalid defaultRolePreference', async () => {
  const put = await app.request('/api/user/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({ defaultRolePreference: 'bogus' }),
  });
  expect(put.status).toBe(400);
});
```

(If `user.test.ts` does not already expose `cookieA`, adapt the test to match its existing test harness — use the existing user-test fixture pattern.)

- [ ] **Step 5: Implement `defaultRolePreference` in `user.ts`**

In `server/src/routes/user.ts`:

- Add `default_role_preference` to the GET query column list.
- Add `defaultRolePreference` to the GET response payload: `defaultRolePreference: (row?.default_role_preference ?? 'either') as 'interviewee' | 'interviewer' | 'either',`
- In PUT, validate the incoming `defaultRolePreference` value (must be one of the three literals) and include it in the upsert column list and `excluded.*` set.

Import the validator:

```typescript
import { isValidRole } from '../lib/scheduling.js';
```

- [ ] **Step 6: Run user tests — expect pass**

```bash
cd server && npx vitest run src/routes/user.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/practice.ts server/src/routes/practice.test.ts server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "refactor(server): remove old mock-interview handlers; add defaultRolePreference"
```

---

## Task 11: Client types + API hooks

**Files:**
- Modify: `client/src/types.ts`
- Create: `client/src/hooks/useMockInterviews.ts`
- Create: `client/src/hooks/useAvailability.ts`
- Modify: `client/src/hooks/usePractice.ts`

### Steps

- [ ] **Step 1: Add types to `client/src/types.ts`**

Add near the other mock-interview types (or create a new section):

```typescript
export type RolePreference = 'interviewee' | 'interviewer' | 'either';

export type InviteStatus = 'pending_acceptance' | 'accepted' | 'declined' | 'cancelled';

export interface InviteCounterparty {
  id: string;
  fullName: string;
  initials: string;
}

export interface InviteSummary {
  id: string;
  direction: 'sent' | 'received';
  counterparty: InviteCounterparty;
  status: InviteStatus;
  scheduledFor: string;
  durationMinutes: number;
  topic: string;
  rolePreference: RolePreference;
  sourceBlockId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteEvent {
  id: string;
  actorId: string;
  eventType: 'created' | 'accepted' | 'declined' | 'cancelled' | 'rescheduled';
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface InviteDetail extends InviteSummary {
  events: InviteEvent[];
}

export interface AvailabilityBlockSummary {
  blockId: string;
  proposalId: string;
  startsAt: string;
  status: 'open' | 'claimed' | 'cancelled';
  claimedBy: { id: string; fullName: string } | null;
  mockInterviewId: string | null;
}

export interface MyAvailabilityProposal {
  id: string;
  durationMinutes: number;
  topic: string;
  notes: string;
  rolePreference: RolePreference;
  createdAt: string;
  blocks: AvailabilityBlockSummary[];
}

export interface MyAvailability {
  proposals: MyAvailabilityProposal[];
}

export interface FeedBlock {
  blockId: string;
  proposalId: string;
  postedBy: { id: string; fullName: string; initials: string };
  startsAt: string;
  durationMinutes: number;
  topic: string;
  notes: string;
  rolePreference: RolePreference;
}

export interface MockPeer {
  id: string;
  fullName: string;
  initials: string;
  defaultRolePreference: RolePreference;
}
```

If a `MockPeer` type already exists, extend it with `defaultRolePreference` rather than redeclaring.

- [ ] **Step 2: Write `useMockInterviews` hook**

Create `client/src/hooks/useMockInterviews.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type {
  InviteDetail,
  InviteStatus,
  InviteSummary,
  MockPeer,
  RolePreference,
} from '../types.js';

export function useMockInterviewPeers() {
  const [peers, setPeers] = useState<MockPeer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get<MockPeer[]>('/api/practice/mock-interviews/peers')
      .then((data) => { if (active) setPeers(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { peers, loading };
}

type Direction = 'sent' | 'received' | 'all';

export function useInvites(options: { direction?: Direction; statuses?: InviteStatus[] } = {}) {
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (options.direction) params.set('direction', options.direction);
    if (options.statuses && options.statuses.length > 0) params.set('status', options.statuses.join(','));
    const qs = params.toString();
    const data = await api.get<InviteSummary[]>(`/api/practice/mock-interviews${qs ? `?${qs}` : ''}`);
    setInvites(data);
    setLoading(false);
  }, [options.direction, (options.statuses || []).join(',')]);

  useEffect(() => { refresh(); }, [refresh]);

  const schedule = useCallback(async (payload: {
    peerId: string; scheduledFor: string; durationMinutes: number; topic: string; rolePreference: RolePreference;
  }): Promise<{ id: string }> => {
    const result = await api.post<{ id: string }>('/api/practice/mock-interviews/schedule', payload);
    await refresh();
    return result;
  }, [refresh]);

  const accept = useCallback(async (id: string) => { await api.post(`/api/practice/mock-interviews/${id}/accept`, {}); await refresh(); }, [refresh]);
  const decline = useCallback(async (id: string) => { await api.post(`/api/practice/mock-interviews/${id}/decline`, {}); await refresh(); }, [refresh]);
  const cancel = useCallback(async (id: string) => { await api.post(`/api/practice/mock-interviews/${id}/cancel`, {}); await refresh(); }, [refresh]);
  const reschedule = useCallback(async (id: string, scheduledFor: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/reschedule`, { scheduledFor });
    await refresh();
  }, [refresh]);

  return { invites, loading, refresh, schedule, accept, decline, cancel, reschedule };
}

export function useInviteDetail(id: string | null) {
  const [detail, setDetail] = useState<InviteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) { setDetail(null); return; }
    let active = true;
    setLoading(true);
    api.get<InviteDetail>(`/api/practice/mock-interviews/${id}`)
      .then((d) => { if (active) setDetail(d); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  return { detail, loading };
}
```

- [ ] **Step 3: Write `useAvailability` hook**

Create `client/src/hooks/useAvailability.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { FeedBlock, MyAvailability, RolePreference } from '../types.js';

export function useMyAvailability() {
  const [data, setData] = useState<MyAvailability>({ proposals: [] });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const fresh = await api.get<MyAvailability>('/api/practice/availability/mine');
    setData(fresh);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (payload: {
    durationMinutes: number; topic: string; notes: string; rolePreference: RolePreference;
    blocks: Array<{ startsAt: string }>;
  }): Promise<{ proposalId: string }> => {
    const result = await api.post<{ proposalId: string }>('/api/practice/availability', payload);
    await refresh();
    return result;
  }, [refresh]);

  const cancelBlock = useCallback(async (blockId: string) => {
    await api.delete(`/api/practice/availability/blocks/${blockId}`);
    await refresh();
  }, [refresh]);

  const cancelProposal = useCallback(async (proposalId: string) => {
    await api.delete(`/api/practice/availability/${proposalId}`);
    await refresh();
  }, [refresh]);

  return { data, loading, refresh, create, cancelBlock, cancelProposal };
}

export function useFeed(filters: { role?: 'interviewee' | 'interviewer' | 'any'; topic?: string; from?: string; to?: string } = {}) {
  const [blocks, setBlocks] = useState<FeedBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.role && filters.role !== 'any') p.set('role', filters.role);
    if (filters.topic) p.set('topic', filters.topic);
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    const qs = p.toString();
    const fresh = await api.get<FeedBlock[]>(`/api/practice/availability/feed${qs ? `?${qs}` : ''}`);
    setBlocks(fresh);
    setLoading(false);
  }, [filters.role, filters.topic, filters.from, filters.to]);

  useEffect(() => { refresh(); }, [refresh]);

  const claim = useCallback(async (blockId: string, rolePreference: RolePreference, notes?: string) => {
    await api.post(`/api/practice/availability/blocks/${blockId}/claim`, { rolePreference, notes });
    await refresh();
  }, [refresh]);

  return { blocks, loading, refresh, claim };
}
```

- [ ] **Step 4: Remove `useMockPeers` from `usePractice.ts`**

Find and delete the entire `useMockPeers` function export. If `MockPeer` type is re-exported from `usePractice.ts`, leave that — otherwise also remove. Delete the `scheduleMock` and `proposeAvailability` functions if they exist as part of that export.

- [ ] **Step 5: Verify client still compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: compile errors only in files that still import `useMockPeers` / old modal (to be fixed in later tasks). If there are unrelated errors, fix them.

- [ ] **Step 6: Check `api.delete` exists**

Verify `client/src/api/client.ts` exports a `delete` method. If not, add one:

```typescript
delete: async (path: string) => apiFetch(path, { method: 'DELETE' }),
```

Follow the existing pattern used by `get` / `post` / `put` in that file.

- [ ] **Step 7: Commit**

```bash
git add client/src/types.ts client/src/hooks/useMockInterviews.ts client/src/hooks/useAvailability.ts client/src/hooks/usePractice.ts client/src/api/client.ts
git commit -m "feat(client): types + hooks for find-a-peer redesign"
```

---

## Task 12: `CreateModal` — invite + multi-block availability

**Files:**
- Create: `client/src/components/mock-interviews/CreateModal.tsx`
- Create: `client/src/components/mock-interviews/CreateModal.test.tsx`

### Steps

- [ ] **Step 1: Write failing test for submit behavior + role default**

Create `client/src/components/mock-interviews/CreateModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateModal } from './CreateModal';

const peer = { id: '2', fullName: 'Bob B.', initials: 'BB', defaultRolePreference: 'interviewee' as const };

describe('CreateModal', () => {
  it('pre-fills role from defaultRolePreference', () => {
    render(
      <CreateModal
        peers={[peer]}
        defaultRolePreference="interviewer"
        onClose={() => {}}
        onScheduleInvite={async () => ({ id: '1' })}
        onPostAvailability={async () => ({ proposalId: '1' })}
      />
    );
    // Role segmented control reflects "interviewer" by default on the invite tab.
    const interviewerBtn = screen.getByRole('radio', { name: /I want to interview/i });
    expect(interviewerBtn).toBeChecked();
  });

  it('submits multi-block availability with N blocks', async () => {
    const onPostAvailability = vi.fn().mockResolvedValue({ proposalId: '77' });
    render(
      <CreateModal
        peers={[peer]}
        defaultRolePreference="either"
        onClose={() => {}}
        onScheduleInvite={async () => ({ id: '1' })}
        onPostAvailability={onPostAvailability}
      />
    );
    // Switch to availability tab.
    fireEvent.click(screen.getByRole('tab', { name: /Post availability/i }));
    // Default starts with 1 block. Add two more.
    fireEvent.click(screen.getByRole('button', { name: /\+ Add block/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Add block/i }));
    // Submit.
    fireEvent.click(screen.getByRole('button', { name: /Post 3 block/i }));
    await waitFor(() => expect(onPostAvailability).toHaveBeenCalledTimes(1));
    const [call] = onPostAvailability.mock.calls[0];
    expect(call.blocks).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test — expect fail (module missing)**

```bash
cd client && npx vitest run src/components/mock-interviews/CreateModal.test.tsx
```

- [ ] **Step 3: Implement `CreateModal`**

Create `client/src/components/mock-interviews/CreateModal.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import type { MockPeer, RolePreference } from '../../types.js';

type Mode = 'invite' | 'availability';

interface Props {
  peers: MockPeer[];
  defaultRolePreference: RolePreference;
  onClose: () => void;
  onScheduleInvite: (payload: {
    peerId: string; topic: string; scheduledFor: string; durationMinutes: number; rolePreference: RolePreference;
  }) => Promise<{ id: string }>;
  onPostAvailability: (payload: {
    durationMinutes: number; topic: string; notes: string; rolePreference: RolePreference;
    blocks: Array<{ startsAt: string }>;
  }) => Promise<{ proposalId: string }>;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function parseLocalInput(v: string): string | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const ROLE_LABELS: Record<RolePreference, string> = {
  interviewee: 'I want to be interviewed',
  interviewer: 'I want to interview',
  either: 'Either',
};

function RoleSelector({ value, onChange }: { value: RolePreference; onChange: (v: RolePreference) => void }) {
  return (
    <div role="radiogroup" aria-label="Role preference" className="role-selector">
      {(['interviewee', 'interviewer', 'either'] as RolePreference[]).map((role) => (
        <label key={role} className={`role-option${value === role ? ' selected' : ''}`}>
          <input
            type="radio"
            name="role-preference"
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
          />
          <span>{ROLE_LABELS[role]}</span>
        </label>
      ))}
    </div>
  );
}

export function CreateModal({ peers, defaultRolePreference, onClose, onScheduleInvite, onPostAvailability }: Props) {
  const defaultLocal = useMemo(() => toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)), []);
  const [mode, setMode] = useState<Mode>(peers.length > 0 ? 'invite' : 'availability');
  const [peerId, setPeerId] = useState(peers[0]?.id ?? '');
  const [role, setRole] = useState<RolePreference>(defaultRolePreference);
  const [topic, setTopic] = useState('Systems Design');
  const [duration, setDuration] = useState(45);
  const [scheduledLocal, setScheduledLocal] = useState(defaultLocal);
  const [notes, setNotes] = useState('');
  const [blocks, setBlocks] = useState<string[]>([defaultLocal]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (peers.length === 0) { setMode('availability'); setPeerId(''); return; }
    setPeerId((p) => peers.some((x) => x.id === p) ? p : peers[0].id);
  }, [peers]);

  const submitInvite = async () => {
    setError('');
    const iso = parseLocalInput(scheduledLocal);
    if (!peerId) { setError('Pick a peer.'); return; }
    if (!iso) { setError('Pick a valid time.'); return; }
    setSubmitting(true);
    try {
      await onScheduleInvite({ peerId, scheduledFor: iso, durationMinutes: duration, topic: topic.trim() || 'General Technical', rolePreference: role });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not send invite.');
    } finally { setSubmitting(false); }
  };

  const submitAvailability = async () => {
    setError('');
    if (blocks.length < 1 || blocks.length > 8) { setError('Post 1–8 blocks.'); return; }
    const isoBlocks: Array<{ startsAt: string }> = [];
    for (const b of blocks) {
      const iso = parseLocalInput(b);
      if (!iso) { setError('One or more blocks have invalid times.'); return; }
      isoBlocks.push({ startsAt: iso });
    }
    setSubmitting(true);
    try {
      await onPostAvailability({ durationMinutes: duration, topic: topic.trim() || 'General Technical', notes: notes.trim(), rolePreference: role, blocks: isoBlocks });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not post availability.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal mock-interview-modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-kicker">Mock Interviews</p>
        <h2 id="create-modal-title" className="modal-title">Find a Peer</h2>

        <div className="mock-modal-tabs" role="tablist" aria-label="Mock interview flow">
          <button type="button" role="tab" aria-selected={mode === 'invite'} disabled={peers.length === 0}
            className={`mock-modal-tab${mode === 'invite' ? ' active' : ''}`} onClick={() => setMode('invite')}>
            Invite a Peer
          </button>
          <button type="button" role="tab" aria-selected={mode === 'availability'}
            className={`mock-modal-tab${mode === 'availability' ? ' active' : ''}`} onClick={() => setMode('availability')}>
            Post availability
          </button>
        </div>

        <label className="field-label">Role preference</label>
        <RoleSelector value={role} onChange={setRole} />

        <label className="field-label" htmlFor="cm-topic">Topic</label>
        <input id="cm-topic" className="practice-input" value={topic} onChange={(e) => setTopic(e.target.value)} />

        <label className="field-label" htmlFor="cm-duration">Duration</label>
        <select id="cm-duration" className="practice-select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
          <option value={90}>90 minutes</option>
        </select>

        {mode === 'invite' ? (
          <>
            <label className="field-label">Peer</label>
            <div className="mock-peer-list">
              {peers.map((p) => (
                <label key={p.id} className={`mock-peer-option${peerId === p.id ? ' selected' : ''}`}>
                  <input type="radio" name="peer" value={p.id} checked={peerId === p.id}
                    onChange={(e) => setPeerId(e.target.value)} />
                  <span className="mock-peer-option-avatar">{p.initials}</span>
                  <span className="mock-peer-option-name">{p.fullName}</span>
                </label>
              ))}
            </div>
            <label className="field-label" htmlFor="cm-time">Proposed time</label>
            <input id="cm-time" type="datetime-local" className="practice-input" value={scheduledLocal}
              onChange={(e) => setScheduledLocal(e.target.value)} />
          </>
        ) : (
          <>
            <label className="field-label">Time blocks ({blocks.length})</label>
            <div className="availability-blocks">
              {blocks.map((b, i) => (
                <div key={i} className="availability-block-row">
                  <input type="datetime-local" className="practice-input" value={b}
                    onChange={(e) => setBlocks((bs) => bs.map((x, idx) => idx === i ? e.target.value : x))} />
                  {blocks.length > 1 && (
                    <button type="button" aria-label="Remove block"
                      onClick={() => setBlocks((bs) => bs.filter((_, idx) => idx !== i))}>×</button>
                  )}
                </div>
              ))}
              {blocks.length < 8 && (
                <button type="button" className="secondary-link"
                  onClick={() => setBlocks((bs) => [...bs, defaultLocal])}>+ Add block</button>
              )}
            </div>
            <label className="field-label" htmlFor="cm-notes">Notes</label>
            <textarea id="cm-notes" className="practice-textarea" value={notes}
              onChange={(e) => setNotes(e.target.value)} rows={3} />
          </>
        )}

        {error && <p className="mock-modal-error">{error}</p>}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="primary-action"
            onClick={mode === 'invite' ? submitInvite : submitAvailability}
            disabled={submitting || (mode === 'invite' && peers.length === 0)}>
            {mode === 'invite' ? 'Send invite' : `Post ${blocks.length} block${blocks.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run CreateModal test — expect pass**

```bash
cd client && npx vitest run src/components/mock-interviews/CreateModal.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/mock-interviews/CreateModal.tsx client/src/components/mock-interviews/CreateModal.test.tsx
git commit -m "feat(client): CreateModal with multi-block availability + role selector"
```

---

## Task 13: `InviteDetailModal`

**Files:**
- Create: `client/src/components/mock-interviews/InviteDetailModal.tsx`
- Create: `client/src/components/mock-interviews/InviteDetailModal.test.tsx`

### Steps

- [ ] **Step 1: Write failing test for timeline ordering**

Create `client/src/components/mock-interviews/InviteDetailModal.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InviteDetailModal } from './InviteDetailModal';
import type { InviteDetail } from '../../types.js';

const detail: InviteDetail = {
  id: '1', direction: 'sent',
  counterparty: { id: '2', fullName: 'Bob Brown', initials: 'BB' },
  status: 'accepted', scheduledFor: '2026-05-01T14:00:00Z', durationMinutes: 45,
  topic: 'DSA', rolePreference: 'interviewer', sourceBlockId: null,
  createdAt: '2026-04-20T10:00:00Z', updatedAt: '2026-04-20T11:00:00Z',
  events: [
    { id: 'e1', actorId: '1', eventType: 'created', payload: null, createdAt: '2026-04-20T10:00:00Z' },
    { id: 'e2', actorId: '2', eventType: 'accepted', payload: null, createdAt: '2026-04-20T11:00:00Z' },
  ],
};

describe('InviteDetailModal', () => {
  it('renders timeline in chronological order', () => {
    render(<InviteDetailModal detail={detail} onClose={() => {}} onAction={async () => {}} callerId="1" />);
    const timeline = screen.getByRole('list', { name: /timeline/i });
    const items = within(timeline).getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/created/i);
    expect(items[1].textContent).toMatch(/accepted/i);
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `InviteDetailModal`**

Create `client/src/components/mock-interviews/InviteDetailModal.tsx`:

```typescript
import { useEffect } from 'react';
import type { InviteDetail } from '../../types.js';

type InviteAction = 'accept' | 'decline' | 'cancel' | 'reschedule';

interface Props {
  detail: InviteDetail;
  callerId: string;
  onClose: () => void;
  onAction: (action: InviteAction, args?: { scheduledFor?: string }) => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function eventLabel(e: InviteDetail['events'][number]): string {
  switch (e.eventType) {
    case 'created': return 'Invite created';
    case 'accepted': return 'Accepted';
    case 'declined': return 'Declined';
    case 'cancelled': return 'Cancelled';
    case 'rescheduled': {
      const p = e.payload as { from?: string; to?: string } | null;
      return p?.from && p?.to ? `Rescheduled from ${formatDate(p.from)} to ${formatDate(p.to)}` : 'Rescheduled';
    }
    default: return e.eventType;
  }
}

export function InviteDetailModal({ detail, callerId, onClose, onAction }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isInitiator = detail.direction === 'sent';
  const isPeer = detail.direction === 'received';
  const isPending = detail.status === 'pending_acceptance';
  const isAccepted = detail.status === 'accepted';
  const isPreTerminal = isPending || isAccepted;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{detail.topic || 'Mock interview'}</h2>
        <p className="modal-body">
          With {detail.counterparty.fullName} · {formatDate(detail.scheduledFor)} · {detail.durationMinutes} min · status: {detail.status}
          {detail.sourceBlockId && <> · from {detail.counterparty.fullName}'s posted availability</>}
        </p>

        <div className="invite-actions">
          {isPeer && isPending && (
            <>
              <button type="button" className="primary-action" onClick={() => onAction('accept')}>Accept</button>
              <button type="button" className="secondary-link" onClick={() => onAction('decline')}>Decline</button>
            </>
          )}
          {isPreTerminal && (
            <button type="button" className="secondary-link" onClick={() => onAction('cancel')}>Cancel</button>
          )}
          {isPreTerminal && (
            <button type="button" className="secondary-link" onClick={() => {
              const v = window.prompt('New time (ISO):', detail.scheduledFor);
              if (v) onAction('reschedule', { scheduledFor: v });
            }}>Reschedule</button>
          )}
        </div>

        <h3>Timeline</h3>
        <ul className="invite-timeline" aria-label="timeline">
          {detail.events.map((e) => (
            <li key={e.id}>
              <span className="timeline-when">{formatDate(e.createdAt)}</span>
              <span className="timeline-what">{eventLabel(e)}</span>
              <span className="timeline-who">{e.actorId === callerId ? 'you' : detail.counterparty.fullName}</span>
            </li>
          ))}
        </ul>

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect pass**

- [ ] **Step 5: Commit**

```bash
git add client/src/components/mock-interviews/InviteDetailModal.tsx client/src/components/mock-interviews/InviteDetailModal.test.tsx
git commit -m "feat(client): InviteDetailModal with event timeline"
```

---

## Task 14: `MyAvailabilityModal`

**Files:**
- Create: `client/src/components/mock-interviews/MyAvailabilityModal.tsx`

### Steps

- [ ] **Step 1: Implement the modal**

Create `client/src/components/mock-interviews/MyAvailabilityModal.tsx`:

```typescript
import { useEffect } from 'react';
import type { MyAvailability } from '../../types.js';

interface Props {
  data: MyAvailability;
  onClose: () => void;
  onCancelBlock: (blockId: string) => Promise<void>;
  onCancelProposal: (proposalId: string) => Promise<void>;
  onPostMore: () => void;
}

function fmt(iso: string): string { return new Date(iso).toLocaleString(); }

export function MyAvailabilityModal({ data, onClose, onCancelBlock, onCancelProposal, onPostMore }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasAny = data.proposals.some((p) => p.blocks.length > 0);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="my-availability-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="my-availability-title" className="modal-title">Your availability</h2>
        {!hasAny && (
          <p className="modal-body">Post a few time blocks and peers can claim them directly.</p>
        )}
        {data.proposals.map((p) => (
          <section key={p.id} className="availability-proposal-section">
            <header>
              <strong>{p.topic || 'General'}</strong> · {p.durationMinutes} min · role: {p.rolePreference}
              <button type="button" className="secondary-link" onClick={() => onCancelProposal(p.id)}>Cancel all open</button>
            </header>
            <ul>
              {p.blocks.map((b) => (
                <li key={b.blockId} className={`availability-block availability-block--${b.status}`}>
                  <span>{fmt(b.startsAt)}</span>
                  <span>status: {b.status}</span>
                  {b.status === 'open' && (
                    <button type="button" className="secondary-link" onClick={() => onCancelBlock(b.blockId)}>Cancel</button>
                  )}
                  {b.status === 'claimed' && b.claimedBy && (
                    <span>claimed by {b.claimedBy.fullName}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>Close</button>
          <button type="button" className="primary-action" onClick={onPostMore}>Post more blocks</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/mock-interviews/MyAvailabilityModal.tsx
git commit -m "feat(client): MyAvailabilityModal"
```

---

## Task 15: `AvailabilityFeedModal`

**Files:**
- Create: `client/src/components/mock-interviews/AvailabilityFeedModal.tsx`

### Steps

- [ ] **Step 1: Implement the modal**

Create `client/src/components/mock-interviews/AvailabilityFeedModal.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import type { FeedBlock, RolePreference } from '../../types.js';

interface Props {
  blocks: FeedBlock[];
  loading: boolean;
  roleFilter: 'any' | 'interviewee' | 'interviewer';
  onRoleFilterChange: (v: 'any' | 'interviewee' | 'interviewer') => void;
  onClose: () => void;
  onClaim: (blockId: string, rolePreference: RolePreference, notes?: string) => Promise<void>;
}

function fmt(iso: string): string { return new Date(iso).toLocaleString(); }

export function AvailabilityFeedModal({ blocks, loading, roleFilter, onRoleFilterChange, onClose, onClaim }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    const byUser = new Map<string, FeedBlock[]>();
    for (const b of blocks) {
      const list = byUser.get(b.postedBy.id) ?? [];
      list.push(b);
      byUser.set(b.postedBy.id, list);
    }
    return Array.from(byUser.entries());
  }, [blocks]);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimRole, setClaimRole] = useState<RolePreference>('either');
  const [claimNotes, setClaimNotes] = useState('');

  async function confirmClaim(blockId: string) {
    await onClaim(blockId, claimRole, claimNotes || undefined);
    setClaimingId(null);
    setClaimNotes('');
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feed-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel practice-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="feed-modal-title" className="modal-title">Open availability</h2>

        <label className="field-label" htmlFor="feed-role">Role filter</label>
        <select id="feed-role" className="practice-select" value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value as any)}>
          <option value="any">Any</option>
          <option value="interviewee">Wants to be interviewed</option>
          <option value="interviewer">Wants to interview</option>
        </select>

        {loading && <p className="modal-body">Loading…</p>}
        {!loading && blocks.length === 0 && (
          <p className="modal-body">No open availability matches your filters. Try widening the role filter.</p>
        )}

        {grouped.map(([userId, items]) => (
          <section key={userId} className="feed-group">
            <header><strong>{items[0].postedBy.fullName}</strong> · {items.length} block(s)</header>
            <ul>
              {items.map((b) => (
                <li key={b.blockId} className="feed-block-row">
                  <span>{fmt(b.startsAt)}</span>
                  <span>{b.durationMinutes} min</span>
                  <span>role: {b.rolePreference}</span>
                  {claimingId === b.blockId ? (
                    <span className="claim-confirm">
                      Your role:
                      <select value={claimRole} onChange={(e) => setClaimRole(e.target.value as RolePreference)}>
                        <option value="interviewee">Interviewee</option>
                        <option value="interviewer">Interviewer</option>
                        <option value="either">Either</option>
                      </select>
                      <input type="text" placeholder="Notes (optional)" value={claimNotes}
                        onChange={(e) => setClaimNotes(e.target.value)} />
                      <button type="button" className="primary-action" onClick={() => confirmClaim(b.blockId)}>Confirm</button>
                      <button type="button" className="secondary-link" onClick={() => setClaimingId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className="primary-action" onClick={() => setClaimingId(b.blockId)}>Claim</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="practice-modal-footer">
          <button type="button" className="secondary-link" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/mock-interviews/AvailabilityFeedModal.tsx
git commit -m "feat(client): AvailabilityFeedModal with grouped browse + claim confirm"
```

---

## Task 16: `MockInterviewsSection` + wire into `PracticePage`

**Files:**
- Create: `client/src/components/mock-interviews/MockInterviewsSection.tsx`
- Create: `client/src/components/mock-interviews/MockInterviewsSection.test.tsx`
- Modify: `client/src/pages/PracticePage.tsx`
- Delete: `client/src/components/MockInterviewModal.tsx`

### Steps

- [ ] **Step 1: Write failing test for section rendering**

Create `client/src/components/mock-interviews/MockInterviewsSection.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockInterviewsSection } from './MockInterviewsSection';

vi.mock('../../hooks/useMockInterviews', () => ({
  useMockInterviewPeers: () => ({ peers: [], loading: false }),
  useInvites: () => ({
    invites: [],
    loading: false,
    refresh: vi.fn(), schedule: vi.fn(), accept: vi.fn(),
    decline: vi.fn(), cancel: vi.fn(), reschedule: vi.fn(),
  }),
  useInviteDetail: () => ({ detail: null, loading: false }),
}));
vi.mock('../../hooks/useAvailability', () => ({
  useMyAvailability: () => ({ data: { proposals: [] }, loading: false, refresh: vi.fn(), create: vi.fn(), cancelBlock: vi.fn(), cancelProposal: vi.fn() }),
  useFeed: () => ({ blocks: [], loading: false, refresh: vi.fn(), claim: vi.fn() }),
}));

describe('MockInterviewsSection', () => {
  it('renders empty states for all four cards', () => {
    render(<MockInterviewsSection callerId="1" defaultRolePreference="either" />);
    expect(screen.getByText(/Nothing waiting on you/i)).toBeInTheDocument();
    expect(screen.getByText(/haven't sent any invites/i)).toBeInTheDocument();
    expect(screen.getByText(/Post a few time blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/No open availability/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement `MockInterviewsSection`**

Create `client/src/components/mock-interviews/MockInterviewsSection.tsx`:

```typescript
import { useState } from 'react';
import { useInvites, useMockInterviewPeers, useInviteDetail } from '../../hooks/useMockInterviews.js';
import { useMyAvailability, useFeed } from '../../hooks/useAvailability.js';
import type { InviteSummary, RolePreference } from '../../types.js';
import { CreateModal } from './CreateModal.js';
import { InviteDetailModal } from './InviteDetailModal.js';
import { MyAvailabilityModal } from './MyAvailabilityModal.js';
import { AvailabilityFeedModal } from './AvailabilityFeedModal.js';

interface Props {
  callerId: string;
  defaultRolePreference: RolePreference;
}

export function MockInterviewsSection({ callerId, defaultRolePreference }: Props) {
  const { peers } = useMockInterviewPeers();
  const { invites, schedule, accept, decline, cancel, reschedule, refresh: refreshInvites } = useInvites();
  const { data: myAvailability, create: createAvailability, cancelBlock, cancelProposal, refresh: refreshMine } = useMyAvailability();
  const [roleFilter, setRoleFilter] = useState<'any' | 'interviewee' | 'interviewer'>('any');
  const { blocks: feedBlocks, loading: feedLoading, claim, refresh: refreshFeed } = useFeed({ role: roleFilter });
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const { detail } = useInviteDetail(openDetailId);
  const [openCreate, setOpenCreate] = useState(false);
  const [openMine, setOpenMine] = useState(false);
  const [openFeed, setOpenFeed] = useState(false);

  const received = invites.filter((i) => i.direction === 'received' && i.status === 'pending_acceptance');
  const sent = invites.filter((i) => i.direction === 'sent' && (i.status === 'pending_acceptance' || i.status === 'accepted'));
  const openBlocks = myAvailability.proposals.flatMap((p) => p.blocks.filter((b) => b.status === 'open'));

  return (
    <section className="mock-interviews-section">
      <header><h2>Mock interviews</h2></header>
      <div className="mock-section-grid">
        {/* Received invites */}
        <article className="mock-card">
          <header>Received invites ({received.length})</header>
          {received.length === 0 && <p>Nothing waiting on you. Claim availability below or send an invite to get started.</p>}
          <ul>
            {received.slice(0, 3).map((inv) => (
              <li key={inv.id}>
                <button type="button" className="secondary-link" onClick={() => setOpenDetailId(inv.id)}>{inv.counterparty.fullName} · {inv.topic} · {new Date(inv.scheduledFor).toLocaleString()}</button>
                <button type="button" onClick={() => accept(inv.id)}>Accept</button>
                <button type="button" onClick={() => decline(inv.id)}>Decline</button>
              </li>
            ))}
          </ul>
        </article>

        {/* Sent invites */}
        <article className="mock-card">
          <header>Sent invites ({sent.length})</header>
          {sent.length === 0 && <p>You haven't sent any invites yet.</p>}
          <ul>
            {sent.slice(0, 3).map((inv) => (
              <li key={inv.id}>
                <button type="button" className="secondary-link" onClick={() => setOpenDetailId(inv.id)}>{inv.counterparty.fullName} · {inv.topic} · {inv.status}</button>
                <button type="button" onClick={() => cancel(inv.id)}>Cancel</button>
              </li>
            ))}
          </ul>
          <button type="button" className="primary-action" onClick={() => setOpenCreate(true)}>Find a peer</button>
        </article>

        {/* My availability */}
        <article className="mock-card">
          <header>My availability ({openBlocks.length} open)</header>
          {openBlocks.length === 0 && <p>Post a few time blocks and peers can claim them directly.</p>}
          <ul>
            {openBlocks.slice(0, 3).map((b) => (<li key={b.blockId}>{new Date(b.startsAt).toLocaleString()}</li>))}
          </ul>
          <button type="button" className="primary-action" onClick={() => setOpenCreate(true)}>Post availability</button>
          <button type="button" className="secondary-link" onClick={() => setOpenMine(true)}>View all</button>
        </article>

        {/* Feed */}
        <article className="mock-card">
          <header>Open availability feed</header>
          <label>Filter: <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
            <option value="any">Any</option>
            <option value="interviewee">Wants to be interviewed</option>
            <option value="interviewer">Wants to interview</option>
          </select></label>
          {feedBlocks.length === 0 && !feedLoading && <p>No open availability matches your filters. Try widening the role filter.</p>}
          <ul>
            {feedBlocks.slice(0, 5).map((b) => (
              <li key={b.blockId}>
                {b.postedBy.fullName} · {new Date(b.startsAt).toLocaleString()} · {b.rolePreference}
                <button type="button" onClick={() => setOpenFeed(true)}>Claim</button>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-link" onClick={() => setOpenFeed(true)}>Browse more</button>
        </article>
      </div>

      {openCreate && (
        <CreateModal
          peers={peers}
          defaultRolePreference={defaultRolePreference}
          onClose={() => setOpenCreate(false)}
          onScheduleInvite={async (p) => { const r = await schedule(p); return r; }}
          onPostAvailability={async (p) => { const r = await createAvailability(p); await refreshMine(); return r; }}
        />
      )}
      {openDetailId && detail && (
        <InviteDetailModal
          detail={detail}
          callerId={callerId}
          onClose={() => setOpenDetailId(null)}
          onAction={async (action, args) => {
            if (action === 'accept') await accept(detail.id);
            else if (action === 'decline') await decline(detail.id);
            else if (action === 'cancel') await cancel(detail.id);
            else if (action === 'reschedule' && args?.scheduledFor) await reschedule(detail.id, args.scheduledFor);
            setOpenDetailId(null);
          }}
        />
      )}
      {openMine && (
        <MyAvailabilityModal
          data={myAvailability}
          onClose={() => setOpenMine(false)}
          onCancelBlock={cancelBlock}
          onCancelProposal={cancelProposal}
          onPostMore={() => { setOpenMine(false); setOpenCreate(true); }}
        />
      )}
      {openFeed && (
        <AvailabilityFeedModal
          blocks={feedBlocks}
          loading={feedLoading}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          onClose={() => { setOpenFeed(false); refreshFeed(); refreshInvites(); }}
          onClaim={async (blockId, role, notes) => { await claim(blockId, role, notes); await refreshInvites(); }}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 3: Wire into `PracticePage`**

In `client/src/pages/PracticePage.tsx`:

- Remove the import of `MockInterviewModal`
- Remove `useMockPeers`-derived code (`peers`, `scheduleMock`, `proposeAvailability`, `visiblePeers`, `extraPeers`, `showMockModal`, `mockFeedback`)
- Add import: `import { MockInterviewsSection } from '../components/mock-interviews/MockInterviewsSection.js';`
- In JSX, insert `<MockInterviewsSection callerId={String(user.id)} defaultRolePreference={user.defaultRolePreference ?? 'either'} />` between the existing Daily Challenge and Analytics sections. (The exact positions depend on current page structure — place it in the natural slot.)
- Remove the `<MockInterviewModal ... />` block and its associated state.
- Remove `mockFeedback` rendering if any — the new detail modal handles confirmation.

The `user` object comes from the existing auth context; confirm `AuthUser` includes `defaultRolePreference`. If not, add it to the type and adjust `/api/user/me` handler to include it (in `server/src/routes/auth.ts` or wherever `/me` is implemented — add `default_role_preference` to the SELECT and response).

- [ ] **Step 4: Delete old modal**

```bash
git rm client/src/components/MockInterviewModal.tsx
```

- [ ] **Step 5: Run client tests + typecheck**

```bash
cd client && npx tsc --noEmit && npx vitest run
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/mock-interviews/MockInterviewsSection.tsx client/src/components/mock-interviews/MockInterviewsSection.test.tsx client/src/pages/PracticePage.tsx
git commit -m "feat(client): MockInterviewsSection on PracticePage; remove old modal"
```

---

## Task 17: Settings page — default role preference

**Files:**
- Modify: `client/src/pages/SettingsPage.tsx`

### Steps

- [ ] **Step 1: Add role preference selector**

In `client/src/pages/SettingsPage.tsx`, locate where other preference fields (like `allowMockInterviews`) are rendered and add a new labeled select:

```typescript
<label className="setting-row">
  <span>Default role preference</span>
  <select
    value={preferences.defaultRolePreference}
    onChange={(e) => updatePreference('defaultRolePreference', e.target.value as RolePreference)}
  >
    <option value="either">Either (default)</option>
    <option value="interviewee">I want to be interviewed</option>
    <option value="interviewer">I want to interview</option>
  </select>
</label>
```

Add `RolePreference` to the types imported by the page.

The existing `updatePreference` helper should already PUT to `/api/user/preferences` — it will now include `defaultRolePreference` as part of the payload since the backend accepts it after Task 10.

- [ ] **Step 2: Verify typecheck**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/SettingsPage.tsx
git commit -m "feat(client): default role preference selector in Settings"
```

---

## Task 18: CSS styling

**Files:**
- Modify: `client/src/index.css`

### Steps

- [ ] **Step 1: Add styles for new components**

Append to `client/src/index.css`:

```css
/* Mock interviews section on PracticePage */
.mock-interviews-section { margin-top: 2rem; }
.mock-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}
.mock-card {
  background: var(--panel-bg, #1a1a1a);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mock-card header { font-weight: 600; margin-bottom: 0.25rem; }
.mock-card ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.mock-card li { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

/* Availability block picker in CreateModal */
.availability-blocks { display: flex; flex-direction: column; gap: 0.5rem; }
.availability-block-row { display: flex; gap: 0.5rem; align-items: center; }
.availability-block-row button { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.2em; }

/* Role selector (segmented control) */
.role-selector { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.role-option { flex: 1; padding: 0.5rem; border: 1px solid var(--border, #333); border-radius: 6px; cursor: pointer; text-align: center; }
.role-option.selected { background: var(--accent, #3b82f6); color: white; }
.role-option input { display: none; }

/* Invite timeline */
.invite-timeline { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.invite-timeline li { display: flex; gap: 0.75rem; padding: 0.25rem 0; border-bottom: 1px solid var(--border-subtle, #222); }
.timeline-when { color: var(--muted); min-width: 10em; }
.timeline-what { flex: 1; }
.timeline-who { color: var(--muted); font-style: italic; }

/* Availability block states */
.availability-block { display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0; }
.availability-block--claimed { color: var(--muted); }
.availability-block--cancelled { text-decoration: line-through; color: var(--muted); }

/* Feed group */
.feed-group { margin-top: 1rem; }
.feed-group header { font-weight: 600; margin-bottom: 0.5rem; }
.feed-block-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.claim-confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
```

Use the variable names (`--panel-bg`, `--accent`, `--muted`, `--border`) that already exist in the file if they differ — check the top of `index.css` for the actual variable names and adjust.

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "style(client): CSS for MockInterviewsSection and mock-interview modals"
```

---

## Task 19: End-to-end verification

**Files:** (none modified)

### Steps

- [ ] **Step 1: Start server**

```bash
npm run dev:server
```

- [ ] **Step 2: Start client**

```bash
npm run dev:client
```

- [ ] **Step 3: Manual smoke test — golden path**

Open the app in a browser, sign in as User A, then in a second browser (or incognito) as User B:

1. **Settings** (both users): enable "Allow mock interviews"; set User A's default role to `interviewer`, User B's to `interviewee`.
2. **User A → Practice page** — verify the "Mock interviews" section shows four empty cards.
3. **User A** clicks "Post availability" → availability tab → add 3 time blocks → submit.
4. **User B → Practice page** — feed card shows User A's blocks. Filter by role: `interviewee`. Confirm A's blocks (role=either) still show. Claim one block, confirm with role=interviewer.
5. **User A** sees received invite → click Accept. Verify status flips to `accepted` and appears in sent-invites-of-B as well (for B it's a sent invite).
6. **User B** clicks into the invite → verify event timeline shows created → accepted.
7. **User A** tries to reschedule → confirm status returns to `pending_acceptance` and timeline records it.
8. **User B** declines another invite — confirm status becomes `declined` and it no longer appears in the received card.
9. **Conflict test**: User B accepts invite at 14:00–14:45. User A sends a second invite to B at 14:30 — confirm 409 error toast with conflicting invite reference.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all server and client tests pass.

- [ ] **Step 5: Mark TODO item #2 complete in `docs/project-todo.md`**

In `docs/project-todo.md`, flip the `- [ ]` to `- [x]` for the "Redesign 'Find a Peer' scheduling flow" bullet.

- [ ] **Step 6: Final commit**

```bash
git add docs/project-todo.md
git commit -m "chore: mark find-a-peer redesign complete in project TODO"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Schema migrations → Task 1 ✓
  - Helpers (role compat, overlap, events) → Task 2 ✓
  - Peer list, invite list → Task 3 ✓
  - Invite detail → Task 4 ✓
  - Schedule → Task 5 ✓
  - Accept/decline/cancel/reschedule → Task 6 ✓
  - Availability create/mine/cancel → Task 7 ✓
  - Feed → Task 8 ✓
  - Claim → Task 9 ✓
  - Old route removal + `defaultRolePreference` → Task 10 ✓
  - Client types + hooks → Task 11 ✓
  - CreateModal → Task 12 ✓
  - InviteDetailModal → Task 13 ✓
  - MyAvailabilityModal → Task 14 ✓
  - AvailabilityFeedModal → Task 15 ✓
  - Section + PracticePage wiring → Task 16 ✓
  - Settings → Task 17 ✓
  - CSS → Task 18 ✓
  - E2E + mark complete → Task 19 ✓

- **Type consistency:** `RolePreference`, `InviteStatus`, `InviteSummary`, `InviteDetail`, `FeedBlock`, `MyAvailability`, `MockPeer` — all defined in Task 11 before consumption in Tasks 12–17. Server `insertEvent`, `findOverlappingInvite`, `isRoleCompatible`, `isValidRole`, `getInitials` defined in Task 2 before consumption in Tasks 3–10.

- **Known leftover:** `/api/user/me` must surface `defaultRolePreference` on the `AuthUser`. Task 16 Step 3 calls this out; follow the existing `/me` handler in `server/src/routes/auth.ts` and add the column to the SELECT + response.
