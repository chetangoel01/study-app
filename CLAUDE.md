# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A full-stack study planner built from a curated adaptation of [coding-interview-university](https://github.com/jwasham/coding-interview-university), backed by an optional enrichment pipeline that builds a semantic knowledge graph from the study resources.

The shipped app is a React + Vite client served by a Hono + SQLite backend. The Python tooling remains the source of truth for curriculum generation and pipeline enrichment.

## Commands

### Start the backend
```bash
npm run dev:server
```

### Start the frontend
```bash
npm run dev:client
```

### Build both server and client
```bash
npm run build
```

### Start the compiled production server
```bash
npm start
```

### Regenerate curriculum data from module changes
```bash
python3 build_study_data.py
```

### Install pipeline dependencies
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt
```

### Run the enrichment pipeline
```bash
# Requires LLM_API_KEY or OPENROUTER_API_KEY (set in study-app/.env or as env vars)
python3 pipeline/runner.py
```

### Run tests
```bash
npm test
# Or Python-only pipeline tests:
python3 -m pytest tests/
```

## Architecture

### Two parallel data flows

**Curriculum data (`curriculum.json`)** — `build_study_data.py` contains a hand-curated `MODULES` list defining every study module with items, resources, checks, phase, sessions, and track membership. Running it writes `curriculum.json`, which the Hono server loads at startup. Module IDs (for example `trees-heaps`) are stable keys and should not be renamed casually.

**Pipeline data (`knowledge-base.json`)** — `pipeline/runner.py` runs a 4-stage enrichment pipeline over all resource URLs in `MODULES`:
1. **Stage 1 – Scrape**: Fetches and normalizes each URL; writes `crawl-audit.json`. Results are disk-cached in `pipeline/.cache/scrape/`.
2. **Stage 2 – Chunk**: Splits source docs into `~3500`-char segments.
3. **Stage 3 – Embed & Cluster**: Embeds chunks via `EmbeddingClient`, clusters them with cosine similarity into topic groups.
4. **Stage 4 – Synthesize**: LLM synthesizes each cluster into a canonical topic; `canonicalize_topics()` merges duplicates; `build_topic_edges()` resolves prerequisite references; `build_planning_graph()` overlays the hand-curated `CURRICULUM_ONTOLOGY`.

### Web app structure
- **`client/`** — React + Vite SPA with route-based views for login, dashboard, track, and module pages
- **`server/`** — Hono backend with SQLite persistence, auth, curriculum, progress, notes, and proxy routes
- **`package.json`** — root convenience scripts for dev, test, build, and production start

### Pipeline internals (`pipeline/`)
- **`config.py`** — all configuration, reads from `.env` or environment. Key vars: `LLM_API_KEY`/`OPENROUTER_API_KEY`, `LLM_MODEL`, scrape cache versions, and bucket synthesis budgets.
- **`curriculum_ontology.py`** — hand-curated `CURRICULUM_ONTOLOGY` dict; the planning layer's source of truth, analogous to `MODULES` for the frontend. Topic IDs must be stable and prerequisites must be acyclic.
- **`cache.py`** — file-based cache keyed by content hash; cache versions are bumped in `config.py` (`CACHE_VERSION`, `SCRAPE_CACHE_KEY_VERSION`) to invalidate stale entries.
- **`scraper.py`** — handles YouTube transcripts, PDFs, GitHub repos, Coursera, and generic web pages; returns structured `segments`.
- **`bucket_builder.py`** / **`bucket_synthesizer.py`** / **`topic_validator.py`** — curriculum-first bucket assignment, bucket-level LLM synthesis, and topic canonicalization.
- **`planning_graph.py`** — maps synthesized topics onto `CURRICULUM_ONTOLOGY` topics via curated labels and aliases; produces planning nodes, edges, and coverage stats.

### Testing
Python tests live in `tests/`, server tests live under `server/src/`, and client tests live under `client/src/`. The root `npm test` command runs the current app test suite end to end.

## Coding conventions
- 2-space indentation in TypeScript/CSS and 4 spaces in Python
- JavaScript: `camelCase`; Python: `snake_case`; module IDs: `dash-separated`
- Treat `__pycache__/`, `pipeline/.cache/`, `client/dist/`, `server/dist/`, `knowledge-base.json`, and other local artifacts as disposable
- Update `build_study_data.py` instead of hand-editing generated curriculum output

## Design System

This project has a canonical design system. **All UI work must follow it.**

### Before editing any component or CSS

1. Read `handoff/DESIGN_SYSTEM.md` for the full token + component reference.
2. Confirm `tokens.css` and `components.css` are imported in `client/src/main.tsx`:
   ```ts
   import './styles/tokens.css';
   import './styles/components.css';
   import './index.css';
   ```
   If not, add them.

### Hard rules

When writing or editing CSS / JSX / styled-components:

- **Never** use raw hex colors. Use a CSS variable (`--accent`, `--ink-muted`, `--surface-1`, etc.). Full list in `handoff/DESIGN_SYSTEM.md`.
- **Never** invent a new `border-radius`. Use one of: `var(--r-xs)` `var(--r-sm)` `var(--r-md)` `var(--r-lg)` `var(--r-xl)` `var(--r-pill)`.
- **Never** invent a new `font-size`. Use `var(--text-2xs)` through `var(--text-4xl)`.
- **Never** write a custom `box-shadow`. Use `var(--shadow-1)` through `var(--shadow-4)` and `var(--shadow-focus)`.
- **Never** hand-pick padding/gap/margin. Use `var(--sp-1)` through `var(--sp-10)`.
- **Never** write a custom transition duration. Use `var(--dur-1)` `var(--dur-2)` `var(--dur-3)` with `var(--ease-out)` or `var(--ease-in-out)`.

### Preferred approach

Before writing bespoke CSS, check if a canonical class exists:

- Button? Use `.btn` + modifier. Don't style a raw `<button>`.
- Card surface? Use `.card` / `.card-lg` / `.card-subtle`.
- Text input / select / textarea? Use `.input` / `.select` / `.textarea` inside a `.field` wrapper.
- Status pill? Use `.badge` + semantic modifier.
- List row? Use `.row` + `.row-title` + `.row-sub`.
- Tabs? Use `.tabs` + `.tab`.
- Modal? Use `.modal` inside `.modal-scrim`.
- Empty / error state? Use `.state` wrapper.
- Loading? Use `.skeleton`.

If a new component is needed and no canonical class fits, add it to `client/src/styles/components.css` (not scattered across files) and update `handoff/DESIGN_SYSTEM.md`.

### Migration

The existing `client/src/index.css` is large legacy styling with drift (20+ distinct radii, ~200 unique font sizes mixing `rem` and `px`, 10+ ad-hoc box-shadows).

Do NOT rewrite it in one pass. When you touch a component for any reason:
1. Replace that component's raw values with tokens in the same edit.
2. Prefer deleting custom CSS in favor of the canonical classes.
3. After migrating a block, treat it as locked — no new raw values.

### Dark mode

Dark mode is controlled by `html[data-theme="dark"]`. Tokens flip automatically; never write `@media (prefers-color-scheme)` checks. If a component looks wrong in dark mode, fix it by using a token instead of a hex value, not by adding a dark override.

### Reference

The rendered design system lives at `handoff/Design System.html` (if present). Open it to see every token and component in both light and dark.
