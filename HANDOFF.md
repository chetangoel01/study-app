# Pipeline Coverage Handoff — 2026-04-01

## Update: resolved later on 2026-04-01

- Coverage is now `64/64` ontology topics.
- `greedy-algorithms` is covered by a distinct synthesized `Greedy Algorithm` topic sourced from Programiz.
- `divide-and-conquer` is covered after aligning planner behavior with the documented rule that any exact primary label/alias match with score `>= 8` counts as coverage.
- The planner now keeps multiple strong primary matches instead of discarding secondary exact matches.
- `knowledge-base.json` and `crawl-audit.json` were regenerated after the fix.

## Current State: 62/64 ontology topics covered

### Uncovered nodes (2 remaining)
- `divide-and-conquer` — label "Divide and Conquer"
  - aliases: `["Divide and Conquer Algorithms", "Divide and Conquer Algorithm", "Divide and Conquer Sorting for Linked Lists"]`
- `greedy-algorithms` — label "Greedy Algorithms"
  - aliases: check `pipeline/curriculum_ontology.py` for current list

### Recent progress
- Started at 35/64 → reached 63/64 → regressed to 62/64 → fixed GFG hub regression → still at 62/64
- `backtracking` is now **covered** (was uncovered in previous session due to GFG regression)
- The GFG greedy category page (`/greedy-algorithms/`) was removed; it was causing site-crawl noise that merged "Backtracking" and "Divide and Conquer" into a generic "Algorithm" cluster

---

## Root Cause of Remaining 2 Uncovered Nodes

### Why `greedy-algorithms` is uncovered
- Wikipedia greedy article (`https://en.wikipedia.org/wiki/Greedy_algorithm`) IS cached and scraped
- But its content got absorbed into another synthesized topic (not labeled "Greedy Algorithms" or any matching alias)
- No synthesized topic currently has "Greedy" in its label or aliases
- The 121 synthesized topic labels visible in `knowledge-base.json` do NOT include any greedy-related label

### Why `divide-and-conquer` is uncovered
- Wikipedia D&C article (`https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm`) IS cached and scraped
- Its content got absorbed — likely into the "Recursion" topic (which has alias "Divide and Conquer (Recursive)" but that doesn't exact-match the ontology node's aliases)
- No synthesized topic currently has a label/alias matching "Divide and Conquer", "Divide and Conquer Algorithms", or "Divide and Conquer Algorithm"

---

## Key Architecture Reminders

### How planning graph coverage works
- Coverage = a synthesized topic's **label** (weight 10) or **alias** (weight 8) must exactly match (after normalization) an ontology node's label or alias
- Evidence terms (concepts, prerequisites, connections — weight 3) almost never reach the ≥8 threshold required for primary coverage
- String matching is purely lexical (normalized: lowercase, stripped) — NOT embedding similarity

### Pipeline matching code
- `pipeline/planning_graph.py` → `resolve_reference_label()` and `_primary_weighted_terms()`
- A synthesized topic covers an ontology node if its primary score (label=10, alias=8) ≥ 8 for that node

### What the synthesized topic labels look like
From the last run — relevant labels:
```
Backtracking         ✓ covers backtracking
Dynamic Programming  ✓ covers dynamic-programming
Recursion            ✓ covers recursion  (has alias "Divide and Conquer (Recursive)" — doesn't match D&C node)
Sorting Algorithms   ✓ covers sorting-algorithms
Algorithm Design Canvas  — does NOT cover algorithms node
```
No greedy-related topic exists in the 121 synthesized topics.

---

## Options to Fix the Remaining 2

### Option A: Add more/stronger article sources for greedy and D&C
The Wikipedia articles' content is getting absorbed into larger clusters. Need sources whose content, when synthesized, produces a topic labeled exactly "Greedy Algorithms" / "Greedy Algorithm" or "Divide and Conquer".

**Candidate sources:**
- FreeCodeCamp greedy: `https://www.freecodecamp.org/news/greedy-algorithms/` (if it exists — verify first)
- GFG single-article greedy (NOT the category hub): e.g., `https://www.geeksforgeeks.org/activity-selection-problem-greedy-algo-1/` — but this is a single problem, not a general greedy overview
- Wikipedia: `https://en.wikipedia.org/wiki/Greedy_algorithm` (already in use, absorbed)
- For D&C: the Wikipedia article is already there; may need a second reinforcing source

### Option B: Add ontology aliases that match what IS being synthesized
Check what synthesized topics exist and add ontology aliases that match them.

**Steps:**
1. Run: `python3 -c "import json; kb=json.load(open('knowledge-base.json')); [print(t['label'], '|', t.get('aliases',[])) for t in kb['topics']]"`
2. Find any topic whose label/alias could logically represent greedy or D&C
3. Add that label as an alias to the `greedy-algorithms` or `divide-and-conquer` node in `pipeline/curriculum_ontology.py`

Example: If "Algorithm Design Canvas" has an alias "Greedy Strategy", then add "Algorithm Design Canvas" or "Greedy Strategy" to the `greedy-algorithms` aliases.

**This is the faster/safer approach** — avoids re-scraping, uses existing synthesized topics.

### Option C: Combination — new sources + alias reinforcement
1. Add a focused FreeCodeCamp or programiz.com article for greedy
2. Add a focused article for D&C (e.g., `https://www.programiz.com/dsa/divide-and-conquer`)
3. Also add aliases to ontology to catch any near-miss synthesized topics

---

## Files to Modify

| File | What to change |
|------|---------------|
| `build_study_data.py` | Add new resource URLs to `supplemental-dsa-references` PIPELINE_ONLY_MODULES |
| `pipeline/curriculum_ontology.py` | Add aliases to `greedy-algorithms` and/or `divide-and-conquer` nodes |
| `tests/test_pipeline_sources.py` | Update the hardcoded URL set in `test_pipeline_only_sources_include_user_repositories` to match any added URLs |

---

## How to Run

```bash
# From study-app/
source .venv/bin/activate
python pipeline/runner.py

# Check coverage result:
python3 -c "
import json
kb = json.load(open('knowledge-base.json'))
pm = kb['planning_mappings']
pt = kb['planning_topics']
covered = set(pid for m in pm for pid in m.get('planning_topic_ids', []))
uncovered = [t for t in pt if t['id'].replace('planning:', '') not in covered]
print(f'Covered: {len(covered)}/{len(pt)}')
for t in uncovered:
    print(f'  UNCOVERED: {t[\"id\"]} — {t[\"label\"]}')
"

# Run tests:
python3 -m pytest tests/ -q
```

## How to inspect synthesized topics
```bash
source .venv/bin/activate
python3 -c "
import json
kb = json.load(open('knowledge-base.json'))
for t in sorted(kb['topics'], key=lambda x: x['label']):
    print(t['label'], '|', t.get('aliases', [])[:3])
"
```

## Current test count
46 tests all passing as of this handoff.

---

## URLs currently in use (supplemental-dsa-references)
```
https://en.wikipedia.org/wiki/Array_(data_structure)
https://en.wikipedia.org/wiki/Hash_table
https://en.wikipedia.org/wiki/Tree_(data_structure)
https://en.wikipedia.org/wiki/Heap_(data_structure)
https://en.wikipedia.org/wiki/Graph_traversal
https://en.wikipedia.org/wiki/Dynamic_programming
https://en.wikipedia.org/wiki/Greedy_algorithm
https://en.wikipedia.org/wiki/Divide-and-conquer_algorithm
https://en.wikipedia.org/wiki/Object-oriented_programming
https://en.wikipedia.org/wiki/Object-oriented_design
https://www.geeksforgeeks.org/recursion/
https://en.wikipedia.org/wiki/Backtracking
https://www.freecodecamp.org/news/sorting-algorithms-explained/
https://www.freecodecamp.org/news/demystifying-dynamic-programming-3efafb8d4296/
```
