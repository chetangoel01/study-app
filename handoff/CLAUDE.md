# Instructions for Claude Code

This project has a canonical design system. **All UI work must follow it.**

## Before editing any component or CSS

1. Read `DESIGN_SYSTEM.md` in this folder (same directory as this file).
2. Confirm `tokens.css` and `components.css` are imported in `src/main.tsx`:
   ```ts
   import './styles/tokens.css';
   import './styles/components.css';
   import './index.css';
   ```
   If not, add them.

## Hard rules

When writing or editing CSS / JSX / styled-components:

- **Never** use raw hex colors. Use a CSS variable (`--accent`, `--ink-muted`, `--surface-1`, etc.). Full list in `DESIGN_SYSTEM.md`.
- **Never** invent a new `border-radius`. Use one of: `var(--r-xs)` `var(--r-sm)` `var(--r-md)` `var(--r-lg)` `var(--r-xl)` `var(--r-pill)`.
- **Never** invent a new `font-size`. Use `var(--text-2xs)` through `var(--text-4xl)`.
- **Never** write a custom `box-shadow`. Use `var(--shadow-1)` through `var(--shadow-4)` and `var(--shadow-focus)`.
- **Never** hand-pick padding/gap/margin. Use `var(--sp-1)` through `var(--sp-10)`.
- **Never** write a custom transition duration. Use `var(--dur-1)` `var(--dur-2)` `var(--dur-3)` with `var(--ease-out)` or `var(--ease-in-out)`.

## Preferred approach

Before writing bespoke CSS, check if a canonical class exists:

- Button? Use `.btn` + modifier. Don't style a raw `<button>`.
- Card surface? Use `.card` / `.card-lg` / `.card-subtle`.
- Text input / select / textarea? Use `.input` / `.select` / `.textarea` inside a `.field` wrapper.
- Status pill? Use `.badge` + semantic modifier.
- List row? Use `.row` + `.row-title` + `.row-sub`.
- Tabs? Use `.tabs` + `.tab`.
- Modal? Use `.modal` inside `.modal-scrim`.
- Empty / error state? Use `.state` wrapper.
- Loading? Use `.skeleton`.

If a new component is needed and no canonical class fits, add it to `components.css` (not scattered across files) and update `DESIGN_SYSTEM.md`.

## Migration

The existing `src/index.css` is ~10,000 lines of legacy styling with drift. Known problems before the system:
- 20+ distinct `border-radius` values
- ~200 unique `font-size` values mixing `rem` and `px`
- 10+ ad-hoc `box-shadow` declarations

Do NOT rewrite it in one pass. When you touch a component for any reason:
1. Replace that component's raw values with tokens in the same edit.
2. Prefer deleting custom CSS in favor of the canonical classes.
3. After migrating a block, treat it as locked — no new raw values.

## Dark mode

Dark mode is controlled by `html[data-theme="dark"]`. Tokens flip automatically; never write `@media (prefers-color-scheme)` checks. If a component looks wrong in dark mode, fix it by using a token instead of a hex value, not by adding a dark override.

## Reference

The rendered design system lives at `Design System.html` in the project root. Open it to see every token and component in both light and dark.
