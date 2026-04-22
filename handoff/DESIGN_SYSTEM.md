# Mindful Engineer — Design System Reference

This folder is the **source of truth** for visual consistency across the study app.
Any new or edited UI MUST use these tokens. No raw hex values, no ad-hoc pixel sizes.

## Files

- `tokens.css` — all CSS custom properties (color, type, spacing, radius, shadow, motion).
- `components.css` — canonical classes (`.btn`, `.card`, `.input`, `.badge`, `.chip`, `.tabs`, `.row`, `.modal`, `.state`, `.skeleton`, `.icon`).
- `DESIGN_SYSTEM.md` — this document.
- `CLAUDE.md` — instructions for AI assistants editing the codebase.

## Install

```ts
// study-app/client/src/main.tsx
import './styles/tokens.css';       // tokens FIRST
import './styles/components.css';   // canonical components
import './index.css';               // existing app styles (being migrated)
```

Copy `tokens.css` and `components.css` to `study-app/client/src/styles/`.

## The Rules

### 1. Radius — only six values exist

| Token      | Size  | Use                           |
|------------|-------|-------------------------------|
| `--r-xs`   | 6px   | chips, tags, small pills      |
| `--r-sm`   | 10px  | inputs, buttons               |
| `--r-md`   | 14px  | cards, list rows              |
| `--r-lg`   | 20px  | panels, containers            |
| `--r-xl`   | 28px  | hero blocks, modals           |
| `--r-pill` | 999px | toggles, segmented controls   |

**Never** write `border-radius: 8px` / `12px` / `16px` / `18px` / `24px` / `9999px` etc.
If a value isn't one of the six above, round to the nearest token.

### 2. Font size — ten steps, no in-betweens

| Token         | Size  | Use                        |
|---------------|-------|----------------------------|
| `--text-2xs`  | 11px  | uppercase micro-labels     |
| `--text-xs`   | 12px  | captions, meta             |
| `--text-sm`   | 13px  | dense UI, chips, row-sub   |
| `--text-base` | 14px  | body default               |
| `--text-md`   | 16px  | lead body, inputs          |
| `--text-lg`   | 18px  | card titles                |
| `--text-xl`   | 22px  | section heads              |
| `--text-2xl`  | 28px  | page titles                |
| `--text-3xl`  | 36px  | hero                       |
| `--text-4xl`  | 48px  | display                    |

No `0.72rem`, `0.84rem`, `0.9375rem` etc.

### 3. Spacing — 4px grid, eleven steps

`--sp-0` (0) · `--sp-1` (4) · `--sp-2` (8) · `--sp-3` (12) · `--sp-4` (16) · `--sp-5` (20) · `--sp-6` (24) · `--sp-7` (32) · `--sp-8` (40) · `--sp-9` (56) · `--sp-10` (72).

### 4. Elevation — five shadow steps

`--shadow-0` flat · `--shadow-1` hairline · `--shadow-2` resting · `--shadow-3` hovering · `--shadow-4` floating.
Focus rings use `--shadow-focus`.

### 5. Color — named roles only

Never reference hex in component CSS. Use:
- **Surfaces**: `--bg`, `--surface`, `--surface-1/2/3`
- **Ink**: `--ink`, `--ink-strong`, `--ink-muted`, `--ink-faint`
- **Borders**: `--border`, `--border-strong`, `--border-soft`
- **Accent**: `--accent`, `--accent-hover`, `--accent-soft`, `--accent-ink`, `--accent-deep` (darker than accent — gradient bottoms, emphasis), `--accent-glow` (lighter than accent — gradient tops, progress highlights)
- **Semantic**: `--success`, `--warning`, `--danger`, `--info` (each has matching `-bg`)
- **Tracks**: `--track-dsa`, `--track-sys`, `--track-ml`, `--track-resume`

Dark mode is driven by `html[data-theme="dark"]` — tokens flip automatically.

### 6. Motion

- `--dur-1` (120ms) hover/press
- `--dur-2` (200ms) toggle/focus
- `--dur-3` (320ms) modal/page

Use `--ease-out` for enters, `--ease-in-out` for reversible changes.

## Component classes

Prefer a canonical class over bespoke CSS:

| Class            | Purpose                                  |
|------------------|------------------------------------------|
| `.btn` + `.btn-primary / -secondary / -ghost / -danger` + `.btn-sm / -lg` | Buttons |
| `.btn-icon`      | 36px square icon-only button             |
| `.card` / `.card-lg` / `.card-subtle` / `.card-flat` / `.card-elevated` | Card surface |
| `.card-title` / `.card-meta` | Card typography                  |
| `.field` + `.field-label` + `.field-hint` | Form field wrapper     |
| `.input` / `.select` / `.textarea` | Form controls (one shape)      |
| `.check` (+ inner `.box`) | Checkbox                              |
| `.toggle` (+ `.on`) | Binary toggle                              |
| `.badge` + `.badge-accent / -success / -warning / -danger / -info` | Pill status |
| `.chip` (+ `.active`) | Selectable filter pill               |
| `.row` + `.row-title` + `.row-sub` | Standard list row              |
| `.progress` (wrap with inner `<div>` width %) | Progress bar       |
| `.tabs` + `.tab` (+ `.active`) | Segmented tab group             |
| `.modal` + `.modal-scrim` + `.modal-title` + `.modal-body` + `.modal-actions` | Dialog |
| `.state` + `.state-icon` + `.state-title` + `.state-sub` | Empty/error state |
| `.skeleton`      | Loading placeholder                      |
| `.icon` / `.icon-sm` / `.icon-lg` | SVG icon sizing                |

## Migration strategy

The existing `index.css` has ~10,000 lines with drift accumulated over time.
**Do not rewrite all at once.** Migrate incrementally:

1. Add tokens + components CSS imports (Install section above).
2. When touching any component file, replace its raw values with tokens:
   - any `border-radius: X` → nearest `--r-*`
   - any `font-size: X` → nearest `--text-*`
   - any `padding/margin/gap: X` → nearest `--sp-*`
   - any `box-shadow: X` → nearest `--shadow-*`
   - any hex color → a named role
3. Prefer deleting bespoke CSS in favor of the canonical classes.
4. Treat any file you've migrated as locked to the system — no new raw values.

The full visual reference lives at `Design System.html` in the project root —
open it to see every token and component rendered in light and dark.
