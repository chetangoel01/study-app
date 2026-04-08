# Repository Guidelines

## Project Structure & Module Organization
`client/` contains the React + Vite SPA, `server/` contains the Hono + SQLite backend, and `build_study_data.py` is the source of truth for the curated curriculum that generates `curriculum.json`. `pipeline/` contains the enrichment pipeline (`runner.py`, `scraper.py`, `processor.py`, `graph_builder.py`) plus its dependency list in `pipeline/requirements.txt`. Treat `__pycache__/`, `pipeline/.cache/`, build outputs, and generated artifacts such as `knowledge-base.json` as disposable unless a change explicitly requires them.

## Build, Test, and Development Commands
- `npm run dev:server` starts the Hono backend on port `3000`.
- `npm run dev:client` starts the Vite frontend on port `5173`.
- `npm test` runs the server and client test suites.
- `npm run build` builds both the server and client for production.
- `npm start` runs the compiled production server.
- `python3 build_study_data.py` regenerates `curriculum.json` after changing module content.
- `python3 -m venv .venv && source .venv/bin/activate && pip install -r pipeline/requirements.txt` installs the optional pipeline dependencies.
- `LLM_API_KEY=... python3 pipeline/runner.py` (or `OPENROUTER_API_KEY=...`) runs the resource-enrichment pipeline and writes `knowledge-base.json`.

## Coding Style & Naming Conventions
Follow the current stack instead of reintroducing legacy patterns. Use 2-space indentation in TypeScript and CSS, and 4 spaces in Python. Keep JavaScript and TypeScript identifiers in `camelCase`, Python names in `snake_case`, and module IDs in `build_study_data.py` dash-separated and stable, for example `trees-heaps`. Preserve the current React/Hono architecture and concise UI copy.

## Testing Guidelines
After UI or server changes, run `npm test` and `npm run build`. For end-to-end checks, verify login/signup, dashboard navigation, track navigation, module progress toggles, and notes save behavior in the running app. After pipeline changes, run the pipeline only when required and confirm the output shape and error handling instead of committing cache noise.

## Commit & Pull Request Guidelines
Use short, imperative commit subjects consistent with the existing history, for example `Update README.md` or `Fix study guide filter state`. Keep each commit scoped to one logical change. Pull requests should summarize the user-visible or data-model impact, list regenerated artifacts, link the relevant issue, and include screenshots only when the UI changed materially.
