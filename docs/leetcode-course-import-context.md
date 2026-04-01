# LeetCode Course Import Context

Date: 2026-04-01

## Goal

Pull the purchased LeetCode Explore course content into this repo so it can be mapped into the study app.

Source course root:

- `https://leetcode.com/explore/interview/card/leetcodes-interview-crash-course-data-structures-and-algorithms/`

## What we changed

Added a LeetCode course exporter:

- `download_leetcode_course.py`

Updated supporting files:

- `README.md`
- `.gitignore`
- `tests/test_leetcode_downloader.py`

## Important implementation detail

The Explore course page is mostly a JavaScript shell, so plain HTML crawling does not expose the nested lesson pages.

The exporter now uses LeetCode's GraphQL API instead of DOM link scraping. It pulls:

- course metadata with `GetCardDetail`
- chapter and item outline with `GetChaptersWithItems`
- article content with `GetArticle`
- question content with `GetQuestion`
- additional content types with `GetHtmlArticle`, `GetVideo`, and `GetWebPage`

## Cookie/session workflow

The exporter uses a local LeetCode cookie export file for authentication.

Used locally:

- `leetcode.com_cookies.txt`

This file should be treated like a password and should not be committed.

## Command used

```bash
python3 download_leetcode_course.py \
  --cookies /Users/chetangoel/Desktop/Repositories/study-app/leetcode.com_cookies.txt \
  --delay 3
```

## Export result

The run completed successfully and saved:

- `13` chapters
- `149` total items
- `77` article items
- `72` question items

Main output:

- `course_exports/leetcode-crash-course/manifest.json`

Structured export directories:

- `course_exports/leetcode-crash-course/chapters/`
- `course_exports/leetcode-crash-course/items/`

Example exported item:

- `course_exports/leetcode-crash-course/items/007-reverse-string.json`

## Notes

There are leftover artifacts from the initial shell-only crawl attempt:

- `course_exports/leetcode-crash-course/html/index.html`
- `course_exports/leetcode-crash-course/pages/index.json`

These are not part of the final GraphQL-based export path and can be ignored or removed later.

## Verification performed

Ran:

```bash
python3 -m py_compile download_leetcode_course.py
python3 -m unittest tests.test_leetcode_downloader
```

Both passed.

## Next step

Build a converter that reads the LeetCode export under `course_exports/leetcode-crash-course/` and turns the selected chapters/items into `MODULES` entries in `build_study_data.py`, then regenerate `data.js`.
