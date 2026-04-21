# Find-a-Peer Redesign — Design Spec

**Date:** 2026-04-21
**Status:** Draft, pending implementation plan
**Related TODO:** `docs/project-todo.md` item #2 ("Redesign 'Find a Peer' scheduling flow")
**Scope option:** D — B + status history + conflict detection, rendered inline on PracticePage

## Problem

The current mock-interview scheduling feature is a write-only void:

- `POST /api/practice/mock-interviews/schedule` inserts a row with `status='pending_acceptance'` that no GET route and no client surface ever reads.
- `POST /api/practice/mock-interviews/proposals` inserts a row that is likewise never read or consumed anywhere.
- `MockInterviewModal` shows a success toast ("Invite sent to X") that is functionally untrue — the invite exists in the database but is unreachable by the peer.
- The `mock_interviews.status` column defaults to `'pending_acceptance'`, implying an accept / decline / reschedule lifecycle that was never built.
- There is no role preference (interviewer vs. interviewee) anywhere in the data model.
- `mock_interview_availability_proposals` stores one row per single timestamp — the schema cannot express "I am available during these five blocks."

As a result, even when the write succeeds, nothing happens in the product: peers are never notified, initiators never see their sent invites, no state machine ever advances, and posted availability is invisible to everyone.

## Goals

1. Finish the mock-interview state machine: `pending_acceptance → accepted | declined | cancelled` with `reschedule` as a transition that returns to `pending_acceptance`.
2. Make both invite flows visible and actionable to both parties by adding inbox and feed surfaces on `PracticePage`.
3. Replace single-timestamp availability with a parent proposal plus N time blocks, so a user can post multiple times at once and peers can claim one.
4. Add a role preference dimension (`interviewee | interviewer | either`) to invites, proposals, and user defaults, and enforce role compatibility server-side on schedule and claim.
5. Add an append-only event log so every lifecycle transition is auditable and so the forthcoming notifications system can subscribe without new plumbing.
6. Detect time conflicts on the server (not the client) at accept, claim, schedule, and reschedule.

## Non-goals (deferred to other TODOs)

- Bell / badge / email notifications — TODO #6.
- ICS export, Google Calendar sync, reminder automation — TODO #7.
- Dedicated `/schedule` page — TODO #7 (the current design keeps all surfaces on `PracticePage` so that relocation is a pure move later).
- Timezone-aware rendering — TODO #7. Inputs and displays use the browser's local timezone; server stores ISO UTC.
- Auto-pairing / matchmaking — users always claim explicitly.
- Recurring availability — a proposal is a one-time set of blocks.
- Peer search, filter, or skill-based discovery — `GET /mock-interviews/peers` (formerly `/practice/peers`) remains a simple opt-in list with no filtering.
- "Completed" status and post-interview feedback capture.

## Data model

### 1. `mock_interviews` — add columns

```sql
ALTER TABLE mock_interviews ADD COLUMN role_preference TEXT NOT NULL DEFAULT 'either';
ALTER TABLE mock_interviews ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 45;
ALTER TABLE mock_interviews ADD COLUMN source_block_id INTEGER REFERENCES availability_blocks(id) ON DELETE SET NULL;
ALTER TABLE mock_interviews ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
```

- `role_preference` — the initiator's (or claimant's) requested role. Values: `'interviewee' | 'interviewer' | 'either'`.
- `source_block_id` — backlink to the availability block that created this invite via a claim. `NULL` for direct invites.
- `updated_at` — bumped on every lifecycle transition via application code.

Status column values (TEXT, already permissive):
`'pending_acceptance' | 'accepted' | 'declined' | 'cancelled'`. No `'completed'` in this spec.

State machine:

```
pending_acceptance ──accept──▶ accepted
                   ──decline─▶ declined          (terminal)
                   ──cancel──▶ cancelled         (terminal, initiator or peer)
                   ──reschedule─▶ pending_acceptance (with new scheduled_for)

accepted ──cancel──▶ cancelled                   (either party)
         ──reschedule─▶ pending_acceptance       (either party, with new scheduled_for)
```

### 2. `availability_proposals` and `availability_blocks` (new)

```sql
CREATE TABLE availability_proposals (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  topic            TEXT,
  notes            TEXT,
  role_preference  TEXT NOT NULL DEFAULT 'either',
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE availability_blocks (
  id                INTEGER PRIMARY KEY,
  proposal_id       INTEGER NOT NULL REFERENCES availability_proposals(id) ON DELETE CASCADE,
  starts_at         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  claimed_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at        TEXT,
  mock_interview_id INTEGER REFERENCES mock_interviews(id) ON DELETE SET NULL
);

CREATE INDEX idx_availability_blocks_open
  ON availability_blocks(status, starts_at)
  WHERE status = 'open';
```

- `availability_blocks.status` values: `'open' | 'claimed' | 'cancelled'`.
- Partial index on open blocks makes the browse feed fast.

### 3. `mock_interview_events` (new)

```sql
CREATE TABLE mock_interview_events (
  id          INTEGER PRIMARY KEY,
  invite_id   INTEGER NOT NULL REFERENCES mock_interviews(id) ON DELETE CASCADE,
  actor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_mock_interview_events_invite
  ON mock_interview_events(invite_id, created_at);
```

- `event_type` values: `'created' | 'accepted' | 'declined' | 'cancelled' | 'rescheduled'`.
- `payload` is JSON-encoded text; for `rescheduled` it contains `{ "from": "<iso>", "to": "<iso>" }`.
- Every lifecycle transition inserts an event row **in the same transaction** as the state change.

### 4. `user_preferences` — add default role

```sql
ALTER TABLE user_preferences ADD COLUMN default_role_preference TEXT NOT NULL DEFAULT 'either';
```

Pre-fills the role selector in the create modal. Does not gate matching.

### 5. Drop old table

```sql
DROP TABLE mock_interview_availability_proposals;
```

The feature never shipped end-to-end; there is no production data worth preserving, and the shape is incompatible with the new parent/child model.

## API

All routes mount under the existing `/api/practice` router, behind the existing auth middleware.

### Invites

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/mock-interviews/peers` | Moved from existing `/practice/peers`. Same behavior: returns users with `allow_mock_interviews=1`, plus their `default_role_preference` so the client can show compatibility hints. |
| `GET`  | `/mock-interviews` | List invites involving the user. Query: `direction=sent|received|all`, `status=<csv>`. Returns `InviteSummary[]`; no event timeline. |
| `GET`  | `/mock-interviews/:id` | `InviteDetail` with event timeline, counterparty profile, source block. 403 if caller is not party. |
| `POST` | `/mock-interviews/schedule` | Existing, extended. Body gains `rolePreference`, `durationMinutes`. 409 on role incompatibility or time overlap. |
| `POST` | `/mock-interviews/:id/accept` | Peer only. `pending_acceptance → accepted`. 409 on overlap for accepter; 422 if not `pending_acceptance`; 403 if caller is initiator. |
| `POST` | `/mock-interviews/:id/decline` | Peer only. `pending_acceptance → declined`. 422 otherwise; 403 if caller is initiator. |
| `POST` | `/mock-interviews/:id/cancel` | Either party, any pre-terminal state. → `cancelled`. |
| `POST` | `/mock-interviews/:id/reschedule` | Either party. Body: `{ scheduledFor }`. `accepted | pending_acceptance → pending_acceptance` with new time. 409 on overlap. Records `{from, to}` in event payload. |

### Availability

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/availability/mine` | User's own proposals + blocks, including claimed-by info. |
| `GET`    | `/availability/feed` | Open blocks from *other* users. Query: `role`, `topic`, `from`, `to`. Excludes caller's own blocks and blocks overlapping caller's accepted invites. |
| `POST`   | `/availability` | Create a proposal + blocks. Body: `{ durationMinutes, topic, notes, rolePreference, blocks: [{ startsAt }, ...] }`. Blocks: min 1, max 8. Rejects if any two blocks overlap each other within `durationMinutes`. |
| `POST`   | `/availability/blocks/:id/claim` | Atomically claim block and insert invite with `source_block_id=:id`, `status='pending_acceptance'`. Body: `{ rolePreference, notes? }`. 409 on claim race, role incompatibility, or overlap with caller's accepted invites. |
| `DELETE` | `/availability/blocks/:id` | Cancel one block. Only if `status='open'` (422 otherwise). Sets `status='cancelled'`. |
| `DELETE` | `/availability/:proposalId` | Cancel all still-open blocks under a proposal. Claimed blocks untouched. |

### User preferences

Existing `GET`/`PUT /api/user/preferences` are extended to include `defaultRolePreference`.

### Error contract

| Code | Meaning |
|---|---|
| 400 | Malformed body, unparseable date, invalid role value, empty or oversize blocks array, blocks overlapping each other |
| 401 | Not authenticated |
| 403 | Caller is not a party to the invite, or is acting in the wrong role (e.g., initiator calling accept) |
| 404 | Invite, block, or proposal not found |
| 409 | Time overlap with an existing accepted invite, role incompatibility, or claim race lost |
| 422 | Lifecycle transition invalid for current status |

Error bodies: `{ "error": "<code>", "detail": "<human-readable>", "context"?: {...} }`. For overlap conflicts, `context` includes the ID of the conflicting invite so the client can link to it.

### Response shapes

```ts
type RolePreference = 'interviewee' | 'interviewer' | 'either';
type InviteStatus = 'pending_acceptance' | 'accepted' | 'declined' | 'cancelled';

type InviteSummary = {
  id: string;
  direction: 'sent' | 'received';
  counterparty: { id: string; fullName: string; initials: string };
  status: InviteStatus;
  scheduledFor: string;         // ISO
  durationMinutes: number;
  topic: string;
  rolePreference: RolePreference;
  sourceBlockId: string | null;
  createdAt: string;
  updatedAt: string;
};

type InviteEvent = {
  id: string;
  actorId: string;
  eventType: 'created' | 'accepted' | 'declined' | 'cancelled' | 'rescheduled';
  payload: Record<string, unknown> | null;
  createdAt: string;
};

type InviteDetail = InviteSummary & { events: InviteEvent[] };

type AvailabilityBlockSummary = {
  blockId: string;
  proposalId: string;
  startsAt: string;
  status: 'open' | 'claimed' | 'cancelled';
  claimedBy: { id: string; fullName: string } | null;
  mockInterviewId: string | null;
};

type MyAvailability = {
  proposals: Array<{
    id: string;
    durationMinutes: number;
    topic: string;
    notes: string;
    rolePreference: RolePreference;
    createdAt: string;
    blocks: AvailabilityBlockSummary[];
  }>;
};

type FeedBlock = {
  blockId: string;
  proposalId: string;
  postedBy: { id: string; fullName: string; initials: string };
  startsAt: string;
  durationMinutes: number;
  topic: string;
  notes: string;
  rolePreference: RolePreference;
};
```

## Role and matching semantics

### Compatibility rule

When A pairs with B (direct invite or claim), their roles must be complementary, not identical:

| A | B | Compatible? |
|---|---|---|
| `interviewee` | `interviewer` | yes |
| `interviewer` | `interviewee` | yes |
| `either` | any | yes |
| any | `either` | yes |
| `interviewee` | `interviewee` | no |
| `interviewer` | `interviewer` | no |

Enforced server-side:
- `POST /mock-interviews/schedule` compares initiator's `rolePreference` against target peer's `default_role_preference`.
- `POST /availability/blocks/:id/claim` compares claimant's chosen role against the block's `rolePreference`.

Error: `409` with `{ "error": "role_incompatible", ... }`.

### Feed filter semantics

`/availability/feed?role=<caller's wanted counterparty role>`:

| Filter | Blocks returned |
|---|---|
| `any` (default) | all open blocks |
| `interviewee` | `rolePreference ∈ {'interviewee', 'either'}` |
| `interviewer` | `rolePreference ∈ {'interviewer', 'either'}` |

This matches the user's mental query ("I want to give an interview → show me people who want to be interviewed").

### Default role preference

- `user_preferences.default_role_preference` pre-fills the role selector in the create modal.
- No automatic matching or filtering based on it.
- Settable via existing `PUT /api/user/preferences` and surfaced on `SettingsPage`.

## Conflict detection

Overlap check for user X at window `[start, start + duration)`:

```sql
SELECT id
FROM mock_interviews
WHERE status = 'accepted'
  AND (initiator_id = :user_id OR peer_id = :user_id)
  AND datetime(scheduled_for) < datetime(:window_end)
  AND datetime(scheduled_for, '+' || duration_minutes || ' minutes') > datetime(:window_start)
LIMIT 1;
```

Runs at: `schedule` (for initiator), `accept` (for accepter), `claim` (for claimant), `reschedule` (for both parties of the invite being moved). Returns 409 with the conflicting invite ID in `context.conflictingInviteId`.

Claim race is resolved at the SQL layer:

```sql
UPDATE availability_blocks
SET claimed_by = :caller_id,
    claimed_at = datetime('now'),
    status = 'claimed'
WHERE id = :block_id AND claimed_by IS NULL;
```

A row count of 0 means someone else won the race → 409 with `{ "error": "block_already_claimed" }`. The invite insert happens in the same transaction, only if the update succeeded.

## UX

All surfaces live on `PracticePage`. No new routes.

### 1. `MockInterviewsSection` on `PracticePage`

A new section between Daily Challenge and Analytics. Four compact sub-cards:

- **Received invites** — up to 3 `pending_acceptance` received invites. Inline Accept / Decline. Small `●` dot for invites new since page mount.
- **Sent invites** — up to 3 non-terminal sent invites. Status pill + Cancel button.
- **My availability** — summary of user's open blocks. CTAs: Post availability (opens create modal), View all (opens management modal).
- **Open availability feed** — first 5 feed blocks with role filter dropdown. Claim button per row. Browse more opens the feed modal.

Each card has a View all or Browse more link that opens a full modal when the compact view is truncated.

### 2. Modals

Old `MockInterviewModal` (265 lines, two-tab flow) is replaced by focused modals:

- `components/mock-interviews/CreateModal.tsx` — the "invite a peer" + "post availability" flow (two tabs, multi-block block picker on the availability tab).
- `components/mock-interviews/InviteDetailModal.tsx` — counterparty, time, lifecycle actions for caller, event timeline.
- `components/mock-interviews/MyAvailabilityModal.tsx` — list of open + claimed blocks with per-block cancel.
- `components/mock-interviews/AvailabilityFeedModal.tsx` — filters (role, topic, date range), grouped by poster, Claim button with inline confirm (role + optional notes).
- `components/mock-interviews/MockInterviewsSection.tsx` — the four-card section on `PracticePage`.

Each file stays under ~200 lines.

### 3. Create modal flows

**Invite a peer tab**
- Peer radio list (existing)
- Topic input (existing)
- Role segmented control, pre-filled from `defaultRolePreference`
- Duration select (moved here, applies to both tabs)
- Proposed time: single `datetime-local`
- Submit → `POST /mock-interviews/schedule`

**Post availability tab**
- Role segmented control
- Topic, duration, notes
- **Time blocks picker**: "+ Add block" button, up to 8 rows with `datetime-local` + remove (×). Starts with one block defaulting to tomorrow at next rounded hour. Client-side validation rejects blocks overlapping within `durationMinutes`.
- Submit label: `Post N block(s)` → `POST /availability`

### 4. Empty / error states

- No received invites: *"Nothing waiting on you. Claim availability below or send an invite to get started."*
- No sent invites: *"You haven't sent any invites yet."*
- No availability posted: *"Post a few time blocks and peers can claim them directly."*
- Empty feed: *"No open availability matches your filters. Try widening the role filter."*
- Claim race (409 `block_already_claimed`): *"Someone else grabbed this block. Refreshing the feed…"* (auto-refetch)
- Overlap conflict (409): *"This conflicts with [Tue 14:00 · Chen J.]. Cancel the other invite first or pick a different time."* (links to conflicting invite via `context.conflictingInviteId`)
- Role incompatibility (409): *"Your role preference isn't compatible with this peer's. Pick a different peer or switch your role."*

## Migration

Applied via the existing `applySchema(db)` path in `server/src/db/schema.ts` on every server start. Idempotent via `IF NOT EXISTS` / `ALTER TABLE` tolerances.

Order (tables created before altering, so forward FK references resolve cleanly):
1. `CREATE TABLE availability_proposals`.
2. `CREATE TABLE availability_blocks` + partial index.
3. `CREATE TABLE mock_interview_events` + index.
4. `ALTER TABLE mock_interviews` — add new columns (including `source_block_id REFERENCES availability_blocks(id)`).
5. `ALTER TABLE user_preferences` — add `default_role_preference`.
6. `DROP TABLE mock_interview_availability_proposals`.

No data backfill. Existing `mock_interviews` rows (likely zero or near-zero) pick up defaults.

## Testing

### Server (Vitest + better-sqlite3 in-memory)

New files:
- `server/src/routes/mock-interviews.test.ts`
- `server/src/routes/availability.test.ts`

Coverage targets:

Invite lifecycle (8 tests):
- Schedule creates `mock_interviews` row + `created` event.
- Schedule returns 409 on role incompatibility.
- Schedule returns 409 on overlap with caller's accepted invite.
- Accept transitions status and inserts `accepted` event; 403 if caller is initiator.
- Accept returns 409 on overlap for the accepter.
- Decline transitions; subsequent accept on same invite returns 422.
- Cancel works from either party in any pre-terminal state; terminal state returns 422.
- Reschedule returns invite to `pending_acceptance` and records `{from, to}` in event payload.

List / detail (3 tests):
- `GET /mock-interviews` filters by `direction` and `status`.
- `GET /:id` returns events ordered by `created_at`.
- `GET /:id` returns 403 when caller is neither initiator nor peer.

Availability (7 tests):
- Create proposal with N blocks inserts parent + children.
- Create returns 400 when two blocks overlap each other within `durationMinutes`.
- Create returns 400 when block count is 0 or >8.
- Claim atomically inserts invite and marks block claimed.
- Claim race (two concurrent claims) — exactly one succeeds, other returns 409 `block_already_claimed`.
- Claim returns 409 on role incompatibility; 409 on overlap with claimant's accepted invites.
- Cancel block / cancel proposal: open blocks become `cancelled`; already-claimed blocks are untouched.

Feed (3 tests):
- `?role=interviewee` returns blocks with `rolePreference ∈ {'interviewee', 'either'}`.
- Excludes blocks overlapping caller's accepted invites.
- Excludes blocks posted by the caller.

### Client (Vitest + React Testing Library)

- `MockInterviewsSection` renders four cards with correct data.
- Each card renders its empty-state copy when data is empty.
- `CreateModal` submit with multi-block availability posts one proposal + N blocks.
- `CreateModal` role selector pre-fills from `defaultRolePreference`.
- `InviteDetailModal` timeline renders in chronological order with actor labels.

## Risks

1. **PracticePage density.** Adding a four-card section to an already busy page is the biggest aesthetic risk. If feedback calls this out, the section can collapse to a single summary row (`3 received · 2 sent · 4 open blocks · 12 in feed`) as a follow-up. Not built now.
2. **`'either'` gaming.** A user could set `default_role_preference='either'` to see everything in the feed but always act as `'interviewee'`. Not a real abuse vector; worst case is the parties simply swap.
3. **Claim race UX.** The auto-refetch on 409 is the recovery. Rare double-refresh is acceptable.
4. **Schema breakage for deployed instances.** Since the old `mock_interview_availability_proposals` table is dropped, any deployed instance that did accumulate rows would lose them. This is acceptable given the feature never shipped a consumer UI; documented here so no reviewer is surprised.

## File map

Added:
- `server/src/routes/mock-interviews.ts`
- `server/src/routes/mock-interviews.test.ts`
- `server/src/routes/availability.ts`
- `server/src/routes/availability.test.ts`
- `client/src/components/mock-interviews/MockInterviewsSection.tsx`
- `client/src/components/mock-interviews/CreateModal.tsx`
- `client/src/components/mock-interviews/InviteDetailModal.tsx`
- `client/src/components/mock-interviews/MyAvailabilityModal.tsx`
- `client/src/components/mock-interviews/AvailabilityFeedModal.tsx`
- `client/src/hooks/useMockInterviews.ts` (invites lifecycle)
- `client/src/hooks/useAvailability.ts` (my availability + feed)

Modified:
- `server/src/db/schema.ts` — migration
- `server/src/index.ts` — mount new routers
- `server/src/routes/practice.ts` — remove old `/peers`, `/mock-interviews/schedule`, `/mock-interviews/proposals` routes (moved to the new router files); `/peers` moves to the mock-interviews router as `/mock-interviews/peers`
- `server/src/routes/practice.test.ts` — remove old peer/invite test block
- `server/src/routes/user.ts` + `server/src/routes/user.test.ts` — handle `defaultRolePreference`
- `client/src/pages/PracticePage.tsx` — insert `MockInterviewsSection`, remove old modal wiring
- `client/src/hooks/usePractice.ts` — remove `useMockPeers` (split into new hooks)
- `client/src/types.ts` — add new response types

Removed:
- `client/src/components/MockInterviewModal.tsx` — replaced by the four new modal files
