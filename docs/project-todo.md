# Project TODO

- [x] Practice analytics for quizzes:
  - Include quiz attempts in richer stats beyond session history (accuracy trend, by difficulty, by mode).
  - Add weak-topic insights from quiz question metadata/tags so users get targeted follow-up practice.
  - Expose the analytics in `/api/practice/stats` and surface on the practice dashboard.

- [x] Fix dashboard "Currently mastering" card content/state:
  - Correct module/title context so it does not show mismatched track/module copy.
  - Ensure progress %, next item, and CTA labels reflect the active module session state.
  - Verify "Resume session" and "View curriculum" actions route to the intended module/track.

- [ ] Fix submodule content scraping + backend content quality:
  - Audit scraping coverage/accuracy per submodule source and remove noisy/incorrect extractions.
  - Normalize and validate backend submodule content payloads (titles, summaries, topic markdown, links).
  - Add safeguards/tests so malformed or thin scraped content is flagged before it reaches production data.

- [ ] Redesign "Find a Peer" scheduling flow:
  - Fix broken "Invite a Peer" path and verify invite creation succeeds end-to-end.
  - Clarify where "Post Availability" entries are visible/consumed in product UX.
  - Replace single-time availability posting with multiple selectable calendar blocks.
  - Add role preference matching so users can request "I want to be interviewed" (test taken, not given).

- [ ] Implement `/community` forum end-to-end:
  - Replace placeholder thread cards with real API data and include loading, empty, and error states.
  - Add SQLite schema support for community threads, replies, tags, subscriptions, and thread stats.
  - Add authenticated API routes for thread list/filter (`all`, `subscribed`, `trending`), thread detail, create post, and create reply.
  - Wire the disabled "New post" button to a real create-thread flow with validation and submission feedback.
  - Make "Subscribed" and "Trending" sidebar items functional instead of disabled placeholders.
  - Populate "Popular tags" dynamically and support click-to-filter behavior.
  - Replace placeholder reply/view counts (`—`) plus sample metadata with real values from backend.
  - Add a thread detail view (e.g. `/community/:threadId`) so thread cards can be opened and replied to.
  - Integrate community reply/subscription activity with the existing `notify_community` user preference.
  - Add test coverage across server routes, client states/interactions, and a basic create-post + reply end-to-end flow.

- [x] Add Pomodoro timer in top-right navigation:
  - Place a Pomodoro control next to the search icon in the global top bar (`client/src/components/Layout.tsx`).
  - Support core timer controls: start, pause, reset, and quick mode switch between focus and break.
  - Display clear remaining time and current phase directly in the top bar without crowding mobile layout.
  - Add optional completion cue (sound/toast) when a focus or break session ends.
  - Persist timer state (or at minimum selected duration/settings) across route changes and refreshes.
  - Ensure accessibility (keyboard controls, screen-reader labels, reduced-motion-safe behavior).
  - Add client test coverage for timer state transitions and top-bar rendering behavior.

- [ ] Add user profile photo support:
  - Add profile photo upload/change/remove in Settings and account menu entry points.
  - Store avatar metadata in the user profile model and serve a safe image URL to the client.
  - Validate file type/size and handle failed uploads with clear error messages.
  - Show avatar fallback initials when no photo is set or image fails to load.
  - Update top-bar/account UI to render real profile photos consistently across pages.
  - Add tests for upload validation, persistence, and fallback rendering behavior.

- [ ] Productionize Google + GitHub OAuth auth:
  - Document and validate required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `BASE_URL`.
  - Document provider callback URLs and keep them aligned with server routes:
    - Google: `${BASE_URL}/api/auth/oauth/google/callback`
    - GitHub: `${BASE_URL}/api/auth/oauth/github/callback`
  - Add startup/runtime guards so missing OAuth env config fails clearly (or disables OAuth buttons with a user-friendly message).
  - Improve OAuth failure UX by redirecting back to login with actionable error messaging instead of raw JSON error pages.
  - Verify account-linking behavior when OAuth email matches an existing password account (no duplicate user rows).
  - Add optional account-link/unlink controls in settings for connected OAuth providers.
  - Add auth/integration tests for OAuth state validation, callback success/failure paths, and session cookie creation.

- [ ] Build a real notifications system (in-app + optional email):
  - Add notification domain model/tables (event type, actor, target, read state, timestamps, delivery channel/status).
  - Add backend notification APIs for list, mark read/unread, and unread count.
  - Add top-bar notification center UI (bell icon, unread badge, recent feed, mark-all-read).
  - Emit notifications for meaningful events: mock interview invites/updates, community replies/mentions (when forum ships), and challenge/goal milestones.
  - Add a scheduler/worker flow for daily challenge reminders and weekly progress digests.
  - Gate all sends using `notifyDailyChallenge`, `notifyWeeklyProgress`, and `notifyCommunity` preferences.
  - Add optional email delivery provider integration (templated emails, retries, and failure logging).
  - Add tests for preference gating, notification creation/read flows, and digest scheduling behavior.

- [ ] Add calendar integration + reminders for scheduling:
  - Keep current `scheduled_for` / `proposed_for` flow as source of truth and expose events in a user-facing schedule view.
  - Add one-click “Add to calendar” (ICS export first), then optional Google Calendar sync.
  - If Google Calendar sync is enabled, support connect/disconnect and event create/update/cancel on schedule changes.
  - Upgrade availability posting to support multiple selectable time blocks instead of one timestamp.
  - Add timezone-aware rendering and conflict checks when creating or updating mock interview times.
  - Add reminder automation (e.g., 24h + 1h before) wired to notification preferences.
  - Add accept/decline/reschedule lifecycle for mock interviews so calendar events stay consistent.
  - Add tests for timezone handling, calendar payload correctness, and reminder timing.

- [ ] Harden dashboard/curriculum module gating and prerequisite logic:
  - Replace hardcoded dashboard fallback (`dsa-leetcode`) with "next available module across all tracks".
  - Enforce lock/prerequisite checks in backend progress routes so direct URL/API access cannot bypass locked modules.
  - Use real prerequisite graph inputs (e.g. `prerequisiteModuleIds`) in blocking calculations instead of only sequential `blockedBy`.
  - Add explicit empty-track UX for tracks with zero modules so users do not land on dead-end roadmap pages.
  - Add route/API tests for locked-module denial and prerequisite unlock behavior.

- [ ] Replace curriculum placeholder sections with production content:
  - Move `/curriculum` "Coming soon" lanes from hardcoded frontend constants to backend-managed data.
  - Replace/remove the inert "Resources" filler section and ship a real resources experience (or hide until ready).
  - Add tests to ensure live/upcoming curricula render from server data contracts.

- [ ] Complete practice mode implementations and challenge lifecycle:
  - Implement full interactive session flows for DSA and concurrency modes (not prompts-only fallback pages).
  - Remove fake/fallback scoring and fixed-duration assumptions in session recording; persist real outcomes consistently.
  - Add automated daily-challenge seeding/rotation so challenge freshness does not depend on manual seed scripts.
  - Add complete user-facing interview scheduling surfaces (sent invites, received invites, availability queue, status history).
  - Implement accept/decline/reschedule/cancel transitions and persist status changes end-to-end.
  - Add tests for full lifecycle transitions, not only create endpoints.

- [ ] Harden profile/account management flows:
  - Add a real "Set password" flow for OAuth-only accounts in Settings.
  - Make provider connect/link behavior explicit and safe for currently logged-in users (prevent accidental account switching).
  - Require re-authentication and/or password confirmation before account deletion.
  - Use `fullName` consistently in account identity surfaces when available (with safe fallback).
