# Handoff to Claude Code

Everything in this folder is designed to be dropped into `study-app/` so Claude Code picks it up.

## How to use it (takes 2 minutes)

### 1. Copy the files

From the project root:

```bash
mkdir -p study-app/client/src/styles
cp handoff/tokens.css      study-app/client/src/styles/tokens.css
cp handoff/components.css  study-app/client/src/styles/components.css
cp handoff/DESIGN_SYSTEM.md study-app/DESIGN_SYSTEM.md
cp handoff/CLAUDE.md       study-app/CLAUDE.md   # merge with existing if you already have one
```

### 2. Wire up the imports

Open `study-app/client/src/main.tsx` and add, **before** the existing `index.css` import:

```ts
import './styles/tokens.css';
import './styles/components.css';
import './index.css';
```

### 3. Tell Claude Code

Next time you open Claude Code in the project, start with:

> Read `DESIGN_SYSTEM.md` and `CLAUDE.md`. We're migrating the app to this system incrementally.
> When you touch any component, replace its raw values with the tokens per `CLAUDE.md`.

Claude Code will auto-load `CLAUDE.md` from the project root on every session, so from then on it'll respect the system without reminders.

### 4. First migration task (suggested)

Ask Claude Code:

> Migrate `client/src/components/ModuleCard.tsx` and its styles in `index.css` to use the design system tokens and canonical classes. Show me the diff before applying.

Good candidates to migrate first (most visually impactful, moderate size): `Layout.tsx`, `ModuleCard.tsx`, `ModuleItemList.tsx`, `PracticeSetupModal.tsx`, `AccountMenu.tsx`.

## What's included

- `tokens.css` — canonical design tokens (color, type, spacing, radius, shadow, motion)
- `components.css` — canonical component classes (.btn, .card, .input, .badge, .chip, .row, .tabs, .modal, .state, .skeleton, .icon)
- `DESIGN_SYSTEM.md` — human reference with the rules
- `CLAUDE.md` — AI instruction file (auto-loaded by Claude Code)

The visual reference lives at `Design System.html` at the project root — open anytime to see everything rendered in light and dark.
