# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static browser app that turns the [coding-interview-university](https://github.com/jwasham/coding-interview-university) README into a curated study roadmap, backed by an optional LLM enrichment pipeline that builds a semantic knowledge graph from the study resources.

No build step, no framework, no bundler — just vanilla HTML/CSS/JS served from the repo root.

## Commands

### Serve locally (from repo root)
```bash
python3 -m http.server 8000
# Then open http://localhost:8000/study-app/
```

### Regenerate frontend data from module changes
```bash
# From study-app/
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
python3 -m pytest tests/
# Or run a single test file:
python3 -m pytest tests/test_planning_graph.py
```

## Architecture

### Two parallel data flows

**Frontend data (`data.js`)** — `build_study_data.py` contains a hand-curated `MODULES` list defining every study module with items, resources, checks, phase, and session estimates. Running it writes `data.js`, which sets `window.STUDY_GUIDE_DATA` as a global. Module IDs (e.g. `trees-heaps`) are stable keys — don't rename them.

**Pipeline data (`knowledge-base.json`)** — `pipeline/runner.py` runs a 4-stage enrichment pipeline over all resource URLs in `MODULES`:
1. **Stage 1 – Scrape**: Fetches and normalizes each URL; writes `crawl-audit.json`. Results are disk-cached in `pipeline/.cache/scrape/`.
2. **Stage 2 – Chunk**: Splits source docs into `~3500`-char segments.
3. **Stage 3 – Embed & Cluster**: Embeds chunks via `EmbeddingClient`, clusters them with cosine similarity into topic groups.
4. **Stage 4 – Synthesize**: LLM synthesizes each cluster into a canonical topic; `canonicalize_topics()` merges duplicates; `build_topic_edges()` resolves prerequisite references; `build_planning_graph()` overlays the hand-curated `CURRICULUM_ONTOLOGY`.

### Frontend (zero dependencies)
- **`index.html`** — shell with placeholder containers; all content is JS-rendered
- **`data.js`** — generated module data (source of truth: `build_study_data.py`)
- **`app.js`** — single-file SPA: state management, DOM rendering, localStorage persistence, search/filter/progress tracking
- **`styles.css`** — all styling, responsive layout

### State model (`app.js`)
`appState` is the single source of truth. `loadState()`/`saveState()` serialize to `localStorage` under key `ciu-study-guide-state`. State includes per-module progress (item checkboxes), notes, selected module, search/filter/pace settings. All rendering flows through `render()`.

Progress is tracked per-item via `appState.progress[moduleId][itemIndex]`. Module phases (`Start Here`, `Core Track`, `Deepen`, `Interview Loop`, `Optional Advanced`) drive the phase filter UI.

### Pipeline internals (`pipeline/`)
- **`config.py`** — all configuration, reads from `study-app/.env` or environment. Key vars: `LLM_API_KEY`/`OPENROUTER_API_KEY`, `LLM_MODEL`, scrape cache versions, and bucket synthesis budgets.
- **`curriculum_ontology.py`** — hand-curated `CURRICULUM_ONTOLOGY` dict; the planning layer's source of truth, analogous to `MODULES` for the frontend. Topic IDs must be stable and prerequisites must be acyclic.
- **`cache.py`** — file-based cache keyed by content hash; cache versions are bumped in `config.py` (`CACHE_VERSION`, `SCRAPE_CACHE_KEY_VERSION`) to invalidate stale entries.
- **`scraper.py`** — handles YouTube transcripts, PDFs, GitHub repos, Coursera, and generic web pages; returns structured `segments`.
- **`bucket_builder.py`** / **`bucket_synthesizer.py`** / **`topic_validator.py`** — curriculum-first bucket assignment, bucket-level LLM synthesis, and topic canonicalization.
- **`planning_graph.py`** — maps synthesized topics onto `CURRICULUM_ONTOLOGY` topics via curated labels and aliases; produces planning nodes, edges, and coverage stats.

### Testing
Tests live in `tests/` and use Python `unittest`. They stub out heavy dependencies (`trafilatura`, `pypdf`, etc.) to run without the `.venv`. No test runner config is needed — `python3 -m pytest tests/` works from the repo root.

## Coding conventions
- 2-space indentation in HTML/CSS/JS; 4 spaces in Python
- JavaScript: `camelCase`; Python: `snake_case`; module IDs: `dash-separated`
- Treat `__pycache__/`, `pipeline/.cache/`, `knowledge-base.json`, and `data.js` as generated artifacts — don't commit cache noise
- Don't hand-edit `data.js`; update `build_study_data.py` instead
