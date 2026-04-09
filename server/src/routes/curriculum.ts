import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import type { CurriculumIndex } from '../curriculum/types.js';

type Status = 'done' | 'in-progress' | 'available';

function computeStatus(
  moduleId: string,
  completedByModule: Map<string, Set<string>>,
  totalByModule: Map<string, number>,
  topicCount: number,
  maxGuideStep: number,
  hasGuideRow: boolean,
): Status {
  const completed = completedByModule.get(moduleId) ?? new Set();
  const total = totalByModule.get(moduleId) ?? 0;
  const guideFlowComplete = topicCount > 0 && maxGuideStep >= topicCount;
  const allItemsDone = total > 0 && completed.size === total;

  if (allItemsDone || guideFlowComplete) return 'done';
  // max_step can be 0 for the first section; a row in module_guide_progress still means started.
  const guideStarted = topicCount > 0 && hasGuideRow;
  if (completed.size > 0 || guideStarted) return 'in-progress';
  return 'available';
}

export function makeCurriculumRouter(db: Database.Database, index: CurriculumIndex): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

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

    const guideRows = db
      .prepare('SELECT module_id, max_step FROM module_guide_progress WHERE user_id = ?')
      .all(userId) as { module_id: string; max_step: number }[];
    const maxGuideStepByModule = new Map<string, number>();
    const hasGuideProgressRow = new Set<string>();
    for (const row of guideRows) {
      maxGuideStepByModule.set(row.module_id, row.max_step);
      hasGuideProgressRow.add(row.module_id);
    }

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
      const topicCount = (index.topicsByModule.get(moduleId) ?? []).length;
      const maxGuideStep = maxGuideStepByModule.get(moduleId) ?? 0;
      const guideFlowComplete = topicCount > 0 && maxGuideStep >= topicCount;
      if (guideFlowComplete) return true;
      return total > 0 && completed >= total;
    };

    const modules = index.modules.map((m) => {
      const topicCount = (index.topicsByModule.get(m.id) ?? []).length;
      const maxGuideStep = maxGuideStepByModule.get(m.id) ?? 0;
      const status = computeStatus(
        m.id,
        completedByModule,
        totalByModule,
        topicCount,
        maxGuideStep,
        hasGuideProgressRow.has(m.id),
      );
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

  router.get('/module/:moduleId/content', (c) => {
    const { moduleId } = c.req.param();
    const module = index.moduleById.get(moduleId);
    if (!module) return c.json({ error: 'Module not found' }, 404);

    const topics = (index.topicsByModule.get(moduleId) ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      study_guide_markdown: t.study_guide_markdown ?? '',
    }));

    return c.json({ moduleId, items: module.items, topics });
  });

  return router;
}
