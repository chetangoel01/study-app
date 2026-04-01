# Repository Guidelines

## Project Structure & Module Organization
`index.html`, `styles.css`, and `app.js` make up the static browser app. `build_study_data.py` is the source of truth for study modules and generates `data.js`; update the Python definitions instead of hand-editing generated data. `pipeline/` contains the enrichment pipeline (`runner.py`, `scraper.py`, `processor.py`, `graph_builder.py`) plus its dependency list in `pipeline/requirements.txt`. Treat `__pycache__/`, `pipeline/.cache/`, and generated outputs such as `knowledge-base.json` as disposable artifacts unless a change explicitly requires them.

## Build, Test, and Development Commands
- `python3 -m http.server 8000` from the repository root serves the app at `http://localhost:8000/study-app/`.
- `python3 build_study_data.py` from `study-app/` regenerates `data.js` after changing module content.
- `python3 -m venv .venv && source .venv/bin/activate && pip install -r pipeline/requirements.txt` installs the optional pipeline dependencies.
- `ANTHROPIC_API_KEY=... python3 pipeline/runner.py` runs the resource-enrichment pipeline and writes `knowledge-base.json`.

## Coding Style & Naming Conventions
Follow the existing lightweight style instead of introducing frameworks. Use 2-space indentation in HTML, CSS, and JavaScript, and 4 spaces in Python. Keep JavaScript identifiers in `camelCase`, Python names in `snake_case`, and module IDs in `build_study_data.py` dash-separated and stable, for example `trees-heaps`. Preserve the current plain-vanilla browser architecture and concise UI copy.

## Testing Guidelines
There is no formal automated test suite yet, so rely on targeted manual checks. After UI or data changes, regenerate `data.js` if needed, serve the app locally, and verify search, phase filters, completion toggles, notes, and localStorage-backed progress. After pipeline changes, run the pipeline only when required and confirm the output shape and error handling instead of committing cache noise.

## Commit & Pull Request Guidelines
Use short, imperative commit subjects consistent with the existing history, for example `Update README.md` or `Fix study guide filter state`. Keep each commit scoped to one logical change. Pull requests should summarize the user-visible or data-model impact, list regenerated artifacts, link the relevant issue, and include screenshots only when the UI changed materially.
