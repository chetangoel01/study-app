# Study App

This is a static browser app that turns the repository into a curated study roadmap.

It groups the README into practical modules, gives each module concrete deliverables, links to a small set of recommended source materials, includes interview-readiness checks, and saves your notes and progress in the browser.

## Refresh the dataset

If `README.md` changes and you want to regenerate the app data:

```bash
python3 study-app/build_study_data.py
```

## Open locally

The app works best when served from the repository root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/study-app/`.

## Pull a purchased LeetCode course

If you want to bring a purchased LeetCode Explore course into this repo as a source artifact:

1. In Arc, export your authenticated LeetCode cookies to a local file.
2. Save that file somewhere local such as `leetcode.cookies.txt`.
3. Run the downloader:

```bash
python3 download_leetcode_course.py --cookies leetcode.cookies.txt
```

By default this crawls the LeetCode Interview Crash Course root URL, fetches only nested course pages, and writes:

- `course_exports/leetcode-crash-course/html/*.html` for raw page captures
- `course_exports/leetcode-crash-course/chapters/*.json` for course outline data
- `course_exports/leetcode-crash-course/items/*.json` for lesson content payloads
- `course_exports/leetcode-crash-course/manifest.json` for the crawl index

Treat the cookie export like a password and do not commit it. The raw export is an intermediate import artifact; once you review the content, convert the material you want into `MODULES` entries in `build_study_data.py`.

If `course_exports/leetcode-crash-course/manifest.json` is present, `build_study_data.py` now auto-imports the selected core DSA chapters into a dedicated `LeetCode Course` phase in the app.

The pipeline also consumes the exported item JSON locally, so LeetCode lesson and problem text can be synthesized into `knowledge-base.json` without re-authenticating against LeetCode during normal pipeline runs.
