# Daily Challenges — Design Spec
**Date:** 2026-04-10

## Overview

Replace the current stub daily challenge experience (which simply opens LeetCode externally and marks complete) with a fully functional in-app challenge solver. Users write Python solutions in a dedicated page, which are executed against structured test cases via the Piston API.

---

## 1. Data Model

### Schema additions to `daily_challenge_pool`

Two new columns, added via `addCol` in `schema.ts`:

| Column | Type | Description |
|---|---|---|
| `function_name` | `TEXT NOT NULL DEFAULT ''` | Python function name users must define (e.g. `two_sum`) |
| `test_cases` | `TEXT NOT NULL DEFAULT '[]'` | JSON array of `{args: any[], expected: any}` |
| `tags` | `TEXT DEFAULT '[]'` | JSON array of tag strings e.g. `["arrays","hash-map"]` |

**Test case format:**
```json
[
  {"args": [[2,7,11,15], 9], "expected": [0,1]},
  {"args": [[3,2,4], 6],     "expected": [1,2]}
]
```

`args` is a JSON array of positional arguments passed to the function via `function_name(*case["args"])`. `expected` is the exact return value compared with `==`.

### Seed script

`server/src/db/seed-challenges.ts` — populates ~30 classic LeetCode problems with test cases, `function_name`, `description_markdown`, and `starter_code`. Idempotent: uses `INSERT OR IGNORE` on `active_date`. Run once manually via `npx ts-node` or as an npm script.

---

## 2. Backend Routes

### Admin routes — `/api/admin/challenges`

Protected by `X-Admin-Secret: <value>` header checked against `process.env.ADMIN_SECRET`. All routes return 401 if the header is missing or wrong.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/challenges` | List all challenges (all fields) |
| `POST` | `/api/admin/challenges` | Create a new challenge |
| `PUT` | `/api/admin/challenges/:id` | Update a challenge by ID |
| `DELETE` | `/api/admin/challenges/:id` | Delete a challenge by ID |

**POST/PUT body:**
```json
{
  "title": "Two Sum",
  "difficulty": "Easy",
  "functionName": "two_sum",
  "descriptionMarkdown": "## Two Sum\n\nGiven an array...",
  "starterCode": "def two_sum(nums, target):\n    pass",
  "testCases": [{"args": [[2,7,11,15],9], "expected": [0,1]}],
  "tags": ["arrays","hash-map"],
  "durationMins": 30,
  "activeDate": "2026-04-10",
  "leetcodeUrl": "https://leetcode.com/problems/two-sum/"
}
```

### Challenge submit route — `/api/practice/challenge/:id/submit`

**POST** — authenticated (existing `requireAuth` middleware).

**Request body:**
```json
{ "code": "def two_sum(nums, target):\n    ..." }
```

**Flow:**
1. Fetch challenge by ID from `daily_challenge_pool`
2. Parse `test_cases` JSON
3. Build Python harness (see Section 3)
4. POST to `https://emkc.org/api/v2/piston/execute`
5. Parse harness stdout as JSON results array
6. If all tests pass AND request includes `{"submit": true}`: record `daily_challenge_completions` + `practice_sessions` rows
7. Return per-test results

**Response:**
```json
{
  "results": [
    {"passed": true,  "output": "[0, 1]", "expected": "[0, 1]"},
    {"passed": false, "output": "None",   "expected": "[1, 2]"}
  ],
  "allPassed": false
}
```

### Navigation change

`GET /api/practice/daily-challenge` already exists and returns the challenge for today. No change needed — `ChallengePage` fetches by ID from a new `GET /api/practice/challenge/:id` route (returns single challenge by ID, same shape as daily-challenge response plus `testCases`, `functionName`, `tags`).

---

## 3. Code Execution — Piston API

**Endpoint:** `POST https://emkc.org/api/v2/piston/execute`  
**Language:** `python`, version `3.10.0`  
**No API key required.**

**Harness template** (server-side, never sent to client):
```python
{user_code}

import json as _json
_results = []
_cases = {test_cases_json}
for _case in _cases:
    try:
        _result = {function_name}(*_case["args"])
        _results.append({
            "passed": _result == _case["expected"],
            "output": repr(_result),
            "expected": repr(_case["expected"])
        })
    except Exception as _e:
        _results.append({
            "passed": False,
            "output": str(_e),
            "expected": repr(_case["expected"])
        })
print(_json.dumps(_results))
```

User code is prepended verbatim. Private variables (`_results`, `_cases`, etc.) use underscore prefix to avoid colliding with user-defined names.

**Piston request shape:**
```json
{
  "language": "python",
  "version": "3.10.0",
  "files": [{"content": "<harness>"}]
}
```

**Error handling:**
- Piston network failure → return 502 with `{ error: "Execution service unavailable" }`
- Harness stdout is not valid JSON → treat as runtime error, return single failed result with raw stdout as output
- Piston `compile_output` or `stderr` present → surface in the first failed result's `output` field

---

## 4. Frontend — `ChallengePage.tsx`

**Route:** `/practice/challenge/:id`

**Layout:** Full-page split pane.

```
┌─────────────────────────────────────────────────────────┐
│  ← Back    Two Sum    [Medium]    🕐 35:00               │
├────────────────────────┬────────────────────────────────┤
│  Problem description   │  Code editor (textarea)         │
│  (rendered markdown)   │  monospace, tab = 4 spaces     │
│                        ├────────────────────────────────┤
│  Examples from         │  ▶ Run Tests   ✓ Submit        │
│  test cases            ├────────────────────────────────┤
│                        │  Per-test results panel         │
└────────────────────────┴────────────────────────────────┘
```

**Components:**
- `ChallengePage.tsx` — page shell, fetches challenge by ID, owns timer state
- `ChallengeEditor.tsx` — `<textarea>` with monospace styling, tab-key handler (inserts 4 spaces), pre-filled with `starter_code`
- `TestResultsPanel.tsx` — renders per-test pass/fail rows with expected vs actual

**Timer:** counts down from `durationMins * 60`. Shows `MM:SS`. Turns red at 5 minutes. Does not auto-submit on expiry — just stops.

**Run vs Submit:**
- "Run Tests" → POST `{code}` to `/api/practice/challenge/:id/submit` (no `submit` flag) → shows results, no completion recorded
- "Submit" → POST `{code, submit: true}` → on `allPassed: true`, navigates back to `/practice` and triggers stats refetch; on failure, shows results and keeps user on page

**Navigation change in `PracticePage.tsx`:** the "Solve Challenge" button calls `navigate(\`/practice/challenge/${dailyChallenge.id}\`)` instead of `window.open(...)`.

---

## 5. Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `server/src/db/seed-challenges.ts` | Seed script for ~30 classic problems |
| `server/src/routes/admin.ts` | Admin CRUD routes for challenge pool |
| `client/src/pages/ChallengePage.tsx` | Challenge solver page |
| `client/src/components/ChallengeEditor.tsx` | Code editor textarea component |
| `client/src/components/TestResultsPanel.tsx` | Test results display component |

### Modified files
| File | Change |
|---|---|
| `server/src/db/schema.ts` | Add `function_name`, `test_cases`, `tags` columns via `addCol` |
| `server/src/routes/practice.ts` | Add `GET /challenge/:id` route; update submit route to use new harness + Piston |
| `server/src/index.ts` | Mount admin router at `/api/admin` |
| `client/src/pages/PracticePage.tsx` | Change "Solve Challenge" button to `navigate(...)` |
| `client/src/hooks/usePractice.ts` | Add `useChallenge(id)` hook |
| `client/src/App.tsx` (or router file) | Add `/practice/challenge/:id` route |

---

## 6. Out of Scope

- Multiple language support (Python only)
- Syntax highlighting (plain monospace textarea)
- Saving draft code between sessions
- LeetCode difficulty tag syncing
- Admin UI (routes only, no frontend admin panel)
