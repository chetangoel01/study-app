# TrackPage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six issues on the TrackPage — broken sequential locking, card overflow past the timeline spine, inconsistent header gradient, redundant progress bar, heavy typography, and duplicated CSS blocks.

**Architecture:** Server locking logic changes first (isolated), then CSS-only passes (layout, header, typography), then JSX structural changes last. This order ensures class names are stable when JSX is updated.

**Tech Stack:** Hono (server), Vitest (testing), React + Vite (client), plain CSS (no CSS modules or Tailwind)

---

## File Map

| File | What changes |
|---|---|
| `server/src/routes/curriculum.ts` | Replace semantic `prerequisiteModuleIds` blocker logic with sequential track-order locking |
| `server/src/routes/curriculum.test.ts` | Replace prereq-behavior tests with sequential-locking tests |
| `client/src/index.css` | Timeline grid, header background, remove progress bar CSS, typography weights, remove `-stitch` class duplicates |
| `client/src/pages/TrackPage.tsx` | Flatten header JSX, remove progress bar element, rename `-stitch` class references |

---

## Task 1: Sequential Locking Logic (Server)

**Files:**
- Modify: `server/src/routes/curriculum.ts`
- Modify: `server/src/routes/curriculum.test.ts`

### Background

Currently `blockedBy` is computed from `m.prerequisiteModuleIds`, which comes from the semantic enrichment pipeline and contains circular dependencies. The first module in a track ends up locked while later modules with no semantic prereqs are freely accessible.

The new rule: within each track, module at position N is locked if the nearest previous module with items (position < N) is not yet `done`. Zero-item modules are never blocked and never act as blockers.

`done` means: `completedItems === totalItems && totalItems > 0`.

- [ ] **Step 1: Write failing tests for sequential locking**

Open `server/src/routes/curriculum.test.ts`. Delete the entire `describe('computeStatus with prerequisites', ...)` block (lines ~89–186) and replace it with the following:

```typescript
describe('sequential locking', () => {
  const seqDir = resolve(tmpdir(), 'study-curriculum-seq-test');
  mkdirSync(seqDir, { recursive: true });

  const SEQ_CURRICULUM = {
    version: 1, generated_at: '2026-01-01T00:00:00Z',
    tracks: [{ id: 'dsa-leetcode', label: 'DSA & LeetCode' }],
    modules: [
      {
        id: 'mod-a', title: 'Module A', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'A', estimate: '1 session', sessions: 1,
        countsTowardSchedule: true, sourceUrl: 'https://x.com',
        items: [{ id: 'mod-a:read:0', type: 'read', label: 'Read A', url: 'https://x.com' }],
        prerequisiteModuleIds: [],
      },
      {
        id: 'zero-item-mod', title: 'Zero Items', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'Z', estimate: '0 sessions', sessions: 0,
        countsTowardSchedule: false, sourceUrl: 'https://x.com',
        items: [],
        prerequisiteModuleIds: [],
      },
      {
        id: 'mod-b', title: 'Module B', track: 'dsa-leetcode', phase: 'Core Track',
        summary: 'B', estimate: '1 session', sessions: 1,
        countsTowardSchedule: true, sourceUrl: 'https://x.com',
        items: [{ id: 'mod-b:read:0', type: 'read', label: 'Read B', url: 'https://x.com' }],
        prerequisiteModuleIds: [],
      },
    ],
  };

  writeFileSync(resolve(seqDir, 'curriculum.json'), JSON.stringify(SEQ_CURRICULUM));
  writeFileSync(resolve(seqDir, 'kb.json'), JSON.stringify({ version: '3', planning_topics: [] }));

  const seqIndex = loadCurriculum({
    curriculumPath: resolve(seqDir, 'curriculum.json'),
    knowledgeBasePath: resolve(seqDir, 'kb.json'),
  });

  let db3: Database.Database;
  let app3: Hono;
  let cookie3: string;

  beforeEach(async () => {
    db3 = new Database(':memory:');
    applySchema(db3);
    app3 = new Hono();
    app3.route('/api/auth', makeAuthRouter(db3));
    app3.route('/api', makeCurriculumRouter(db3, seqIndex));

    await app3.request('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seq@x.com', password: 'password123' }),
    });
    const res = await app3.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seq@x.com', password: 'password123' }),
    });
    const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
    cookie3 = match ? `access_token=${match[1]}` : '';
  });
  afterEach(() => db3.close());

  it('first module in track is always unlocked (blockedBy is empty)', async () => {
    const res = await app3.request('/api/curriculum', { headers: { Cookie: cookie3 } });
    const body = await res.json() as { modules: { id: string; blockedBy: string[] }[] };
    const modA = body.modules.find((m) => m.id === 'mod-a')!;
    expect(modA.blockedBy).toEqual([]);
  });

  it('second substantive module is blocked by the first when first is not done', async () => {
    const res = await app3.request('/api/curriculum', { headers: { Cookie: cookie3 } });
    const body = await res.json() as { modules: { id: string; blockedBy: string[] }[] };
    const modB = body.modules.find((m) => m.id === 'mod-b')!;
    expect(modB.blockedBy).toEqual(['mod-a']);
  });

  it('module unlocks (empty blockedBy) when its predecessor is completed', async () => {
    const { id: userId } = db3.prepare('SELECT id FROM users WHERE email = ?').get('seq@x.com') as { id: number };
    db3.prepare('INSERT INTO progress (user_id, module_id, item_id, item_type, completed) VALUES (?, ?, ?, ?, 1)')
      .run(userId, 'mod-a', 'mod-a:read:0', 'read');

    const res = await app3.request('/api/curriculum', { headers: { Cookie: cookie3 } });
    const body = await res.json() as { modules: { id: string; blockedBy: string[] }[] };
    const modB = body.modules.find((m) => m.id === 'mod-b')!;
    expect(modB.blockedBy).toEqual([]);
  });

  it('zero-item modules are never blocked and never act as blockers', async () => {
    const res = await app3.request('/api/curriculum', { headers: { Cookie: cookie3 } });
    const body = await res.json() as { modules: { id: string; blockedBy: string[] }[] };
    const zeroMod = body.modules.find((m) => m.id === 'zero-item-mod')!;
    const modB = body.modules.find((m) => m.id === 'mod-b')!;
    // zero-item-mod is not blocked
    expect(zeroMod.blockedBy).toEqual([]);
    // mod-b is blocked by mod-a (the last substantive module before it), not zero-item-mod
    expect(modB.blockedBy).toEqual(['mod-a']);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /path/to/study-app && npm run test:server
```

Expected: 4 new tests FAIL with something like "expected ['mod-a'] to equal []" or similar, because the old logic uses `prerequisiteModuleIds` which is `[]` for all modules in SEQ_CURRICULUM.

- [ ] **Step 3: Implement sequential locking in curriculum.ts**

Replace the body of the `router.get('/curriculum', ...)` handler in `server/src/routes/curriculum.ts` with:

```typescript
router.get('/curriculum', (c) => {
  const userId = c.get('user').id;
  const rows = db
    .prepare('SELECT module_id, item_id, updated_at FROM progress WHERE user_id = ? AND completed = 1')
    .all(userId) as { module_id: string; item_id: string; updated_at: string }[];

  const completedByModule = new Map<string, Set<string>>();
  const latestUpdatedAt = new Map<string, string>();
  for (const r of rows) {
    const s = completedByModule.get(r.module_id) ?? new Set();
    s.add(r.item_id);
    completedByModule.set(r.module_id, s);
    const cur = latestUpdatedAt.get(r.module_id);
    if (!cur || r.updated_at > cur) latestUpdatedAt.set(r.module_id, r.updated_at);
  }

  const totalByModule = new Map(index.modules.map((m) => [m.id, m.items.length]));

  // Build sequential blocker map: for each substantive module (items > 0),
  // its blocker is the nearest previous substantive module in the same track.
  // Zero-item modules are skipped both as blockers and as blockees.
  const sequentialBlocker = new Map<string, string>();
  const trackLastSubstantial = new Map<string, string>();
  for (const m of index.modules) {
    const total = totalByModule.get(m.id) ?? 0;
    if (total === 0) continue; // skip zero-item modules entirely
    const prev = trackLastSubstantial.get(m.track);
    if (prev !== undefined) {
      sequentialBlocker.set(m.id, prev);
    }
    trackLastSubstantial.set(m.track, m.id);
  }

  const isDone = (moduleId: string): boolean => {
    const completed = (completedByModule.get(moduleId) ?? new Set()).size;
    const total = totalByModule.get(moduleId) ?? 0;
    return total > 0 && completed >= total;
  };

  const modules = index.modules.map((m) => {
    const status = computeStatus(m.id, completedByModule, totalByModule);
    const blockerId = sequentialBlocker.get(m.id);
    const blockedBy = blockerId && !isDone(blockerId) ? [blockerId] : [];
    return {
      id: m.id, title: m.title, track: m.track, phase: m.phase,
      summary: m.summary, estimate: m.estimate, sessions: m.sessions,
      countsTowardSchedule: m.countsTowardSchedule, sourceUrl: m.sourceUrl,
      prerequisiteModuleIds: m.prerequisiteModuleIds,
      items: m.items,
      totalItems: m.items.length,
      completedItems: (completedByModule.get(m.id) ?? new Set()).size,
      status,
      blockedBy,
      latest_progress_updated_at: latestUpdatedAt.get(m.id) ?? null,
    };
  });

  return c.json({ tracks: index.tracks, modules });
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /path/to/study-app && npm run test:server
```

Expected: All tests PASS, including the 4 new sequential locking tests and the pre-existing `GET /api/curriculum` and `GET /api/module/:id/content` tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/curriculum.ts server/src/routes/curriculum.test.ts
git commit -m "fix: replace semantic prereq locking with sequential track-order locking"
```

---

## Task 2: CSS — Timeline Grid Layout Fix

**Files:**
- Modify: `client/src/index.css`

### Background

Cards overflow the timeline spine because `.timeline-card` has `max-width: 430px` inside grid cells that lack `min-width: 0`. The spine column is `auto`-width, which becomes unstable as card content varies. Fix: give the spine a fixed `56px` column, use `min-width: 0` on cards, let the grid control card width.

The existing mobile breakpoint at `@media (max-width: 768px)` already collapses the timeline to a single left-spine layout — that behavior is correct and stays. We only change the desktop grid.

- [ ] **Step 1: Fix `.timeline-row` grid columns**

In `client/src/index.css`, find the `.timeline-row` rule (around line 3383) and change `grid-template-columns`:

```css
/* BEFORE */
.timeline-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  min-height: 0;
  gap: clamp(1rem, 4vw, 3rem);
}

/* AFTER */
.timeline-row {
  display: grid;
  grid-template-columns: 1fr 56px 1fr;
  align-items: start;
  min-height: 0;
  gap: clamp(1rem, 4vw, 3rem);
}
```

- [ ] **Step 2: Fix card overflow — remove max-width, add min-width**

Find the `.timeline-card` rule (around line 3417) and update:

```css
/* BEFORE */
.timeline-card {
  display: block;
  width: 100%;
  max-width: 430px;
  padding: 24px;
  ...
}

/* AFTER */
.timeline-card {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 24px;
  ...
}
```

Remove `max-width: 430px`. Add `min-width: 0`. Keep all other properties unchanged.

- [ ] **Step 3: Change card grid placement to `justify-self: stretch`**

Find `.timeline-row-left .timeline-card` (around line 3391) and `.timeline-row-right .timeline-card` (around line 3412) and update `justify-self`:

```css
/* BEFORE */
.timeline-row-left .timeline-card {
  grid-column: 1;
  justify-self: end;
}

/* AFTER */
.timeline-row-left .timeline-card {
  grid-column: 1;
  justify-self: stretch;
}

/* BEFORE */
.timeline-row-right .timeline-card {
  grid-column: 3;
  justify-self: start;
}

/* AFTER */
.timeline-row-right .timeline-card {
  grid-column: 3;
  justify-self: stretch;
}
```

- [ ] **Step 4: Remove `max-width: none` override in 768px breakpoint**

Find the `@media (max-width: 768px)` block (around line 5487) that overrides `.timeline-card`:

```css
/* BEFORE */
.timeline-card {
  max-width: none;
  padding: 18px;
}

/* AFTER */
.timeline-card {
  padding: 18px;
}
```

Remove the `max-width: none` line since `max-width` no longer exists on `.timeline-card`.

- [ ] **Step 5: Verify tests still pass**

```bash
cd /path/to/study-app && npm run test:client
```

Expected: All existing TrackPage tests PASS (they don't test CSS layout).

- [ ] **Step 6: Commit**

```bash
git add client/src/index.css
git commit -m "fix: constrain timeline cards to grid columns, eliminate spine overflow"
```

---

## Task 3: CSS + JSX — Header Refactor, Remove Progress Bar, Rename Stitch Classes

**Files:**
- Modify: `client/src/pages/TrackPage.tsx`
- Modify: `client/src/index.css`

### Background

The `track-overview-shell` has a radial gradient inconsistent with the rest of the app. The JSX nests three levels deep (`track-overview-shell → track-page-header-stitch → track-page-header-main`). The progress bar (`track-hero-progress-block`) duplicates info already shown in the pill. Classes with `-stitch` suffix are renamed to canonical names.

**New JSX structure:**
```
<section className="track-overview-shell">
  <div className="track-overview-inner">
    <div className="track-overview-text">
      <p className="track-page-eyebrow">Track roadmap</p>
      <h1 className="track-page-title">{track.label}</h1>
      <p className="track-meta">{TRACK_BLURBS[track.id]}</p>
    </div>
    <div className="track-summary-pill">...</div>
  </div>
</section>
```

**Removed from JSX:** The entire `<div className="track-hero-progress-block">` section.

- [ ] **Step 1: Update TrackPage.tsx — replace header JSX**

In `client/src/pages/TrackPage.tsx`, replace the entire `<section className="track-overview-shell">` block with:

```tsx
<section className="track-overview-shell">
  <div className="track-overview-inner">
    <div className="track-overview-text">
      <p className="track-page-eyebrow">Track roadmap</p>
      <h1 className="track-page-title">
        {track.label}
      </h1>
      <p className="track-meta">{TRACK_BLURBS[track.id]}</p>
    </div>
    <div className="track-summary-pill">
      <div className="track-summary-cell">
        <span className="track-summary-val">{done}/{modules.length}</span>
        <span className="track-summary-lbl">Modules done</span>
      </div>
      <div className="track-summary-divider" aria-hidden="true" />
      <div className="track-summary-cell">
        <span className="track-summary-val">{pct}%</span>
        <span className="track-summary-lbl">Progress</span>
      </div>
    </div>
  </div>
</section>
```

Also remove the `remainingCount` variable from the component since it was only used by the progress bar:
```tsx
// Remove this line:
const remainingCount = Math.max(modules.length - done, 0);
```

- [ ] **Step 2: Update `.track-overview-shell` CSS — frosted tile background**

Find `.track-overview-shell` (around line 3586) and replace its `background` property:

```css
/* BEFORE */
.track-overview-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.1rem, 2.5vw, 1.5rem);
  border-radius: var(--radius-xl);
  border: 1px solid var(--ghost-border);
  background:
    radial-gradient(circle at top right, rgba(79, 93, 140, 0.15), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(245, 243, 240, 0.96));
  box-shadow: var(--shadow-soft);
}

/* AFTER */
.track-overview-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(1.1rem, 2.5vw, 1.5rem);
  border-radius: var(--radius-xl);
  border: 1px solid var(--ghost-border);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-soft);
}
```

- [ ] **Step 3: Update dark mode for `.track-overview-shell`**

Find `html[data-theme="dark"] .track-overview-shell` (around line 3599) and replace:

```css
/* BEFORE */
html[data-theme="dark"] .track-overview-shell {
  background:
    radial-gradient(circle at top right, rgba(120, 137, 198, 0.18), transparent 36%),
    linear-gradient(180deg, rgba(17, 23, 38, 0.9), rgba(12, 18, 32, 0.98));
}

/* AFTER */
html[data-theme="dark"] .track-overview-shell {
  background: rgba(19, 26, 43, 0.72);
  backdrop-filter: blur(12px);
}
```

- [ ] **Step 4: Add new inner layout classes**

After the `.track-overview-shell` rule block, add two new rules:

```css
.track-overview-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem 1.25rem;
}

.track-overview-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
```

- [ ] **Step 5: Add canonical `.track-page-title` and `.track-meta` rules**

After the `.track-page-eyebrow` rule, add:

```css
.track-page-title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 3.3vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.02;
  margin-top: 0;
  color: var(--text);
}

.track-meta {
  max-width: 44rem;
  font-size: 1rem;
  line-height: 1.65;
  font-weight: 400;
  color: var(--muted-strong);
}
```

- [ ] **Step 6: Remove progress bar CSS classes**

Delete the following CSS rules entirely from `client/src/index.css`:
- `.track-hero-progress-block` (around line 3613)
- `.track-hero-progress-labels` (around line 3619)
- `.track-hero-progress-wide` (around line 5297)
- `.track-hero-progress-wide-fill` (around line 5305)

Also remove the `@media (max-width: 768px)` override for `.track-hero-progress-labels` (around line 5473).

- [ ] **Step 7: Remove stitch-suffix CSS classes that are now replaced**

Delete the following CSS rules from the stitch block (around line 5219):
- `.track-page-header-stitch` — replaced by `.track-overview-inner`
- `.track-page-title-stitch` — replaced by `.track-page-title`
- `.track-meta-stitch` — replaced by `.track-meta`

Also remove the `@media (max-width: 900px)` override for `.track-page-header-stitch` (around line 5458).

The remaining stitch-block rules (`.track-summary-pill`, `.track-summary-cell`, `.track-summary-val`, `.track-summary-lbl`, `.track-summary-divider`) are unchanged canonical classes — they can stay where they are or be moved up next to the `track-overview-shell` rules. Either is fine.

- [ ] **Step 8: Update 768px breakpoint for the header**

Find the `@media (max-width: 768px)` block that targets `.track-overview-shell`. Update the inner layout to stack vertically:

```css
@media (max-width: 768px) {
  .track-overview-shell {
    padding: 0.95rem;
  }

  .track-overview-inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .track-summary-pill {
    width: 100%;
    justify-content: flex-start;
  }
}
```

Remove the existing `.track-page-header-stitch` override from this breakpoint (it's being deleted).

- [ ] **Step 9: Verify tests still pass**

```bash
cd /path/to/study-app && npm run test:client
```

Expected: All 4 TrackPage tests PASS. The tests don't check for the progress bar or the old header structure.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/TrackPage.tsx client/src/index.css
git commit -m "refactor: flatten track header, swap frosted tile background, remove progress bar"
```

---

## Task 4: CSS — Typography Weight Reduction

**Files:**
- Modify: `client/src/index.css`

### Background

`font-weight: 700` is the default across most timeline and header classes. The goal is to reduce weight everywhere except where it carries semantic meaning: primary numeric values in the pill, the track title h1, and node step numbers.

- [ ] **Step 1: Reduce card title weight**

Find `.timeline-card-title` (around line 3494):

```css
/* BEFORE */
.timeline-card-title {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.2rem, 2vw, 1.5rem);
  line-height: 1.2;
  font-weight: 700;
  color: var(--text);
}

/* AFTER */
.timeline-card-title {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.2rem, 2vw, 1.5rem);
  line-height: 1.2;
  font-weight: 600;
  color: var(--text);
}
```

- [ ] **Step 2: Reduce status chip weight and remove uppercase treatment**

Find `.timeline-card .status-chip` (around line 3454):

```css
/* BEFORE */
.timeline-card .status-chip {
  min-height: 24px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* AFTER */
.timeline-card .status-chip {
  min-height: 24px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}
```

- [ ] **Step 3: Reduce eyebrow label weight**

Find `.track-page-eyebrow` (around line 3605):

```css
/* BEFORE */
.track-page-eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-strong);
}

/* AFTER */
.track-page-eyebrow {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-strong);
}
```

- [ ] **Step 4: Reduce pill label weight**

Find `.track-summary-lbl` (around line 5280):

```css
/* BEFORE */
.track-summary-lbl {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

/* AFTER */
.track-summary-lbl {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.72rem;
  font-weight: 400;
  line-height: 16px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
```

- [ ] **Step 5: Reduce CTA button weight**

Find `.timeline-cta` (around line 3518):

```css
/* BEFORE */
.timeline-cta {
  ...
  font-weight: 700;
  ...
}

/* AFTER */
.timeline-cta {
  ...
  font-weight: 500;
  ...
}
```

Change only `font-weight`. Keep all other properties unchanged.

- [ ] **Step 6: Run all tests**

```bash
cd /path/to/study-app && npm test
```

Expected: All server and client tests PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/index.css
git commit -m "style: reduce font-weight on timeline cards, status chips, and header labels"
```

---

## Verification Checklist

After all tasks are complete, manually verify in the browser:

- [ ] Module 1 in any track is always unlocked and shows "Start module"
- [ ] Module 2 shows as locked (with "Finish recommended modules first") until module 1 is done
- [ ] Cards do not overflow or bleed past the center spine line at any window width
- [ ] Spine numbers align with the top of their corresponding card
- [ ] Header card shows frosted tile (translucent white/dark), no gradient
- [ ] No progress bar visible below the header
- [ ] Status chips show mixed-case text (no ALL CAPS)
- [ ] Card titles feel lighter than before
- [ ] Timeline collapses to single column on mobile (< 768px) with spine on left
