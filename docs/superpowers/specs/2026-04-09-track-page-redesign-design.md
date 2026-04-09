# TrackPage Redesign — Design Spec
**Date:** 2026-04-09

## Summary

Fix six interconnected issues on the TrackPage: broken module locking logic, timeline card overflow, misaligned spine nodes, inconsistent header gradient, redundant progress indicators, and heavy typography throughout.

## Scope

- `server/src/routes/curriculum.ts` — locking logic
- `client/src/pages/TrackPage.tsx` — JSX structure (header flattening)
- `client/src/index.css` — timeline layout, header style, typography weights

All changes are within the track page. No other pages are affected.

---

## 1. Module Locking Logic

**Problem:** `prerequisiteModuleIds` comes from the semantic enrichment pipeline and contains circular dependencies (e.g. `setup-habits` is blocked by `big-o`, which is blocked by `setup-habits`). This causes module 1 to be locked while later modules like `trees-heaps` (which has no prereqs) are freely accessible.

**Fix:** Replace the `prerequisiteModuleIds`-based `blockedBy` computation in `server/src/routes/curriculum.ts` with a simple sequential rule:

- Sort modules by their order within the track (their array index in `index.modules` filtered by track).
- Module at index 0 is always unlocked (`blockedBy: []`).
- Module at index N is locked if the module at index N−1 is not `done` (`blockedBy: [modules[N-1].id]`).
- A module is `done` when all its items are completed.

The client-side lock rendering in `TrackPage.tsx` requires no changes — it already reads `blockedBy` from the API response.

**Note:** The curriculum data itself will be updated separately to reflect sequential ordering within each track.

---

## 2. Timeline Layout — Node Anchoring

**Problem:** Cards use `width: 100%; max-width: 430px` inside grid cells that lack `min-width: 0`, allowing them to overflow their column and push past the central spine. Nodes float in an independent `auto`-width center column, so their vertical position is decoupled from their card's top edge.

**Fix:**

### Grid structure
Change `.timeline-row` from `grid-template-columns: 1fr auto 1fr` to `grid-template-columns: 1fr 56px 1fr`.

- The spine column is a fixed `56px`, making the center always exactly known.
- Card cells get `min-width: 0` — cards can never escape their column.
- Remove the `max-width: 430px` cap on `.timeline-card`; let `width: 100%` fill the column naturally.
- `align-items: start` on rows so nodes and cards share the same top-of-row baseline.

### Responsive behavior
- **≥ 768px:** Current zigzag layout with the fixes above.
- **480–767px:** Reduce the gap between card columns; cards shrink naturally with the grid.
- **< 480px:** Collapse to single column. Spine column moves to the left edge (`grid-template-columns: 40px 1fr`). All cards render in column 2. Both `timeline-row-left` and `timeline-row-right` cards stack in the same column.

---

## 3. Header Card

**Problem:** `track-overview-shell` uses a radial gradient (`rgba(79, 93, 140, 0.15)`) that is inconsistent with the rest of the app's flat surface language.

**Fix:**

### Background
Replace gradient with frosted tile:
```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(12px);
```
Keep the existing ghost border (`1px solid var(--ghost-border)`) and soft shadow.

### JSX flattening
Current nesting: `track-overview-shell → track-page-header-stitch → track-page-header-main + track-summary-pill`

Collapse to:
```
track-overview-shell
  track-overview-inner   (flex row, space-between, wraps on narrow)
    track-overview-text  (eyebrow + title + blurb)
    track-summary-pill   (unchanged)
```

Remove the entire `track-hero-progress-block` element (progress bar) — see Section 4.

### Dark mode
```css
html[data-theme="dark"] .track-overview-shell {
  background: rgba(19, 26, 43, 0.72);
  backdrop-filter: blur(12px);
}
```

---

## 4. Remove Progress Bar

**Problem:** The page shows three representations of the same information: progress bar, `done/total` count in the pill, and `%` in the pill.

**Fix:** Remove `track-hero-progress-block` from JSX and all associated CSS classes:
- `.track-hero-progress-block`
- `.track-hero-progress-labels`
- `.track-hero-progress-wide`
- `.track-hero-progress-wide-fill`

The `track-summary-pill` (showing `done/total` and `%`) is sufficient.

---

## 5. Typography

**Problem:** `font-weight: 700` is the default across most timeline and header classes, making the page feel dense and unapproachable. The CurriculumPage uses weight more sparingly.

**Fix:** Reduce weights selectively — bold stays only where it carries semantic meaning (numbers, the primary track title).

| Element | Current | New |
|---|---|---|
| Track title (h1) | `700` | `700` — keep, it's the primary identity label |
| Card titles | `700` | `600` |
| Status chip labels | `700` | `500`, remove `text-transform: uppercase`, remove `letter-spacing` |
| Eyebrow label ("Track roadmap") | `700` | `500` |
| Progress pill labels | `700` | `400` |
| CTA button text | `700` | `500` |
| Node numbers | `700` | `700` — keep, numerals need weight at small sizes |
| Pill values (`4/12`, `33%`) | `700` | `700` — keep, same reason |

---

## 6. CSS Consolidation

**Problem:** The timeline and track header have two separate CSS blocks — one at ~line 3361 and a second "stitch" block at ~line 5219 — with overlapping class names. This causes drift and makes it hard to reason about which rule applies.

**Fix:** Merge the two blocks into a single, ordered section. Eliminate all `-stitch` suffix duplicates. Class names that exist only in the stitch block become the canonical class. This is a CSS-only change; JSX class names that referenced `-stitch` variants are updated to match.

---

## Implementation Order

1. Server: sequential locking logic
2. CSS: consolidate duplicate blocks, apply timeline layout fixes, header background, remove progress bar classes, typography weights
3. JSX: flatten header structure, remove progress bar element, update any class names changed during consolidation

---

## Out of Scope

- No changes to ModulePage, CurriculumPage, or any other page
- No changes to the `track-refresher` section at the bottom
- No changes to the enrichment pipeline or `prerequisiteModuleIds` data (those are being handled separately)
