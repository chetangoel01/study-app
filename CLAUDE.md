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
