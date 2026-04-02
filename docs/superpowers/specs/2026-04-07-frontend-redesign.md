# Frontend Redesign — Design Spec
**Date:** 2026-04-07

## Overview

Full redesign of the study app from a static vanilla JS SPA into a full-stack web application. The new app is a curriculum-based study tool organized into four tracks, where each module builds on prior ones, items are individually checkable (with link-outs for assignments), and progress is persisted per user account.

The Python data pipeline remains untouched as a standalone data generation tool. The web stack is built fresh alongside it.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite (TypeScript) |
| Backend | Hono (Node.js, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| Auth | Email/password + Google OAuth + GitHub OAuth via `arctic` |
| Content proxy | Server-side fetch, in-memory cache |

The backend serves the React build as static files in production. In dev, Vite runs on port 5173 and Hono on port 3000 with a proxy.

---

## Repository Structure

```
study-app/
├── client/                  # React + Vite SPA
│   ├── src/
│   │   ├── pages/           # Dashboard, Track, Module
│   │   ├── components/      # Shared UI components
│   │   ├── hooks/           # Data fetching, auth state
│   │   └── main.tsx
│   └── vite.config.ts
├── server/                  # Hono backend
│   ├── src/
│   │   ├── routes/          # auth, curriculum, progress, notes, proxy
│   │   ├── db/              # SQLite schema + queries
│   │   ├── curriculum/      # Loads build_study_data.py output + knowledge-base.json
│   │   └── index.ts
│   └── tsconfig.json
├── pipeline/                # Python scripts — untouched
├── build_study_data.py      # Source of truth for module definitions
├── knowledge-base.json      # Generated — read by server at startup
└── data.js                  # Retired — server reads modules directly
```

---

## Tracks

Modules in `build_study_data.py` each receive a `track` field. The four tracks:

| Track ID | Label | Description |
|----------|-------|-------------|
| `dsa-leetcode` | DSA & LeetCode | Data structures, algorithms, complexity, coding patterns |
| `system-design` | System Design | Distributed systems, architecture, scalability |
| `machine-learning` | Machine Learning | ML/AI interview prep |
| `resume-behavioral` | Resume & Behavioral | Resume, soft skills, STAR method |

Track ordering within `build_study_data.py` defines the curriculum sequence. Module IDs remain stable and dash-separated.

---

## Routing (Multi-route SPA)

| Route | View |
|-------|------|
| `/` | Dashboard |
| `/track/:trackId` | Track view |
| `/track/:trackId/module/:moduleId` | Module view |
| `/login` | Login / signup |

Each route has its own layout. Browser history and back button work naturally. URLs are bookmarkable.

---

## Views

### Dashboard (`/`)
- **"What to do now" card** — top of page, picks the furthest in-progress module across all tracks, shows the next unchecked item, one-click to open the module
- **4 track columns** — each shows track name, overall progress bar, and the next 3–4 modules with status chips (Done / In Progress / Available / Soft-locked)
- Clicking a track column navigates to `/track/:trackId`
- **Responsive**: 4-col grid → 2-col → 1-col on smaller screens

### Track View (`/track/:trackId`)
- Minimal top bar: app name, track name, back to dashboard
- Full-width vertical list of modules in curriculum order
- Each module card: title, status, estimated sessions, "builds on X" label if prerequisite exists
- Soft-locked modules: dimmed, prerequisite named, still clickable
- Clicking a module navigates to its module page

### Module View (`/track/:trackId/module/:moduleId`)
- Minimal top bar: track name, module title, prev/next module navigation
- **Left column — Read**: inline `study_guide_markdown` for each mapped topic from `knowledge-base.json`, rendered as markdown. "Go deeper" links below.
- **Right column — Do**: assignment checklist items and LeetCode problems as styled link-out cards; interview check prompts as self-assessment items
- Each item (read resource, assignment, check) is independently checkable
- Notes textarea at the bottom
- **Responsive**: 2-col → stacked 1-col on mobile
- Nav chrome shrinks on this page — maximum space given to content

---

## Module Item Types

Each checkable item has a `type`:

| Type | Description | Behavior |
|------|-------------|----------|
| `read` | Resource to read/watch | Proxied inline if possible, link-out fallback |
| `do` | Assignment / LeetCode problem | Always link-out (opens new tab) |
| `check` | Interview self-assessment prompt | No link, just a checkbox |

LeetCode items always link out — they require auth on LeetCode's side and cannot be proxied.

---

## Prerequisite / Lock Model

Prerequisite logic is computed server-side from the module ordering and `knowledge-base.json` edges. Module statuses returned by the API:

| Status | Meaning |
|--------|---------|
| `done` | All items complete |
| `in-progress` | At least one item complete |
| `available` | No prerequisite, or prerequisite is done |
| `soft-locked` | Prerequisite module not yet complete |

Soft-locked modules are accessible — the user is never hard-blocked. The UI dims them and names the prerequisite. No lock logic lives in the frontend.

---

## API

All routes under `/api`. Auth required on all routes except `/api/auth/*`.

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/auth/oauth/google
GET    /api/auth/oauth/google/callback
GET    /api/auth/oauth/github
GET    /api/auth/oauth/github/callback

GET    /api/curriculum                          # all tracks, modules, topics, edges + user's module statuses
GET    /api/progress                            # all progress items for current user
PUT    /api/progress/:moduleId/:itemIndex       # toggle item complete/incomplete
GET    /api/notes/:moduleId
PUT    /api/notes/:moduleId

GET    /api/proxy?url=...                       # server-side content fetch, in-memory cached
```

---

## Database Schema

```sql
CREATE TABLE users (
  id           INTEGER PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT,          -- NULL if OAuth-only account
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE oauth_accounts (
  id                 INTEGER PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  provider           TEXT NOT NULL,   -- 'google' | 'github'
  provider_user_id   TEXT NOT NULL,
  created_at         TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE progress (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  module_id    TEXT NOT NULL,
  item_index   INTEGER NOT NULL,
  item_type    TEXT NOT NULL,   -- 'read' | 'do' | 'check'
  completed    INTEGER DEFAULT 0,
  completed_at TEXT,
  UNIQUE(user_id, module_id, item_index)
);

CREATE TABLE notes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  module_id  TEXT NOT NULL,
  content    TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, module_id)
);
```

---

## Auth Logic

- **Sign up with email** → creates account with `password_hash`, no OAuth linked
- **Sign up with Google/GitHub** → creates account with `password_hash = NULL`, OAuth row linked
- **Sign in with Google/GitHub** → looks up existing account by email; if found, links OAuth to it (auto-merge); if not, creates new account
- **Sign in with email, no password set** → respond with a specific error code; client shows "You usually sign in with Google/GitHub — set a password?" and triggers a password-set email
- **Auto-merge rule**: any OAuth login resolving to an existing email links to that account rather than creating a duplicate

Sessions use JWT stored in an httpOnly cookie. Tokens expire after 7 days.

---

## Content Proxy

`GET /api/proxy?url=<encoded-url>`

- Server fetches the URL, extracts readable text content (strip nav/ads/boilerplate)
- Response cached in memory keyed by URL — cache cleared on server restart
- On fetch failure: return `{ error: "unavailable" }` — client falls back to a plain link-out card
- LeetCode URLs are never proxied — the client sends them directly as link-outs

---

## Curriculum Loading

`build_study_data.py` is updated to write a `curriculum.json` alongside `data.js` (which is retired). `curriculum.json` is plain JSON — no `window.` global, directly readable by Node.js.

At server startup:
1. Read `curriculum.json` for module definitions (including track assignments)
2. Read `knowledge-base.json` for planning topics, edges, and `study_guide_markdown`
3. Build in-memory curriculum object mapping modules → topics → edges
4. This object is read-only at runtime; restart server to pick up pipeline or module changes

To update curriculum data: run `python3 build_study_data.py` → restart server.

---

## What the Python Pipeline Stays Responsible For

- Scraping, embedding, clustering, and synthesizing resource content
- Writing `knowledge-base.json`
- No changes to pipeline code as part of this redesign
- Run manually: `python3 pipeline/runner.py` → regenerate `knowledge-base.json` → restart server
