# Calendar Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a user-facing `/schedule` page with agenda-view mock interviews, per-event ICS export, and a persistent per-user timezone preference applied consistently across scheduling UI.

**Architecture:** Narrow server additions (one column migration, two new routes, three extended responses) plus a new React page + hook + shared date-formatting util. Existing lifecycle, data model, and overlap logic are untouched; this layer reads the existing data and presents it.

**Tech Stack:** Hono 4 + better-sqlite3 + Vitest on the server. React 18 + Vite + react-router-dom 6 + Vitest + @testing-library/react on the client. ICS generation is a ~40-line pure-TS util (no new dep). Timezone validation uses built-in `Intl.DateTimeFormat`.

**Spec:** `docs/superpowers/specs/2026-04-21-calendar-phase-1-design.md`

---

## File structure

### New files
- `server/src/lib/ics.ts` — ICS generation (pure fn)
- `server/src/lib/ics.test.ts`
- `server/src/routes/schedule.ts` — `GET /api/schedule`, `GET /api/schedule/ics/:id`
- `server/src/routes/schedule.test.ts`
- `client/src/lib/scheduling-dates.ts` — formatting/grouping utilities
- `client/src/lib/scheduling-dates.test.ts`
- `client/src/hooks/useSchedule.ts`
- `client/src/pages/SchedulePage.tsx`
- `client/src/pages/SchedulePage.test.tsx`
- `client/src/components/schedule/ScheduleAgenda.tsx`
- `client/src/components/schedule/ScheduleAgenda.test.tsx`
- `client/src/components/schedule/ScheduleEventCard.tsx`
- `client/src/components/schedule/ScheduleEventCard.test.tsx`
- `client/src/components/schedule/TimezoneSelect.tsx`

### Modified files
- `server/src/db/schema.ts` — add `timezone` column migration
- `server/src/lib/scheduling.ts` — extend `fetchInviteSummaryRows` with window/status opts
- `server/src/routes/user.ts` — accept/return `timezone` in profile
- `server/src/routes/user.test.ts` — coverage for timezone round-trip
- `server/src/routes/auth.ts` — include `timezone` in `/me` response
- `server/src/routes/auth.test.ts` — coverage for `/me` returning `timezone`
- `server/src/index.ts` — mount schedule router
- `client/src/types.ts` — extend `AuthUser` with `timezone`; add `ScheduleResponse`
- `client/src/main.tsx` — add `/schedule` route
- `client/src/components/Layout.tsx` — "Schedule" link in topbar
- `client/src/pages/SettingsPage.tsx` — timezone row
- `client/src/components/mock-interviews/MockInterviewsSection.tsx` — swap `formatWhen` → `formatInZone`, add "View full schedule" link
- `client/src/components/mock-interviews/InviteDetailModal.tsx` — swap `formatWhen` → `formatInZone`
- `client/src/components/mock-interviews/MyAvailabilityModal.tsx` — swap `formatWhen` → `formatInZone`
- `client/src/components/mock-interviews/AvailabilityFeedModal.tsx` — swap `formatWhen` → `formatInZone`
- `client/src/components/mock-interviews/CreateModal.tsx` — swap any local formatting

---

## Task 1: Add `timezone` column to `users` table

**Files:**
- Modify: `server/src/db/schema.ts`
- Test: `server/src/db/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `server/src/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from './schema.js';

describe('timezone column', () => {
  it('adds timezone to users with UTC default', () => {
    const db = new Database(':memory:');
    applySchema(db);
    db.prepare("INSERT INTO users (email) VALUES ('a@b.c')").run();
    const row = db.prepare('SELECT timezone FROM users WHERE email = ?').get('a@b.c') as { timezone: string };
    expect(row.timezone).toBe('UTC');
  });

  it('is idempotent across repeated applySchema calls', () => {
    const db = new Database(':memory:');
    applySchema(db);
    applySchema(db);
    db.prepare("INSERT INTO users (email) VALUES ('a@b.c')").run();
    const row = db.prepare('SELECT timezone FROM users WHERE email = ?').get('a@b.c') as { timezone: string };
    expect(row.timezone).toBe('UTC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/db/schema.test.ts`

Expected: FAIL — `no such column: timezone`.

- [ ] **Step 3: Add migration to `applySchema`**

In `server/src/db/schema.ts`, add this line to the `addCol` block (right after the other `ALTER TABLE users` lines near line 224):

```ts
addCol("ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/db/schema.test.ts`

Expected: PASS (both new tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema.ts server/src/db/schema.test.ts
git commit -m "feat(server): add timezone column to users table"
```

---

## Task 2: ICS generation library

**Files:**
- Create: `server/src/lib/ics.ts`
- Test: `server/src/lib/ics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/lib/ics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildIcsEvent } from './ics.js';

describe('buildIcsEvent', () => {
  const sample = {
    uid: 'mock-invite-42@studyapp',
    summary: 'Mock interview with Alice',
    description: 'Topic: System design',
    startIso: '2026-04-23T19:00:00.000Z',
    durationMinutes: 45,
    dtstampIso: '2026-04-21T18:00:00.000Z',
  };

  it('uses CRLF line endings per RFC 5545', () => {
    const body = buildIcsEvent(sample);
    const lines = body.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(body).not.toMatch(/[^\r]\n/);
  });

  it('includes all required fields', () => {
    const body = buildIcsEvent(sample);
    expect(body).toContain('VERSION:2.0');
    expect(body).toContain('PRODID:-//study-app//mock-interviews//EN');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain('UID:mock-invite-42@studyapp');
    expect(body).toContain('DTSTAMP:20260421T180000Z');
    expect(body).toContain('DTSTART:20260423T190000Z');
    expect(body).toContain('DTEND:20260423T194500Z');
    expect(body).toContain('SUMMARY:Mock interview with Alice');
    expect(body).toContain('STATUS:CONFIRMED');
    expect(body).toContain('END:VEVENT');
    expect(body).toContain('END:VCALENDAR');
  });

  it('computes DTEND from duration correctly', () => {
    const body = buildIcsEvent({ ...sample, durationMinutes: 60 });
    expect(body).toContain('DTEND:20260423T200000Z');
  });

  it('escapes commas, semicolons, backslashes, and newlines in text fields', () => {
    const body = buildIcsEvent({
      ...sample,
      summary: 'A, B; C\\ D\nE',
      description: 'x,y;z\\\nq',
    });
    expect(body).toContain('SUMMARY:A\\, B\\; C\\\\ D\\nE');
    expect(body).toContain('DESCRIPTION:x\\,y\\;z\\\\\\nq');
  });

  it('produces a stable UID across repeated calls with same input', () => {
    const a = buildIcsEvent(sample);
    const b = buildIcsEvent(sample);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/lib/ics.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/src/lib/ics.ts`**

```ts
export interface IcsEventInput {
  uid: string;
  summary: string;
  description: string;
  startIso: string;
  durationMinutes: number;
  dtstampIso: string;
}

function formatIcsTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function buildIcsEvent(input: IcsEventInput): string {
  const endIso = new Date(
    new Date(input.startIso).getTime() + input.durationMinutes * 60_000,
  ).toISOString();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//study-app//mock-interviews//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsTime(input.dtstampIso)}`,
    `DTSTART:${formatIcsTime(input.startIso)}`,
    `DTEND:${formatIcsTime(endIso)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/lib/ics.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/ics.ts server/src/lib/ics.test.ts
git commit -m "feat(server): add ICS event generation util"
```

---

## Task 3: Extend `fetchInviteSummaryRows` with window + status options

**Files:**
- Modify: `server/src/lib/scheduling.ts:62-100`
- Test: reuse existing tests; add a new test to `server/src/lib/scheduling.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server/src/lib/scheduling.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { fetchInviteSummaryRows } from './scheduling.js';

function makeUser(db: Database.Database, email: string): number {
  const info = db.prepare('INSERT INTO users (email, full_name) VALUES (?, ?)').run(email, email);
  return Number(info.lastInsertRowid);
}

function makeInvite(
  db: Database.Database,
  initiator: number,
  peer: number,
  scheduledFor: string,
  status = 'accepted',
): number {
  const info = db.prepare(`
    INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
    VALUES (?, ?, ?, ?, 45, 'T', 'either')
  `).run(initiator, peer, status, scheduledFor);
  return Number(info.lastInsertRowid);
}

describe('fetchInviteSummaryRows window filtering', () => {
  let db: Database.Database;
  let u1: number;
  let u2: number;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    u1 = makeUser(db, 'a@b.c');
    u2 = makeUser(db, 'c@d.e');
  });

  it('filters by windowFrom (exclusive lower bound)', () => {
    makeInvite(db, u1, u2, '2026-04-01T10:00:00.000Z');
    makeInvite(db, u1, u2, '2026-05-01T10:00:00.000Z');
    const rows = fetchInviteSummaryRows(db, u1, { windowFrom: '2026-04-15T00:00:00.000Z' });
    expect(rows).toHaveLength(1);
    expect(rows[0].scheduled_for).toBe('2026-05-01T10:00:00.000Z');
  });

  it('filters by windowTo (exclusive upper bound)', () => {
    makeInvite(db, u1, u2, '2026-04-01T10:00:00.000Z');
    makeInvite(db, u1, u2, '2026-05-01T10:00:00.000Z');
    const rows = fetchInviteSummaryRows(db, u1, { windowTo: '2026-04-15T00:00:00.000Z' });
    expect(rows).toHaveLength(1);
    expect(rows[0].scheduled_for).toBe('2026-04-01T10:00:00.000Z');
  });

  it('filters by explicit statuses array', () => {
    makeInvite(db, u1, u2, '2026-05-01T10:00:00.000Z', 'accepted');
    makeInvite(db, u1, u2, '2026-05-02T10:00:00.000Z', 'cancelled');
    const rows = fetchInviteSummaryRows(db, u1, { statuses: ['accepted'] });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('accepted');
  });

  it('orders ascending when sort option is "asc"', () => {
    makeInvite(db, u1, u2, '2026-05-01T10:00:00.000Z');
    makeInvite(db, u1, u2, '2026-04-01T10:00:00.000Z');
    const rows = fetchInviteSummaryRows(db, u1, { sort: 'asc' });
    expect(rows.map((r) => r.scheduled_for)).toEqual([
      '2026-04-01T10:00:00.000Z',
      '2026-05-01T10:00:00.000Z',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/lib/scheduling.test.ts`

Expected: FAIL — `windowFrom`/`windowTo`/`sort` options not applied.

- [ ] **Step 3: Extend `fetchInviteSummaryRows`**

Replace the function body in `server/src/lib/scheduling.ts:62-100` with:

```ts
export function fetchInviteSummaryRows(
  db: Database.Database,
  userId: number,
  opts: {
    direction?: 'sent' | 'received' | 'all';
    statuses?: string[];
    windowFrom?: string;
    windowTo?: string;
    sort?: 'asc' | 'desc';
  } = {},
): InviteSummaryRow[] {
  const direction = opts.direction ?? 'all';
  const sort = opts.sort ?? 'desc';
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

  if (opts.windowFrom) {
    filters.push('datetime(mi.scheduled_for) >= datetime(?)');
    params.push(opts.windowFrom);
  }

  if (opts.windowTo) {
    filters.push('datetime(mi.scheduled_for) < datetime(?)');
    params.push(opts.windowTo);
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
    ORDER BY mi.scheduled_for ${sort === 'asc' ? 'ASC' : 'DESC'}
    LIMIT 200
  `;
  return db.prepare(sql).all(userId, ...params) as InviteSummaryRow[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/lib/scheduling.test.ts`

Expected: PASS (4 new tests + any existing).

- [ ] **Step 5: Run full server suite to confirm no regressions**

Run: `cd server && npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/scheduling.ts server/src/lib/scheduling.test.ts
git commit -m "feat(server): extend fetchInviteSummaryRows with window + sort opts"
```

---

## Task 4: Create `/api/schedule` router (list + ICS)

**Files:**
- Create: `server/src/routes/schedule.ts`
- Create: `server/src/routes/schedule.test.ts`
- Modify: `server/src/config.ts` (add `BASE_URL`)

- [ ] **Step 1: Add `BASE_URL` to config**

In `server/src/config.ts`, add to the exported `config` object:

```ts
BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
```

- [ ] **Step 2: Write failing tests**

Create `server/src/routes/schedule.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { applySchema } from '../db/schema.js';
import { makeScheduleRouter } from './schedule.js';
import { signAccessToken } from '../lib/jwt.js';

async function authHeader(userId: number, email: string): Promise<string> {
  const token = await signAccessToken(userId, email);
  return `access_token=${token}`;
}

function makeApp(db: Database.Database): Hono {
  const app = new Hono();
  app.route('/api/schedule', makeScheduleRouter(db));
  return app;
}

function makeUser(db: Database.Database, email: string, fullName = 'U'): number {
  const info = db.prepare('INSERT INTO users (email, full_name) VALUES (?, ?)').run(email, fullName);
  return Number(info.lastInsertRowid);
}

function makeInvite(
  db: Database.Database,
  initiator: number,
  peer: number,
  scheduledFor: string,
  status: string,
  topic = 'System design',
): number {
  const info = db.prepare(`
    INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
    VALUES (?, ?, ?, ?, 45, ?, 'either')
  `).run(initiator, peer, status, scheduledFor, topic);
  return Number(info.lastInsertRowid);
}

describe('GET /api/schedule', () => {
  let db: Database.Database;
  let u1: number;
  let u2: number;
  let u3: number;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    u1 = makeUser(db, 'a@b.c', 'Alice');
    u2 = makeUser(db, 'c@d.e', 'Bob');
    u3 = makeUser(db, 'e@f.g', 'Carol');
  });

  it('requires auth', async () => {
    const res = await makeApp(db).request('/api/schedule');
    expect(res.status).toBe(401);
  });

  it('excludes cancelled and declined invites', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, future, 'accepted');
    makeInvite(db, u1, u2, future, 'cancelled');
    makeInvite(db, u1, u2, future, 'declined');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].status).toBe('accepted');
  });

  it('includes pending_acceptance and accepted invites, both directions', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, future, 'pending_acceptance');
    makeInvite(db, u2, u1, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(2);
    const directions = body.invites.map((i: any) => i.direction).sort();
    expect(directions).toEqual(['received', 'sent']);
  });

  it('does not leak invites where caller is not a party', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u2, u3, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(0);
  });

  it('excludes past events by default', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, past, 'accepted');
    makeInvite(db, u1, u2, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].scheduledFor).toBe(future);
  });

  it('includes past events when includePast=true', async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const future = new Date(Date.now() + 86400_000).toISOString();
    makeInvite(db, u1, u2, past, 'accepted');
    makeInvite(db, u1, u2, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule?includePast=true', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites).toHaveLength(2);
  });

  it('returns events in ascending time order', async () => {
    const t1 = new Date(Date.now() + 86400_000).toISOString();
    const t2 = new Date(Date.now() + 2 * 86400_000).toISOString();
    makeInvite(db, u1, u2, t2, 'accepted');
    makeInvite(db, u1, u2, t1, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule', { headers: { cookie } });
    const body = await res.json();
    expect(body.invites.map((i: any) => i.scheduledFor)).toEqual([t1, t2]);
  });
});

describe('GET /api/schedule/ics/:id', () => {
  let db: Database.Database;
  let u1: number;
  let u2: number;
  let u3: number;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    u1 = makeUser(db, 'a@b.c', 'Alice');
    u2 = makeUser(db, 'c@d.e', 'Bob');
    u3 = makeUser(db, 'e@f.g', 'Carol');
  });

  it('returns 404 for a missing invite', async () => {
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request('/api/schedule/ics/999', { headers: { cookie } });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not a party', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const id = makeInvite(db, u2, u3, future, 'accepted');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request(`/api/schedule/ics/${id}`, { headers: { cookie } });
    expect(res.status).toBe(403);
  });

  it('returns 422 when invite is not accepted', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const id = makeInvite(db, u1, u2, future, 'pending_acceptance');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request(`/api/schedule/ics/${id}`, { headers: { cookie } });
    expect(res.status).toBe(422);
  });

  it('returns a valid ICS body with correct headers on accepted invite', async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const id = makeInvite(db, u1, u2, future, 'accepted', 'System design');
    const cookie = await authHeader(u1, 'a@b.c');
    const res = await makeApp(db).request(`/api/schedule/ics/${id}`, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    expect(res.headers.get('content-disposition')).toContain(`filename="mock-interview-${id}.ics"`);
    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain(`UID:mock-invite-${id}@`);
    expect(body).toContain('SUMMARY:Mock interview with Bob');
    expect(body).toContain('System design');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/schedule.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 4: Create `server/src/routes/schedule.ts`**

```ts
import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { fetchInviteSummaryRows, getInitials } from '../lib/scheduling.js';
import { buildIcsEvent } from '../lib/ics.js';
import { config } from '../config.js';

const SCHEDULE_STATUSES = ['pending_acceptance', 'accepted'];

function summaryToResponse(row: any, callerId: number) {
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

export function makeScheduleRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/', (c) => {
    const user = c.get('user');
    const includePast = c.req.query('includePast') === 'true';
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const defaultTo = new Date(now.getTime() + 90 * 86_400_000).toISOString();
    const windowFrom = includePast
      ? (c.req.query('from') ?? defaultFrom)
      : new Date(Math.max(now.getTime(), Date.parse(c.req.query('from') ?? defaultFrom))).toISOString();
    const windowTo = c.req.query('to') ?? defaultTo;

    const rows = fetchInviteSummaryRows(db, user.id, {
      statuses: SCHEDULE_STATUSES,
      windowFrom,
      windowTo,
      sort: 'asc',
    });
    return c.json({ invites: rows.map((r) => summaryToResponse(r, user.id)) });
  });

  router.get('/ics/:id', (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400);

    const row = db.prepare(`
      SELECT mi.id, mi.initiator_id, mi.peer_id, mi.status, mi.scheduled_for,
             mi.duration_minutes, mi.topic,
             counterparty.full_name AS counterparty_full_name
      FROM mock_interviews mi
      JOIN users counterparty ON counterparty.id =
        CASE WHEN mi.initiator_id = ? THEN mi.peer_id ELSE mi.initiator_id END
      WHERE mi.id = ?
    `).get(user.id, id) as
      | { id: number; initiator_id: number; peer_id: number; status: string; scheduled_for: string; duration_minutes: number; topic: string | null; counterparty_full_name: string | null }
      | undefined;

    if (!row) return c.json({ error: 'not_found' }, 404);
    if (row.initiator_id !== user.id && row.peer_id !== user.id) {
      return c.json({ error: 'forbidden' }, 403);
    }
    if (row.status !== 'accepted') {
      return c.json({ error: 'invalid_state' }, 422);
    }

    const baseHost = new URL(config.BASE_URL).host;
    const counterparty = row.counterparty_full_name || 'Anonymous User';
    const topic = row.topic || 'General Technical';
    const inviteUrl = `${config.BASE_URL}/practice`;

    const ics = buildIcsEvent({
      uid: `mock-invite-${row.id}@${baseHost}`,
      summary: `Mock interview with ${counterparty}`,
      description: `Topic: ${topic}\n\nOpen in app: ${inviteUrl}`,
      startIso: row.scheduled_for,
      durationMinutes: row.duration_minutes,
      dtstampIso: new Date().toISOString(),
    });

    return new Response(ics, {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `attachment; filename="mock-interview-${row.id}.ics"`,
      },
    });
  });

  return router;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/schedule.test.ts`

Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/config.ts server/src/routes/schedule.ts server/src/routes/schedule.test.ts
git commit -m "feat(server): add /api/schedule list + ICS export routes"
```

---

## Task 5: Wire `timezone` into user profile routes

**Files:**
- Modify: `server/src/routes/user.ts`
- Modify: `server/src/routes/user.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server/src/routes/user.test.ts` (after existing tests):

```ts
describe('profile timezone field', () => {
  it('GET /profile returns timezone (default UTC for new users)', async () => {
    const { db, app, cookie } = await setupProfileTestWithUser(); // existing helper pattern
    const res = await app.request('/api/user/profile', { headers: { cookie } });
    const body = await res.json();
    expect(body.timezone).toBe('UTC');
  });

  it('PUT /profile accepts a valid IANA timezone', async () => {
    const { app, cookie } = await setupProfileTestWithUser();
    const res = await app.request('/api/user/profile', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ timezone: 'America/New_York' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timezone).toBe('America/New_York');
  });

  it('PUT /profile rejects garbage timezone with 400', async () => {
    const { app, cookie } = await setupProfileTestWithUser();
    const res = await app.request('/api/user/profile', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ timezone: 'Not/A_Real_Zone' }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /profile persists timezone across requests', async () => {
    const { app, cookie } = await setupProfileTestWithUser();
    await app.request('/api/user/profile', {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ timezone: 'Europe/Berlin' }),
    });
    const res = await app.request('/api/user/profile', { headers: { cookie } });
    const body = await res.json();
    expect(body.timezone).toBe('Europe/Berlin');
  });
});
```

If `setupProfileTestWithUser` does not already exist in `user.test.ts`, inline the setup matching the patterns used by other existing tests in that file. Inspect the top of the file before adding these tests and mirror its helpers.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/routes/user.test.ts`

Expected: FAIL — `timezone` not on response / not accepted.

- [ ] **Step 3: Update `server/src/routes/user.ts`**

Replace the `ProfileRow` interface and the `/profile` GET/PUT handlers:

```ts
interface ProfileRow {
  id: number;
  email: string;
  full_name: string | null;
  bio: string | null;
  timezone: string | null;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// inside makeUserRouter:
  router.get('/profile', (c) => {
    const user = c.get('user');
    const row = db.prepare(
      'SELECT id, email, full_name, bio, timezone FROM users WHERE id = ?'
    ).get(user.id) as ProfileRow | undefined;

    if (!row) return c.json({ error: 'Not found' }, 404);

    return c.json({
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? '',
      bio: row.bio ?? '',
      timezone: row.timezone ?? 'UTC',
    });
  });

  router.put('/profile', async (c) => {
    const user = c.get('user');
    const body: { fullName?: string; bio?: string; timezone?: string } = await c.req
      .json<{ fullName?: string; bio?: string; timezone?: string }>()
      .catch(() => ({}));

    if (body.timezone !== undefined && !isValidTimezone(body.timezone)) {
      return c.json({ error: 'invalid_timezone' }, 400);
    }

    const current = db.prepare(
      'SELECT id, email, full_name, bio, timezone FROM users WHERE id = ?'
    ).get(user.id) as ProfileRow | undefined;

    if (!current) return c.json({ error: 'Not found' }, 404);

    const fullName = typeof body.fullName === 'string'
      ? body.fullName.slice(0, 100)
      : (current.full_name ?? '');
    const bio = typeof body.bio === 'string'
      ? body.bio.slice(0, 500)
      : (current.bio ?? '');
    const timezone = typeof body.timezone === 'string'
      ? body.timezone
      : (current.timezone ?? 'UTC');

    db.prepare('UPDATE users SET full_name = ?, bio = ?, timezone = ? WHERE id = ?').run(fullName, bio, timezone, user.id);

    return c.json({
      id: current.id,
      email: current.email,
      fullName,
      bio,
      timezone,
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/user.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/user.ts server/src/routes/user.test.ts
git commit -m "feat(server): accept and return timezone on user profile"
```

---

## Task 6: Include `timezone` in `/api/auth/me`

**Files:**
- Modify: `server/src/routes/auth.ts:114-123`
- Modify: `server/src/routes/auth.test.ts`

- [ ] **Step 1: Write failing test**

Add to `server/src/routes/auth.test.ts`:

```ts
it('GET /me includes timezone (defaults to UTC)', async () => {
  const { app, cookie } = await signupAndLogin('tz@test.com'); // use existing helper
  const res = await app.request('/api/auth/me', { headers: { cookie } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.timezone).toBe('UTC');
});

it('GET /me reflects updated timezone after profile PUT', async () => {
  const { app, cookie } = await signupAndLogin('tz2@test.com');
  await app.request('/api/user/profile', {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ timezone: 'Asia/Tokyo' }),
  });
  const res = await app.request('/api/auth/me', { headers: { cookie } });
  const body = await res.json();
  expect(body.timezone).toBe('Asia/Tokyo');
});
```

If `signupAndLogin` does not exist, mirror the helper pattern already used in `auth.test.ts`. The test app must mount both `/api/auth` and `/api/user` routers.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/auth.test.ts`

Expected: FAIL — `timezone` not in response.

- [ ] **Step 3: Update `/me` handler**

In `server/src/routes/auth.ts` around line 114, replace the `/me` handler:

```ts
router.get('/me', requireAuth, (c) => {
  const user = c.get('user');
  const row = db
    .prepare('SELECT timezone FROM users WHERE id = ?')
    .get(user.id) as { timezone: string | null } | undefined;
  const pref = db
    .prepare('SELECT default_role_preference FROM user_preferences WHERE user_id = ?')
    .get(user.id) as { default_role_preference: string | null } | undefined;
  return c.json({
    id: user.id,
    email: user.email,
    timezone: row?.timezone ?? 'UTC',
    defaultRolePreference: (pref?.default_role_preference ?? 'either') as 'interviewee' | 'interviewer' | 'either',
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/routes/auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/auth.ts server/src/routes/auth.test.ts
git commit -m "feat(server): expose timezone on /api/auth/me"
```

---

## Task 7: Mount the schedule router

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add import and route**

After the other route imports in `server/src/index.ts`, add:

```ts
import { makeScheduleRouter } from './routes/schedule.js';
```

After `app.route('/api/practice/availability', ...)` add:

```ts
app.route('/api/schedule', makeScheduleRouter(db));
```

- [ ] **Step 2: Run full server suite**

Run: `cd server && npm test`

Expected: all tests pass (route lives under `/api/schedule` per test configuration in Task 4).

- [ ] **Step 3: Manual smoke — start server, hit endpoint**

```bash
cd server && npm run dev &
# wait a second
curl -s http://localhost:3000/api/schedule
# Expected: 401 {"error":"Unauthorized"} — confirms route is mounted
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): mount /api/schedule router"
```

---

## Task 8: Extend `AuthUser` client type + add schedule types

**Files:**
- Modify: `client/src/types.ts`

- [ ] **Step 1: Add timezone + schedule types**

In `client/src/types.ts`, modify `AuthUser`:

```ts
export interface AuthUser {
  id: number;
  email: string;
  timezone: string;
  defaultRolePreference?: RolePreference;
}
```

Append at the end of the file:

```ts
export interface ScheduleResponse {
  invites: InviteSummary[];
}
```

Also add a `timezone` field to the profile type if one exists (search for `fullName` in `types.ts`; if not, this is fine — SettingsPage will read profile shape inline).

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`

Expected: PASS. If callsites for `AuthUser` fail due to missing `timezone`, those are fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add client/src/types.ts
git commit -m "feat(client): add timezone to AuthUser, ScheduleResponse type"
```

---

## Task 9: Create `scheduling-dates.ts` util + tests

**Files:**
- Create: `client/src/lib/scheduling-dates.ts`
- Create: `client/src/lib/scheduling-dates.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// client/src/lib/scheduling-dates.test.ts
import { describe, it, expect } from 'vitest';
import { formatInZone, getZoneAbbrev, groupByDay, isPast } from './scheduling-dates.js';

describe('formatInZone', () => {
  it('renders the time in the given IANA zone', () => {
    // 2026-06-15T19:00:00Z is 15:00 EDT in America/New_York (DST active)
    const out = formatInZone('2026-06-15T19:00:00.000Z', 'America/New_York');
    expect(out).toMatch(/Mon.*Jun 15.*3:00 PM/);
    expect(out).toContain('EDT');
  });

  it('renders different times for different zones', () => {
    const nyc = formatInZone('2026-06-15T19:00:00.000Z', 'America/New_York');
    const ldn = formatInZone('2026-06-15T19:00:00.000Z', 'Europe/London');
    expect(nyc).not.toBe(ldn);
  });

  it('falls back to browser zone on invalid tz without throwing', () => {
    const out = formatInZone('2026-06-15T19:00:00.000Z', 'Not/A_Zone');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('getZoneAbbrev', () => {
  it('returns EDT vs EST at correct times of year', () => {
    const summer = getZoneAbbrev('2026-06-15T19:00:00.000Z', 'America/New_York');
    const winter = getZoneAbbrev('2026-01-15T19:00:00.000Z', 'America/New_York');
    expect(summer).toBe('EDT');
    expect(winter).toBe('EST');
  });
});

describe('groupByDay', () => {
  const base = (iso: string) => ({
    id: iso,
    direction: 'sent' as const,
    counterparty: { id: 'x', fullName: 'X', initials: 'X' },
    status: 'accepted' as const,
    scheduledFor: iso,
    durationMinutes: 45,
    topic: 't',
    rolePreference: 'either' as const,
    sourceBlockId: null,
    createdAt: '',
    updatedAt: '',
  });

  it('groups events by day in the USER zone, not UTC', () => {
    // 2026-06-15T03:30:00Z is 23:30 on 2026-06-14 in America/New_York (EDT)
    // In UTC this would group as 2026-06-15; in NY it must group as 2026-06-14.
    const groups = groupByDay([base('2026-06-15T03:30:00.000Z')], 'America/New_York');
    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe('2026-06-14');
  });

  it('labels Today / Tomorrow based on user zone', () => {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString();
    const groups = groupByDay([base(now.toISOString()), base(tomorrow)], tz);
    expect(groups[0].label).toBe('Today');
    expect(groups[1].label).toBe('Tomorrow');
  });

  it('preserves ascending order of events within a day', () => {
    const groups = groupByDay(
      [
        base('2026-06-15T20:00:00.000Z'),
        base('2026-06-15T15:00:00.000Z'),
      ],
      'America/New_York',
    );
    expect(groups[0].items.map((i) => i.scheduledFor)).toEqual([
      '2026-06-15T15:00:00.000Z',
      '2026-06-15T20:00:00.000Z',
    ]);
  });
});

describe('isPast', () => {
  it('returns true for past ISO', () => {
    expect(isPast(new Date(Date.now() - 60_000).toISOString())).toBe(true);
  });
  it('returns false for future ISO', () => {
    expect(isPast(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/lib/scheduling-dates.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Create `client/src/lib/scheduling-dates.ts`**

```ts
import type { InviteSummary } from '../types.js';

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

export function formatInZone(
  iso: string,
  tz: string,
  _opts?: { includeWeekday?: boolean },
): string {
  const zone = safeZone(tz);
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  });
  const d = new Date(iso);
  return `${dateFmt.format(d)} · ${timeFmt.format(d)} ${getZoneAbbrev(iso, zone)}`.trim();
}

export function getZoneAbbrev(iso: string, tz: string): string {
  const zone = safeZone(tz);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'short',
  }).formatToParts(new Date(iso));
  const part = parts.find((p) => p.type === 'timeZoneName');
  return part ? part.value : '';
}

function dayKeyInZone(iso: string, tz: string): string {
  const zone = safeZone(tz);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayLabel(dayKey: string, tz: string): string {
  const todayKey = dayKeyInZone(new Date().toISOString(), tz);
  const tomorrow = new Date(Date.now() + 86_400_000);
  const tomorrowKey = dayKeyInZone(tomorrow.toISOString(), tz);
  if (dayKey === todayKey) return 'Today';
  if (dayKey === tomorrowKey) return 'Tomorrow';
  const [y, m, d] = dayKey.split('-').map(Number);
  const sample = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(sample);
}

export function groupByDay(
  invites: InviteSummary[],
  tz: string,
): Array<{ dayKey: string; label: string; items: InviteSummary[] }> {
  const zone = safeZone(tz);
  const sorted = [...invites].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const buckets = new Map<string, InviteSummary[]>();
  for (const inv of sorted) {
    const key = dayKeyInZone(inv.scheduledFor, zone);
    const list = buckets.get(key) ?? [];
    list.push(inv);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries()).map(([dayKey, items]) => ({
    dayKey,
    label: dayLabel(dayKey, zone),
    items,
  }));
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/lib/scheduling-dates.test.ts`

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/scheduling-dates.ts client/src/lib/scheduling-dates.test.ts
git commit -m "feat(client): add scheduling-dates util with tz-aware formatting"
```

---

## Task 10: Migrate existing scheduling components to use `formatInZone`

**Files:**
- Modify: `client/src/components/mock-interviews/MockInterviewsSection.tsx:15-20`
- Modify: `client/src/components/mock-interviews/InviteDetailModal.tsx`
- Modify: `client/src/components/mock-interviews/MyAvailabilityModal.tsx`
- Modify: `client/src/components/mock-interviews/AvailabilityFeedModal.tsx`
- Modify: `client/src/components/mock-interviews/CreateModal.tsx`
- Modify: `client/src/components/ProtectedRoute.tsx` (if it fetches `/me`, ensure `timezone` is part of the user state)

- [ ] **Step 1: Audit every caller of `formatWhen`**

Run: `cd client && grep -rn "formatWhen\|new Date(.*).toLocale" src/components/mock-interviews src/pages`

Note each callsite.

- [ ] **Step 2: Update `MockInterviewsSection.tsx`**

Remove the local `formatWhen` function (lines ~15-20). Replace imports and usage:

```tsx
import { useAuth } from '../../hooks/useAuth.js'; // or wherever the auth user context lives
import { formatInZone } from '../../lib/scheduling-dates.js';
```

If no `useAuth` hook exists, this component already receives `callerId` via props; change `Props` to also take `userTimezone: string` and thread it from `PracticePage`. Replace every `formatWhen(iso)` call with `formatInZone(iso, userTimezone)`.

Inspect `PracticePage.tsx` — it reads the auth user and passes `callerId`/`defaultRolePreference` to `MockInterviewsSection`. Add `userTimezone={user.timezone}` to that render.

- [ ] **Step 3: Update modal components similarly**

In each of:
- `InviteDetailModal.tsx`
- `MyAvailabilityModal.tsx`
- `AvailabilityFeedModal.tsx`
- `CreateModal.tsx`

Replace any inline `new Date(iso).toLocaleString(...)` or local `formatWhen` with `formatInZone(iso, userTimezone)`. Thread `userTimezone` via props from `MockInterviewsSection`.

- [ ] **Step 4: Run existing client tests**

Run: `cd client && npm test`

Expected: all tests pass. Existing tests that rely on string matching may need the `userTimezone` prop provided. If a test uses a hard-coded UTC zone, pass `userTimezone="UTC"`.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/mock-interviews/ client/src/pages/PracticePage.tsx
git commit -m "refactor(client): swap local formatWhen for tz-aware formatInZone"
```

---

## Task 11: `useSchedule` hook

**Files:**
- Create: `client/src/hooks/useSchedule.ts`

- [ ] **Step 1: Implement the hook**

```ts
// client/src/hooks/useSchedule.ts
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import type { InviteSummary, ScheduleResponse } from '../types.js';

export function useSchedule(options: { showPast: boolean }) {
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = options.showPast ? '?includePast=true' : '';
      const res = await api.get<ScheduleResponse>(`/api/schedule${qs}`);
      setInvites(res.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [options.showPast]);

  useEffect(() => { refresh(); }, [refresh]);

  const accept = useCallback(async (id: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/accept`, {});
    await refresh();
  }, [refresh]);

  const decline = useCallback(async (id: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/decline`, {});
    await refresh();
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/cancel`, {});
    await refresh();
  }, [refresh]);

  const reschedule = useCallback(async (id: string, scheduledFor: string) => {
    await api.post(`/api/practice/mock-interviews/${id}/reschedule`, { scheduledFor });
    await refresh();
  }, [refresh]);

  return { invites, loading, error, refresh, accept, decline, cancel, reschedule };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd client && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useSchedule.ts
git commit -m "feat(client): add useSchedule hook"
```

---

## Task 12: `ScheduleEventCard` component

**Files:**
- Create: `client/src/components/schedule/ScheduleEventCard.tsx`
- Create: `client/src/components/schedule/ScheduleEventCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// client/src/components/schedule/ScheduleEventCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleEventCard } from './ScheduleEventCard.js';
import type { InviteSummary } from '../../types.js';

const futureIso = new Date(Date.now() + 86_400_000).toISOString();

function makeInvite(overrides: Partial<InviteSummary> = {}): InviteSummary {
  return {
    id: '1',
    direction: 'received',
    counterparty: { id: '2', fullName: 'Bob', initials: 'B' },
    status: 'pending_acceptance',
    scheduledFor: futureIso,
    durationMinutes: 45,
    topic: 'System design',
    rolePreference: 'either',
    sourceBlockId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('ScheduleEventCard', () => {
  it('shows Accept/Decline/Reschedule/Details for received pending invites', () => {
    render(<ScheduleEventCard invite={makeInvite({ direction: 'received', status: 'pending_acceptance' })} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to calendar/i })).toBeNull();
  });

  it('shows Cancel/Reschedule/Details for sent pending invites', () => {
    render(<ScheduleEventCard invite={makeInvite({ direction: 'sent', status: 'pending_acceptance' })} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
  });

  it('shows Add to calendar/Reschedule/Cancel/Details for accepted invites', () => {
    render(<ScheduleEventCard invite={makeInvite({ status: 'accepted' })} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByRole('link', { name: /add to calendar/i })).toHaveAttribute('href', '/api/schedule/ics/1');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onAction("accept", id) when Accept is clicked', async () => {
    const onAction = vi.fn();
    render(<ScheduleEventCard invite={makeInvite()} tz="UTC" onAction={onAction} onOpenDetail={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAction).toHaveBeenCalledWith('accept', '1');
  });

  it('renders counterparty name and topic', () => {
    render(<ScheduleEventCard invite={makeInvite()} tz="UTC" onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/System design/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/schedule/ScheduleEventCard.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

```tsx
// client/src/components/schedule/ScheduleEventCard.tsx
import type { InviteSummary } from '../../types.js';
import { formatInZone } from '../../lib/scheduling-dates.js';

type Action = 'accept' | 'decline' | 'cancel' | 'reschedule';

interface Props {
  invite: InviteSummary;
  tz: string;
  onAction: (action: Action, inviteId: string) => void;
  onOpenDetail: (inviteId: string) => void;
}

export function ScheduleEventCard({ invite, tz, onAction, onOpenDetail }: Props) {
  const isAccepted = invite.status === 'accepted';
  const isReceivedPending = invite.status === 'pending_acceptance' && invite.direction === 'received';
  const isSentPending = invite.status === 'pending_acceptance' && invite.direction === 'sent';

  return (
    <article className="schedule-event-card">
      <div className="schedule-event-time">{formatInZone(invite.scheduledFor, tz)}</div>
      <div className="schedule-event-body">
        <div className="schedule-event-counterparty">
          <span className="schedule-event-avatar" aria-hidden="true">{invite.counterparty.initials}</span>
          <span className="schedule-event-name">{invite.counterparty.fullName}</span>
        </div>
        <div className="schedule-event-meta">
          <span className={`schedule-event-status schedule-event-status--${invite.status}`}>
            {isAccepted ? 'Confirmed' : 'Pending'}
          </span>
          <span className="schedule-event-topic">{invite.topic}</span>
          <span className="schedule-event-duration">{invite.durationMinutes} min</span>
        </div>
      </div>
      <div className="schedule-event-actions">
        {isReceivedPending && (
          <>
            <button type="button" className="schedule-btn schedule-btn--primary" onClick={() => onAction('accept', invite.id)}>Accept</button>
            <button type="button" className="schedule-btn" onClick={() => onAction('decline', invite.id)}>Decline</button>
          </>
        )}
        {isSentPending && (
          <button type="button" className="schedule-btn" onClick={() => onAction('cancel', invite.id)}>Cancel</button>
        )}
        {isAccepted && (
          <>
            <a
              className="schedule-btn schedule-btn--primary"
              href={`/api/schedule/ics/${invite.id}`}
              download={`mock-interview-${invite.id}.ics`}
            >
              Add to calendar
            </a>
            <button type="button" className="schedule-btn" onClick={() => onAction('cancel', invite.id)}>Cancel</button>
          </>
        )}
        <button type="button" className="schedule-btn" onClick={() => onAction('reschedule', invite.id)}>Reschedule</button>
        <button type="button" className="schedule-btn schedule-btn--ghost" onClick={() => onOpenDetail(invite.id)}>Details</button>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/schedule/ScheduleEventCard.test.tsx`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/schedule/ScheduleEventCard.tsx client/src/components/schedule/ScheduleEventCard.test.tsx
git commit -m "feat(client): add ScheduleEventCard with status-aware actions"
```

---

## Task 13: `ScheduleAgenda` component

**Files:**
- Create: `client/src/components/schedule/ScheduleAgenda.tsx`
- Create: `client/src/components/schedule/ScheduleAgenda.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// client/src/components/schedule/ScheduleAgenda.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleAgenda } from './ScheduleAgenda.js';
import type { InviteSummary } from '../../types.js';

function makeInvite(overrides: Partial<InviteSummary> = {}): InviteSummary {
  return {
    id: String(Math.random()),
    direction: 'received',
    counterparty: { id: '2', fullName: 'Bob', initials: 'B' },
    status: 'accepted',
    scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
    durationMinutes: 45,
    topic: 'T',
    rolePreference: 'either',
    sourceBlockId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('ScheduleAgenda', () => {
  it('renders upcoming-empty state when no invites and showPast is false', () => {
    render(<ScheduleAgenda invites={[]} tz="UTC" showPast={false} onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText(/no upcoming mock interviews/i)).toBeInTheDocument();
  });

  it('renders past-empty state when no invites and showPast is true', () => {
    render(<ScheduleAgenda invites={[]} tz="UTC" showPast={true} onAction={vi.fn()} onOpenDetail={vi.fn()} />);
    expect(screen.getByText(/no past interviews/i)).toBeInTheDocument();
  });

  it('renders a day-heading per group', () => {
    const today = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    render(
      <ScheduleAgenda
        invites={[makeInvite({ scheduledFor: today }), makeInvite({ scheduledFor: tomorrow })]}
        tz={Intl.DateTimeFormat().resolvedOptions().timeZone}
        showPast={false}
        onAction={vi.fn()}
        onOpenDetail={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tomorrow/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/components/schedule/ScheduleAgenda.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

```tsx
// client/src/components/schedule/ScheduleAgenda.tsx
import type { InviteSummary } from '../../types.js';
import { groupByDay } from '../../lib/scheduling-dates.js';
import { ScheduleEventCard } from './ScheduleEventCard.js';

interface Props {
  invites: InviteSummary[];
  tz: string;
  showPast: boolean;
  onAction: (action: 'accept' | 'decline' | 'cancel' | 'reschedule', inviteId: string) => void;
  onOpenDetail: (inviteId: string) => void;
}

export function ScheduleAgenda({ invites, tz, showPast, onAction, onOpenDetail }: Props) {
  if (invites.length === 0) {
    return (
      <div className="schedule-empty">
        {showPast
          ? 'No past interviews in the last 30 days.'
          : 'No upcoming mock interviews. Head to Practice to find a peer.'}
      </div>
    );
  }

  const groups = groupByDay(invites, tz);

  return (
    <div className="schedule-agenda">
      {groups.map((group) => (
        <section key={group.dayKey} className="schedule-day">
          <h2 className="schedule-day-heading">{group.label}</h2>
          <div className="schedule-day-items">
            {group.items.map((invite) => (
              <ScheduleEventCard
                key={invite.id}
                invite={invite}
                tz={tz}
                onAction={onAction}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/components/schedule/ScheduleAgenda.test.tsx`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/schedule/ScheduleAgenda.tsx client/src/components/schedule/ScheduleAgenda.test.tsx
git commit -m "feat(client): add ScheduleAgenda with day grouping"
```

---

## Task 14: `SchedulePage` + route wiring + top-nav link

**Files:**
- Create: `client/src/pages/SchedulePage.tsx`
- Create: `client/src/pages/SchedulePage.test.tsx`
- Modify: `client/src/main.tsx`
- Modify: `client/src/components/Layout.tsx`
- Modify: `client/src/components/mock-interviews/MockInterviewsSection.tsx` (add "View full schedule" link)

- [ ] **Step 1: Write failing tests**

```tsx
// client/src/pages/SchedulePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SchedulePage } from './SchedulePage.js';

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({}),
  },
}));

const { api } = await import('../api/client.js');

function renderPage(userOverrides: { timezone?: string } = {}) {
  return render(
    <MemoryRouter>
      <SchedulePage user={{ id: 1, email: 'u@x.y', timezone: userOverrides.timezone ?? 'UTC' }} />
    </MemoryRouter>,
  );
}

describe('SchedulePage', () => {
  beforeEach(() => {
    (api.get as any).mockReset();
    (api.post as any).mockReset().mockResolvedValue({});
  });

  it('loads and shows the agenda', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no upcoming mock interviews/i)).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledWith('/api/schedule');
  });

  it('toggling past switches the query', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /show past/i }));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/schedule?includePast=true');
    });
  });

  it('shows UTC nudge banner when user.timezone is UTC', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage({ timezone: 'UTC' });
    await waitFor(() => {
      expect(screen.getByText(/times are shown in utc/i)).toBeInTheDocument();
    });
  });

  it('does NOT show UTC nudge when user.timezone is set', async () => {
    (api.get as any).mockResolvedValue({ invites: [] });
    renderPage({ timezone: 'America/New_York' });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText(/times are shown in utc/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/pages/SchedulePage.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Create `SchedulePage.tsx`**

```tsx
// client/src/pages/SchedulePage.tsx
import { useState } from 'react';
import type { AuthUser } from '../types.js';
import { useSchedule } from '../hooks/useSchedule.js';
import { ScheduleAgenda } from '../components/schedule/ScheduleAgenda.js';
import { api } from '../api/client.js';
import { InviteDetailModal } from '../components/mock-interviews/InviteDetailModal.js';
import { useInviteDetail } from '../hooks/useMockInterviews.js';

interface Props {
  user: AuthUser;
}

export function SchedulePage({ user }: Props) {
  const [showPast, setShowPast] = useState(false);
  const { invites, loading, error, refresh, accept, decline, cancel, reschedule } = useSchedule({ showPast });
  const [detailId, setDetailId] = useState<string | null>(null);
  const { detail } = useInviteDetail(detailId);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const showNudge = user.timezone === 'UTC' && !nudgeDismissed && browserZone !== 'UTC';

  async function applyBrowserZone() {
    await api.put('/api/user/profile', { timezone: browserZone });
    window.location.reload();
  }

  async function handleAction(action: 'accept' | 'decline' | 'cancel' | 'reschedule', id: string) {
    if (action === 'reschedule') { setRescheduling(id); return; }
    if (action === 'accept') return accept(id);
    if (action === 'decline') return decline(id);
    if (action === 'cancel') return cancel(id);
  }

  async function handleReschedule(id: string, scheduledFor: string) {
    await reschedule(id, scheduledFor);
    setRescheduling(null);
  }

  return (
    <div className="schedule-page">
      <header className="schedule-header">
        <h1>Your schedule</h1>
        <button
          type="button"
          className="schedule-toggle"
          aria-pressed={showPast}
          onClick={() => setShowPast((p) => !p)}
        >
          {showPast ? 'Hide past' : 'Show past'}
        </button>
      </header>

      {showNudge && (
        <div className="schedule-tz-nudge" role="status">
          Times are shown in UTC. Use your detected zone (<strong>{browserZone}</strong>)?
          <button type="button" className="schedule-btn schedule-btn--primary" onClick={applyBrowserZone}>
            Use {browserZone}
          </button>
          <button type="button" className="schedule-btn" onClick={() => setNudgeDismissed(true)}>
            Not now
          </button>
        </div>
      )}

      {error && <div className="schedule-error" role="alert">{error} <button onClick={refresh}>Retry</button></div>}
      {loading ? (
        <div className="schedule-loading">Loading…</div>
      ) : (
        <ScheduleAgenda
          invites={invites}
          tz={user.timezone}
          showPast={showPast}
          onAction={handleAction}
          onOpenDetail={setDetailId}
        />
      )}

      {detailId && detail && (
        <InviteDetailModal
          detail={detail}
          callerId={String(user.id)}
          onClose={() => setDetailId(null)}
          onAction={async (action, args) => {
            if (action === 'accept') await accept(detail.id);
            else if (action === 'decline') await decline(detail.id);
            else if (action === 'cancel') await cancel(detail.id);
            else if (action === 'reschedule' && args?.scheduledFor) await reschedule(detail.id, args.scheduledFor);
            setDetailId(null);
          }}
        />
      )}

      {rescheduling && (
        <RescheduleDialog
          inviteId={rescheduling}
          tz={user.timezone}
          onClose={() => setRescheduling(null)}
          onSubmit={handleReschedule}
        />
      )}
    </div>
  );
}

function RescheduleDialog({
  inviteId, tz, onClose, onSubmit,
}: { inviteId: string; tz: string; onClose: () => void; onSubmit: (id: string, iso: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-label="Reschedule">
      <div className="modal">
        <h2>Reschedule</h2>
        <p>Times below are local to your browser. Stored time will match your set zone ({tz}).</p>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            disabled={!value}
            onClick={() => onSubmit(inviteId, new Date(value).toISOString())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `/schedule` route in `main.tsx`**

In `client/src/main.tsx`, add the import:

```ts
import { SchedulePage } from './pages/SchedulePage.js';
```

Inside the protected children array, add (before `settings`):

```tsx
{ path: 'schedule', element: <SchedulePage /> },
```

If `SchedulePage` requires `user` as a prop, check how other pages access the auth user (probably via `useOutletContext` or a context hook). Wire it the same way; do not change the prop shape in the test above without also adjusting the component. If the established pattern uses a hook (e.g., `useAuth`), replace the `{ user }` prop with a hook call and update the test.

- [ ] **Step 5: Add Schedule link to topbar**

In `client/src/components/Layout.tsx`, inside `topbar-nav`, after the Practice link add:

```tsx
<NavLink
  to="/schedule"
  className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`}
>
  Schedule
</NavLink>
```

- [ ] **Step 6: Add "View full schedule" link on MockInterviewsSection**

In `MockInterviewsSection.tsx`, inside `mock-card-footer`:

```tsx
<Link to="/schedule" className="mock-ghost">View full schedule →</Link>
```

(import `Link` from `react-router-dom`).

- [ ] **Step 7: Run tests**

Run: `cd client && npx vitest run src/pages/SchedulePage.test.tsx`

Expected: PASS (4 tests).

- [ ] **Step 8: Run full client suite**

Run: `cd client && npm test`

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/SchedulePage.tsx client/src/pages/SchedulePage.test.tsx client/src/main.tsx client/src/components/Layout.tsx client/src/components/mock-interviews/MockInterviewsSection.tsx
git commit -m "feat(client): add /schedule route with agenda + top nav link"
```

---

## Task 15: `TimezoneSelect` + settings integration

**Files:**
- Create: `client/src/components/schedule/TimezoneSelect.tsx`
- Modify: `client/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create `TimezoneSelect`**

```tsx
// client/src/components/schedule/TimezoneSelect.tsx
const COMMON_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function allZones(): string[] {
  // @ts-expect-error — supportedValuesOf is available in modern runtimes
  if (typeof Intl.supportedValuesOf === 'function') {
    // @ts-expect-error
    return Intl.supportedValuesOf('timeZone');
  }
  return COMMON_ZONES;
}

interface Props {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
}

export function TimezoneSelect({ value, onChange, id }: Props) {
  const zones = allZones();
  const merged = Array.from(new Set([...COMMON_ZONES, ...zones]));
  return (
    <select
      id={id}
      className="timezone-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {merged.map((tz) => (
        <option key={tz} value={tz}>{tz}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Wire into SettingsPage**

Read the existing profile section in `client/src/pages/SettingsPage.tsx` and add a timezone row alongside the existing `fullName`/`bio` fields. Follow that file's existing save pattern (it calls `api.put('/api/user/profile', ...)`). Extend the profile state and submit payload with `timezone`. The GET payload already includes `timezone` after Task 5.

Example insertion inside the profile form:

```tsx
<label htmlFor="timezone-select">Timezone</label>
<TimezoneSelect
  id="timezone-select"
  value={profile.timezone}
  onChange={(tz) => saveProfile({ timezone: tz })}
/>
```

If `saveProfile` does not accept partial payloads, extend it to accept `Partial<{ fullName: string; bio: string; timezone: string }>`.

- [ ] **Step 3: Run client suite**

Run: `cd client && npm test`

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/schedule/TimezoneSelect.tsx client/src/pages/SettingsPage.tsx
git commit -m "feat(client): add timezone selector to Settings"
```

---

## Task 16: Minimal CSS for schedule surfaces

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Add styles**

Append to `client/src/index.css`:

```css
/* Schedule page */
.schedule-page { padding: 32px 24px; max-width: 880px; margin: 0 auto; }
.schedule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.schedule-toggle { background: transparent; border: 1px solid var(--border, #333); color: inherit; padding: 6px 12px; border-radius: 8px; cursor: pointer; }
.schedule-tz-nudge { padding: 12px; background: var(--card-bg, #1e1e24); border-radius: 10px; margin-bottom: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.schedule-error { color: #f66; padding: 12px; }
.schedule-loading { padding: 24px; text-align: center; opacity: 0.6; }
.schedule-empty { padding: 48px 24px; text-align: center; opacity: 0.7; }

.schedule-agenda { display: flex; flex-direction: column; gap: 24px; }
.schedule-day-heading { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; margin: 0 0 8px; }
.schedule-day-items { display: flex; flex-direction: column; gap: 10px; }

.schedule-event-card {
  display: grid;
  grid-template-columns: 200px 1fr auto;
  gap: 16px;
  padding: 14px 16px;
  background: var(--card-bg, #1e1e24);
  border-radius: 10px;
  align-items: center;
}
.schedule-event-time { font-weight: 500; }
.schedule-event-counterparty { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
.schedule-event-avatar { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: #444; font-size: 12px; font-weight: 600; }
.schedule-event-meta { display: flex; gap: 10px; font-size: 13px; opacity: 0.8; flex-wrap: wrap; }
.schedule-event-status { padding: 2px 8px; border-radius: 999px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.schedule-event-status--accepted { background: rgba(60, 160, 100, 0.2); color: #7ed6a1; }
.schedule-event-status--pending_acceptance { background: rgba(200, 150, 60, 0.2); color: #ffc87a; }
.schedule-event-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.schedule-btn {
  background: transparent; border: 1px solid var(--border, #333); color: inherit;
  padding: 6px 10px; border-radius: 8px; font-size: 13px; cursor: pointer; text-decoration: none;
}
.schedule-btn--primary { background: var(--accent, #5c6cf7); border-color: transparent; color: white; }
.schedule-btn--ghost { border-color: transparent; opacity: 0.75; }

@media (max-width: 720px) {
  .schedule-event-card { grid-template-columns: 1fr; }
  .schedule-event-actions { margin-top: 6px; }
}
```

- [ ] **Step 2: Smoke check**

Run: `cd client && npm run dev` in one terminal, `cd server && npm run dev` in another. Open `http://localhost:5173/schedule`. Confirm agenda renders and actions work for a test user with at least one accepted invite.

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css
git commit -m "style(client): add schedule page styles"
```

---

## Task 17: End-to-end verification + production build

**Files:** none directly; this is a validation task.

- [ ] **Step 1: Run full test suite from repo root**

```bash
npm test
```

Expected: all server + client tests pass.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: both `server/dist` and `client/dist` build clean (no TS errors).

- [ ] **Step 3: Production smoke**

```bash
npm start &
# wait for "Server running on..."
curl -s http://localhost:3000/api/schedule
# Expected: 401 Unauthorized (auth middleware blocks)
kill %1
```

- [ ] **Step 4: Manual UI smoke**

Start dev (`npm run dev:server` + `npm run dev:client`), log in as a test user, then:

1. Visit `/settings` → set timezone to something non-UTC → save.
2. Create a mock interview invite as user A.
3. Accept as user B.
4. Both users visit `/schedule` → confirm event appears under correct day in correct zone with zone abbrev.
5. Click "Add to calendar" on accepted event → `.ics` file downloads; open it in your OS calendar → verify time matches.
6. Click Reschedule → pick new time → verify list refreshes.
7. Click "Show past" → past events appear.
8. Log in as a user with `timezone === 'UTC'` (new user) → verify UTC nudge banner appears → click → verify banner disappears and times update.
9. Confirm `MockInterviewsSection` on `/practice` renders times in the user's zone (not UTC) after the refactor.

- [ ] **Step 5: Update project TODO**

Edit `docs/project-todo.md`: mark the calendar item with a phase-1 completion note:

```markdown
- [ ] Add calendar integration + reminders for scheduling:
  - [x] Phase 1 (2026-04-21): /schedule page, ICS export, per-user timezone
  - [ ] Phase 2: reminder automation (blocked on notifications #5)
  - [ ] Phase 3: Google Calendar sync (blocked on OAuth hardening #4)
```

- [ ] **Step 6: Commit**

```bash
git add docs/project-todo.md
git commit -m "chore: mark calendar phase 1 complete in project TODO"
```

---

## Self-review checklist (for the writer)

- **Spec coverage:** Schedule view (Tasks 11–14), ICS export (Tasks 2, 4, 12), timezone data (Tasks 1, 5, 6, 8, 15), shared date util (Task 9), existing components migrated (Task 10), route mount (Task 7), nav + link from practice (Task 14), tests across all layers (inline in each task), production build verification (Task 17).
- **Placeholder scan:** no TBD/TODO. Each step has actual code or a concrete grep/inspect instruction. No "similar to Task N."
- **Type consistency:** `AuthUser` gains `timezone` in Task 8; all later code references `user.timezone`. `ScheduleResponse` defined in Task 8, consumed in Task 11. `formatInZone`/`groupByDay` signatures defined in Task 9 match Tasks 12–13 usage. `Action` type in Task 12 matches `handleAction` in Task 14.
- **Ambiguity resolved:** Task 10 notes the `useAuth`-vs-prop question and gives concrete guidance. Task 14 Step 4 acknowledges the route prop vs hook decision and directs the implementer to match existing patterns.
