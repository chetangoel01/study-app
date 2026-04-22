# Community Forum — v1

**Date:** 2026-04-22
**Status:** Spec (pre-plan)
**Scope:** First functional cut of the `/community` page. Backend + client wiring for threads, replies, tags, subscribe, trending, views, edits, and deletes.

## Goal

Turn the `/community` placeholder page into a working multi-user forum: users can create threads with one of a fixed set of tags, reply to threads, subscribe to threads they care about, edit and delete their own content, and see trending discussions. No notifications, no moderation, no search — those are deferred.

## Non-goals (deferred)

- **Notifications** (in-app or email) — the "Subscribed" tab is the only inbox.
- **Moderation** — no flag/report, no admin hide, no role system.
- **Search** — no full-text search over threads/replies.
- **Rich attachments** — markdown-only bodies; no images, no file uploads. Links are allowed.
- **Multi-tag threads** — one tag per thread; enum locked to 5 values.
- **Threaded/nested replies** — flat chronological replies only.
- **Votes / kudos / reactions** — trending is computed from replies + views only.
- **Rate limiting** — can layer on if spam becomes real.

## What's already in place

- `client/src/pages/CommunityPage.tsx` — static placeholder with sidebar, 5 hardcoded tag chips, disabled "New post" button, two placeholder thread cards. All styles in `client/src/index.css` under `.community-*` classes.
- `client/src/components/Layout.tsx` — `/community` already routed and reachable from top nav.
- Auth middleware (`server/src/middleware/auth.ts`) — `requireAuth` populates `ctx.user` with the signed-in user.
- `users` table with `id`, `username` — available for author display.
- Markdown rendering already used on `ModulePage.tsx`; reuse the same renderer + sanitizer for thread/reply bodies.

## Architecture overview

### Data model

Four new SQLite tables, all prefixed `forum_`:

```sql
forum_threads(
  id                TEXT PRIMARY KEY,              -- nanoid
  author_id         TEXT NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,                 -- max 200 chars (app-enforced)
  body_md           TEXT NOT NULL,                 -- max 20,000 chars
  tag               TEXT NOT NULL,                 -- enum (see below)
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  last_activity_at  TEXT NOT NULL,                 -- bumped on reply; used for sort
  reply_count       INTEGER NOT NULL DEFAULT 0,    -- denormalized
  edited_at         TEXT,                          -- null until first edit
  deleted_at        TEXT                           -- soft delete
);
CREATE INDEX idx_forum_threads_activity ON forum_threads(last_activity_at DESC);
CREATE INDEX idx_forum_threads_tag_activity ON forum_threads(tag, last_activity_at DESC);

forum_replies(
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  body_md     TEXT NOT NULL,                       -- max 10,000 chars
  created_at  TEXT NOT NULL,
  edited_at   TEXT,
  deleted_at  TEXT
);
CREATE INDEX idx_forum_replies_thread ON forum_replies(thread_id, created_at ASC);

forum_subscriptions(
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id       TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  subscribed_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, thread_id)
);

forum_thread_views(
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id       TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  last_viewed_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, thread_id)
);
-- Total view count for a thread = COUNT(*) over this table WHERE thread_id = ?
```

**Tag enum:** `system-design | dsa | career | behavioral | devops`. Stored as TEXT; validated by zod on writes and by a shared constant in `client/src/types.ts` + `server/src/lib/community.ts`.

**Denormalizations and why:**
- `forum_threads.reply_count` — incremented atomically on reply insert, decremented on hard-delete (not on soft-delete). Avoids a `COUNT(*)` on every list query.
- View count is **not** denormalized — it's `COUNT(*)` over `forum_thread_views`. Writes are more frequent than reads per thread, and we want "distinct users who viewed" (honest), not a monotonic counter.

**Soft delete semantics:**
- Thread with replies → soft-delete: title becomes `"[deleted thread]"` on render, body becomes empty, author stripped. Replies remain visible. The row stays so reply links don't 404.
- Thread with zero replies → hard delete allowed (author's choice on the delete action).
- Reply → always soft-delete: body rendered as `"[deleted]"`, author stripped. Row stays so preceding/following replies stay coherent.

### Backend API

New file `server/src/routes/community.ts`, wired in `server/src/index.ts` under `/api/community`. All routes require `requireAuth`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/community/threads` | Query: `tag?`, `filter=all\|subscribed\|trending` (default `all`), `cursor?`, `limit=20`. Returns threads + `nextCursor`. |
| `POST` | `/api/community/threads` | Body `{ title, body_md, tag }`. Auto-subscribes author. |
| `GET` | `/api/community/threads/:id` | Full thread + all (non-hidden) replies. Records a view (24h dedup). |
| `PUT` | `/api/community/threads/:id` | Author only. Fields: `title?`, `body_md?`, `tag?`. Sets `edited_at`. |
| `DELETE` | `/api/community/threads/:id` | Author only. Soft-delete if replies exist, hard-delete if not. |
| `POST` | `/api/community/threads/:id/replies` | Body `{ body_md }`. Auto-subscribes author. Bumps `last_activity_at` and `reply_count`. |
| `PUT` | `/api/community/replies/:id` | Author only. Body `{ body_md }`. Sets `edited_at`. Does **not** bump `last_activity_at`. |
| `DELETE` | `/api/community/replies/:id` | Author only. Soft-delete. Decrements `reply_count` only on **hard** delete, which doesn't apply here — soft delete leaves `reply_count` unchanged (the row still occupies a slot in the conversation). |
| `POST` | `/api/community/threads/:id/subscribe` | Idempotent. |
| `DELETE` | `/api/community/threads/:id/subscribe` | Idempotent. |

**List response shape:**

```ts
{
  threads: Array<{
    id: string;
    title: string;
    tag: CommunityTag;
    author: { id: string; username: string; avatarUrl: string | null };
    createdAt: string;
    lastActivityAt: string;
    editedAt: string | null;
    deletedAt: string | null;
    replyCount: number;
    viewCount: number;
    isSubscribed: boolean;
    excerpt: string;        // first ~200 chars of body_md, plain text
  }>;
  nextCursor: string | null;
}
```

**Thread detail shape:**

```ts
{
  thread: CommunityThreadFull;   // all thread fields + full body_md
  replies: Array<{
    id: string;
    author: { id; username; avatarUrl } | null;   // null if soft-deleted
    body_md: string;                              // "[deleted]" if soft-deleted
    createdAt: string;
    editedAt: string | null;
    deletedAt: string | null;
    canEdit: boolean;                             // author_id === ctx.user.id && !deleted_at
  }>;
  canEdit: boolean;                               // thread-level
}
```

**Ownership enforcement:** inline check at the top of edit/delete handlers — load the row, compare `author_id` to `ctx.user.id`, return 403 on mismatch. No admin override in v1.

**Trending query (in-SQL, no cron, no materialized view):**

```sql
SELECT t.*,
  COALESCE(v.view_count, 0) AS view_count,
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
ORDER BY score DESC
LIMIT 20;
```

**Pagination cursor:** opaque base64 of `{lastActivityAt, id}`. List queries use `WHERE (last_activity_at, id) < (?, ?)` for stable ordering. Trending does not paginate — always top 20.

**View dedup (24h):** single upsert on `GET /threads/:id`:

```sql
INSERT INTO forum_thread_views (user_id, thread_id, last_viewed_at)
VALUES (?, ?, ?)
ON CONFLICT(user_id, thread_id) DO UPDATE SET
  last_viewed_at = excluded.last_viewed_at
WHERE last_viewed_at < datetime('now', '-24 hours');
```

The conditional `WHERE` ensures the row is only updated (and therefore the view "re-counts") if 24h have passed. Distinct-user view count is unaffected either way — we always count rows, not updates.

**Validation:** zod schemas per route. Title ≤200, thread body ≤20k, reply body ≤10k, tag ∈ enum. 413 on too-large bodies, 400 on malformed input.

### Frontend

Two routes:
- `/community` — list view (existing placeholder page becomes real).
- `/community/t/:id` — thread detail.

**New hooks** in `client/src/hooks/useCommunity.ts` (matches the monolithic-per-feature pattern used by `useSchedule.ts`, `usePractice.ts`):
- `useCommunityThreads({ tag?, filter })` — paginated list, exposes `loadMore`.
- `useCommunityThread(id)` — single thread + replies.
- `useCreateThread`, `useUpdateThread`, `useDeleteThread`, `useCreateReply`, `useUpdateReply`, `useDeleteReply`, `useSubscribe`.

Optimistic updates on subscribe/unsubscribe (toggle state immediately, revert on error). Reply create is not optimistic — server id is needed for the rendered list.

**New components** in `client/src/components/`:
- `ThreadListItem.tsx` — replaces the placeholder `.community-thread` card. Tag chip, title, excerpt, author chip, reply count, view count, "subscribed" indicator, relative timestamp. Links to `/community/t/:id`.
- `ThreadDetailView.tsx` — rendered body (markdown), author chip, timestamps, edit/delete menu for owner, subscribe toggle.
- `ReplyItem.tsx` — body, author, timestamps, edit/delete menu for owner. Deleted state → `"[deleted]"` + stripped author.
- `ReplyComposer.tsx` — markdown textarea with preview toggle, submit. Reused on the thread page.
- `NewThreadModal.tsx` — title input, tag `<select>`, markdown textarea, preview, submit. Triggered from the `.community-new-post` button.
- `AuthorChip.tsx` — reusable: avatar (or initials fallback) + username + relative timestamp.

**Sidebar filter behavior:** the three sidebar items become `<NavLink>` to `/community?filter=all|subscribed|trending`. Tag chips set `?tag=<id>`; clicking the active tag clears it. Selection state lives in URL query params (shareable, back-button works). The hook reads query params and refetches on change.

**Empty states:**
- No threads at all → "Be the first to start a discussion" + New post button.
- No subscribed threads → "You'll see threads you subscribe to here" + link to all discussions.
- No trending threads → "Nothing hot right now — check back after folks post."

**Markdown rendering:** reuse the renderer already used by `ModulePage.tsx`. Do not fork. Sanitization must already be applied (verify during implementation; if not, it's a pre-existing bug to fix separately).

### Routing

- `main.tsx` already routes `/community`. Add one entry for `/community/t/:id` → `ThreadDetailPage`.

## File map

**New files:**

- `server/src/routes/community.ts`
- `server/src/routes/community.test.ts`
- `server/src/lib/community.ts` — query helpers (trending SQL, view upsert, ownership check)
- `client/src/pages/ThreadDetailPage.tsx`
- `client/src/hooks/useCommunity.ts`
- `client/src/components/ThreadListItem.tsx`
- `client/src/components/ThreadDetailView.tsx`
- `client/src/components/ReplyItem.tsx`
- `client/src/components/ReplyComposer.tsx`
- `client/src/components/NewThreadModal.tsx`
- `client/src/components/AuthorChip.tsx`

**Modified files:**

- `server/src/db/schema.ts` — append four new tables + indexes.
- `server/src/index.ts` — wire `makeCommunityRouter(db)` at `/api/community`.
- `client/src/main.tsx` — add `/community/t/:id` route.
- `client/src/pages/CommunityPage.tsx` — rewrite against the new hooks + components.
- `client/src/types.ts` — export `CommunityTag`, `CommunityThread`, `CommunityThreadFull`, `CommunityReply`.
- `client/src/styles/components.css` — any new canonical classes needed (only if no existing class fits). Tokens only; no raw values.

**Untouched:** all existing curriculum, progress, notes, practice, schedule, availability, mock-interviews, auth routes. No migrations on existing tables.

## Testing strategy

**Server tests** (`server/src/routes/community.test.ts`):
- Thread create/list/get/edit/delete happy path.
- 403 on editing or deleting another user's thread or reply.
- 413 on oversized title/body; 400 on malformed tag / missing fields.
- Reply create bumps `last_activity_at` and `reply_count`; reply edit does not.
- Subscribe/unsubscribe is idempotent; creating a thread auto-subscribes author; replying auto-subscribes replier.
- View count dedup: two `GET /threads/:id` within 24h → 1 distinct view row; after simulated 24h + 1s → still 1 distinct view row (same user), but `last_viewed_at` advances.
- `filter=subscribed` returns only threads the caller is subscribed to.
- `filter=trending` respects the 7-day window and orders by score.
- `tag=<id>` filters correctly.
- Soft delete: thread with replies cannot be hard-deleted; thread without replies can; deleted reply renders as `"[deleted]"` with author stripped in the detail response.

**Client tests** (match existing pattern — minimal, hook-focused):
- `useCommunity` hook tests with mocked fetch: list, create, subscribe toggle optimism revert.
- `ThreadListItem` snapshot/props rendering (tag chip, counts, subscribed pill).
- `NewThreadModal` form validation (empty title, body over limit, missing tag).

No full end-to-end integration tests — existing project doesn't run them, we won't introduce them here.

## Open assumptions

1. **User display:** using `users.username`. If no `avatar_url` column exists, `AuthorChip` falls back to initials. Implementation will verify the `users` schema and note any gap.
2. **Pagination UX:** "Load more" button, not infinite scroll. Matches existing patterns and avoids intersection-observer plumbing.
3. **"New post" discoverability:** only available from `/community`. No global nav entry.
4. **Thread deletion with others' replies:** soft-delete the thread row (title → `"[deleted thread]"`, body empty, author stripped). Replies stay visible.
5. **XSS:** the markdown renderer on `ModulePage.tsx` is trusted to sanitize. Implementation will confirm; if sanitization is missing, it's a pre-existing bug and will be fixed as part of this work (it affects the community surface directly).
6. **Timezones:** timestamps stored as ISO 8601 UTC strings; relative rendering on the client (e.g. `"3 hours ago"`) via the same helper used elsewhere in the app.
