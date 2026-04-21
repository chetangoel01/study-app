# Calendar Phase 1 — Schedule View, ICS Export, Timezone

**Date:** 2026-04-21
**Status:** Spec (pre-plan)
**TODO item:** Calendar integration + reminders for scheduling (`docs/project-todo.md`)
**Scope:** Phase 1 of a multi-phase rollout. Reminders and Google Calendar sync are explicitly deferred to Phase 2 (depends on notifications system, TODO #5) and Phase 3 (depends on OAuth productionization, TODO #4).

## Goal

Give users a first-class surface to see their mock interviews chronologically, export individual events to their own calendar via ICS, and render all scheduling times in a persistent user-chosen timezone.

## Non-goals (deferred)

- Reminder automation (24h / 1h before events) — blocked on notifications system.
- Google Calendar two-way sync — blocked on OAuth productionization.
- Multi-block availability — already shipped by the find-a-peer redesign.
- Accept/decline/reschedule/cancel lifecycle — already shipped.
- Showing counterparty's timezone alongside the user's — nice-to-have, can layer on top.
- ICS subscription feed / webcal URL — duplicates Google Calendar sync planned for Phase 3.
- ICS for pending invites — users should commit before adding to their calendar; avoids cluttering real calendars with invites that may be declined.

## What's already in place

- `availability_proposals` + `availability_blocks` tables with multi-block support.
- `mock_interviews` + `mock_interview_events` tables with full lifecycle + audit log.
- `fetchInviteSummaryRows(db, userId, opts)` in `server/src/lib/scheduling.ts` returns summaries with counterparty info — reusable for the schedule endpoint.
- Accept/decline/cancel/reschedule routes with bi-party overlap detection (`findOverlappingInvite`).
- `MockInterviewsSection` dashboard-style card on `/practice` with truncated lanes.

## Architecture overview

Phase 1 is primarily a read + render feature on the client. Server work is narrow: one migration, two new routes, two extensions to existing routes.

### Server additions

1. **Schema migration:** `ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'`. New column only, no backfill.
2. **`GET /api/schedule`** — returns accepted + pending mock interviews for the caller, in a time window.
3. **`GET /api/schedule/ics/:inviteId`** — returns a single-event ICS file for an accepted invite.
4. **`PUT /api/user/profile`** (existing) — extended to accept `timezone` field; validate via `Intl.DateTimeFormat` round-trip. Response adds `timezone`.
5. **`GET /api/user/profile`** (existing) — response adds `timezone`.
6. **`GET /api/auth/me`** (existing) — response adds `timezone` so the session user object carries it to the frontend without an extra fetch.

### Client additions

1. New route `/schedule` → `SchedulePage.tsx`.
2. New hook `useSchedule()` paralleling patterns in `useMockInterviews.ts`.
3. New components in `client/src/components/schedule/`:
   - `ScheduleAgenda.tsx`
   - `ScheduleEventCard.tsx`
   - `ShowPastToggle.tsx`
4. New util `client/src/lib/scheduling-dates.ts`: `formatInZone`, `getZoneAbbrev`, `groupByDay`, `isPast`.
5. `<TimezoneSelect>` added to Settings page, wired to the existing settings mutation.
6. Existing scheduling components (`MockInterviewsSection`, `InviteDetailModal`, `MyAvailabilityModal`, `AvailabilityFeedModal`, `CreateModal`) migrate from local `formatWhen` to the shared util.
7. Top nav link to `/schedule`; "View full schedule →" link on `MockInterviewsSection`.

## Data flow on `/schedule`

```
SchedulePage
  └── useSchedule({ showPast })   ← GET /api/schedule?includePast=<bool>
       └── { invites, loading, refresh, accept, decline, cancel, reschedule }
              ↓
  ScheduleAgenda(invites, user.timezone)
       ├── groupByDay(invites, user.timezone)      [grouping in user's zone, not UTC]
       └── <section per day>
            └── ScheduleEventCard(invite, user.timezone)
                 ├── formatInZone(invite.scheduledFor, user.timezone)
                 ├── Action row varies by (status × direction)
                 └── "Add to calendar" → GET /api/schedule/ics/:id → browser download
```

## Data model

### Schema change

```sql
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
```

Existing rows get `'UTC'`. The client nudges the user to update on first `/schedule` visit when `user.timezone === 'UTC'` (offers the browser-detected zone as a one-click default).

**Validation on write:** `new Intl.DateTimeFormat(tz)` must not throw. No allowlist to maintain; Node's ICU data is authoritative.

No other schema changes. `mock_interviews` already has every column the schedule view needs.

## API contracts

### `GET /api/schedule`

**Auth:** `requireAuth`.

**Query params:**
- `from` (ISO, optional, default `now - 30d`)
- `to` (ISO, optional, default `now + 90d`)
- `includePast` (boolean string, default `false`) — if false, rewrites `from` to `now`.

**Filter:** `status IN ('pending_acceptance', 'accepted')` for both directions (initiator or peer is the caller).

**Response shape** — reuses `summaryRowToResponse` so the frontend can share types with `GET /api/mock-interviews`:

```json
{
  "invites": [
    {
      "id": "42",
      "direction": "received",
      "counterparty": { "id": "17", "fullName": "Alice", "initials": "A" },
      "status": "pending_acceptance",
      "scheduledFor": "2026-04-23T19:00:00.000Z",
      "durationMinutes": 45,
      "topic": "System design",
      "rolePreference": "interviewee",
      "sourceBlockId": null,
      "createdAt": "2026-04-20T10:00:00.000Z",
      "updatedAt": "2026-04-20T10:00:00.000Z"
    }
  ]
}
```

**Implementation:** extend `fetchInviteSummaryRows` to accept `{ windowFrom?, windowTo?, statuses? }`. Don't add a new SQL path.

### `GET /api/schedule/ics/:inviteId`

**Auth:** `requireAuth`.

**Errors:**
- `404 not_found` — invite does not exist.
- `403 forbidden` — caller is not initiator or peer.
- `422 invalid_state` — `status !== 'accepted'`.

**Success response:**
- Headers: `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="mock-interview-<id>.ics"`.
- Body (generated by new `server/src/lib/ics.ts`):

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//study-app//mock-interviews//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:mock-invite-42@studyapp
DTSTAMP:20260421T180000Z
DTSTART:20260423T190000Z
DTEND:20260423T194500Z
SUMMARY:Mock interview with Alice
DESCRIPTION:Topic: System design\n\nOpen in app: https://studyapp/app/mock-interviews/42
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

**Requirements:**
- Line endings = `\r\n` (RFC 5545).
- Text fields escaped per RFC 5545: `\` → `\\`, `;` → `\;`, `,` → `\,`, newlines → `\n`.
- `UID` stable per invite (`mock-invite-<id>@<base-domain>`) so calendar apps replace rather than duplicate on re-download after reschedule.
- Base URL in `DESCRIPTION` pulled from `config.ts` `BASE_URL`.
- `DTSTAMP` is the current time at generation.
- Times formatted as UTC basic form (`YYYYMMDDTHHMMSSZ`) — simplest and most compatible.

### `PUT /api/user/profile` (extension)

Accept new optional `timezone` field alongside existing `fullName` / `bio`. Validate via `new Intl.DateTimeFormat(tz)` try/catch; on failure return `400 invalid_timezone`. On success, response shape extended to include `timezone`.

### `GET /api/user/profile` (extension)

Response shape adds `timezone: string`.

### `GET /api/auth/me` (extension)

Response shape adds `timezone: string` so the session user carried by `useAuth()` has the user's zone without an extra round trip.

## Client components

### `client/src/lib/scheduling-dates.ts`

Pure functions, no React dependencies:

```ts
formatInZone(iso: string, tz: string, opts?: { includeWeekday?: boolean }): string
// e.g., "Thu, Apr 23 · 3:00 PM EDT"

getZoneAbbrev(iso: string, tz: string): string
// Uses Intl.DateTimeFormat with timeZoneName: 'short'

groupByDay(
  invites: InviteSummary[],
  tz: string,
): Array<{ dayKey: string; label: string; items: InviteSummary[] }>
// Grouping happens in the USER'S zone, not UTC.
// Labels: "Today", "Tomorrow", then "Wed, Apr 23" for later days.

isPast(iso: string): boolean
```

All existing scheduling components migrate from local `formatWhen` to `formatInZone(iso, user.timezone)`. If `user.timezone` is unavailable yet (pre-migration row), fall back to `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### `client/src/components/schedule/ScheduleAgenda.tsx`

Props: `invites`, `tz`, `callerId`, `onAction(action, inviteId, args?)`, `onOpenDetail(inviteId)`.

Renders the output of `groupByDay` as section headers + event card lists. Empty state copy:
- Upcoming empty: "No upcoming mock interviews. Head to Practice to find a peer."
- Past-toggle empty: "No past interviews in the last 30 days."

### `client/src/components/schedule/ScheduleEventCard.tsx`

Props: a single `InviteSummary`, `tz`, `callerId`, `onAction`, `onOpenDetail`.

Layout:
- Time (with zone abbrev)
- Counterparty initials avatar + name
- Topic
- Status chip: `pending` (amber) or `confirmed` (green)
- Action row (varies by status × direction):
  - `pending_acceptance` + `received` → [Accept] [Decline] [Reschedule] [Details]
  - `pending_acceptance` + `sent` → [Cancel] [Reschedule] [Details]
  - `accepted` → [Add to calendar] [Reschedule] [Cancel] [Details]

"Details" opens the existing `InviteDetailModal` — no duplicate modal.
"Reschedule" opens a lightweight inline datetime picker or reuses the existing reschedule path from `InviteDetailModal`.

### `client/src/pages/SchedulePage.tsx`

Thin wrapper:
- Header: "Your schedule"
- `ShowPastToggle` (controlled, drives `useSchedule`)
- `<ScheduleAgenda …>`
- Owns `InviteDetailModal` open state
- First-visit nudge when `user.timezone === 'UTC'`: banner "Times are shown in UTC. Use your detected zone (<browser-zone>)?" with a one-click button that PUTs `/api/user/profile`.

### `client/src/hooks/useSchedule.ts`

Calls `GET /api/schedule?includePast=<bool>`. Reuses invite mutations from `useMockInterviews.ts` — refactor those hooks so the underlying mutation functions can be imported standalone. After any mutation, refetch.

### Settings — `<TimezoneSelect>`

Combobox backed by:
- A small curated list of common zones at the top (e.g., `America/New_York`, `America/Los_Angeles`, `Europe/London`, `Europe/Berlin`, `Asia/Kolkata`, `Asia/Singapore`, `Asia/Tokyo`, `Australia/Sydney`).
- Full IANA zone list (from `Intl.supportedValuesOf('timeZone')` where supported; curated fallback list otherwise) accessible via search.

Wired to the existing settings mutation for user profile updates.

### Navigation

- Top nav in `Layout.tsx` gets a "Schedule" link.
- `MockInterviewsSection` gets a "View full schedule →" link in its footer, pointing to `/schedule`.

## Error handling & edge cases

- **Invalid stored timezone** (hand-edited or corrupted): client's `formatInZone` catches `RangeError`, falls back to browser zone, logs once to console. Does not crash the page.
- **Reschedule race on schedule page** (another party cancelled in the background): mutation returns `422 invalid_transition`; UI shows "This invite is no longer reschedulable — refresh" with a refresh button. No automatic recovery.
- **ICS download on a just-cancelled invite**: server returns 422; client disables the button when `status !== 'accepted'`, so this is defense-in-depth only.
- **DST transitions**: `Intl.DateTimeFormat` handles correctly. All grouping uses `formatToParts` in the target zone; we never do manual hour arithmetic on formatted strings.
- **User travels to a different zone**: their stored `timezone` remains their home zone. Phase 1 is explicit about this — the zone is "my home zone." Travel-aware behavior is deferred.

## Testing

### Server

- `routes/schedule.test.ts`
  - Auth guard (401 unauth).
  - Window filtering: invites outside `from/to` excluded.
  - Status filtering: declined/cancelled excluded.
  - Includes both directions.
  - Sort order (`scheduled_for ASC`).
  - `includePast=true` returns past events; `false` excludes them.
- `lib/ics.test.ts`
  - Line endings = CRLF.
  - Required fields present.
  - Text escaping: commas, semicolons, backslashes, newlines in topic and counterparty name.
  - UID stable across repeated generations.
  - `DTSTART` / `DTEND` match `scheduled_for` + `duration_minutes`.
- `routes/schedule.test.ts` (ICS subroute)
  - 404 missing invite, 403 non-party, 422 non-accepted, 200 + correct headers + body on accepted.
- `routes/user.test.ts` additions
  - `PUT /profile` with valid IANA zone → 200 + persisted.
  - `PUT /profile` with garbage string → 400.
  - `GET /profile` response includes `timezone`.
- `routes/auth.test.ts` addition
  - `GET /me` response includes `timezone`.

### Client

- `lib/scheduling-dates.test.ts`
  - `formatInZone` respects tz.
  - `groupByDay` groups in user's zone, not UTC: critical test — 11 PM ET event on day N must group under day N even though UTC date is N+1.
  - `groupByDay` labels Today/Tomorrow correctly; handles DST boundary day.
  - `getZoneAbbrev` returns EDT vs EST at correct times of year.
- `components/schedule/ScheduleAgenda.test.tsx`
  - Renders day groupings.
  - Empty states for upcoming and past views.
  - Past toggle shifts the query.
- `components/schedule/ScheduleEventCard.test.tsx`
  - Action set matches (status × direction) matrix.
  - "Add to calendar" fires download request only for accepted events.
- `pages/SchedulePage.test.tsx`
  - End-to-end hook integration.
  - Timezone from user propagates into formatting.
  - UTC-default banner shows when `user.timezone === 'UTC'`.

## Open questions (none at this time)

All design decisions agreed during brainstorming. Plan next.
