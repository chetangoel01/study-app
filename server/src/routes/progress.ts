import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import type { CurriculumIndex } from '../curriculum/types.js';

export function makeProgressRouter(db: Database.Database, index: CurriculumIndex): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/', (c) => {
    const rows = db
      .prepare('SELECT module_id, item_id, item_type, completed, updated_at FROM progress WHERE user_id = ?')
      .all(c.get('user').id);
    return c.json(rows);
  });

  router.put('/:moduleId/:itemId', (c) => {
    const userId = c.get('user').id;
    const { moduleId, itemId } = c.req.param();
    const module = index.moduleById.get(moduleId);
    const item = module?.items.find((i) => i.id === itemId);
    const itemType = item?.type ?? c.req.query('itemType') ?? 'do';

    const existing = db
      .prepare('SELECT completed FROM progress WHERE user_id = ? AND module_id = ? AND item_id = ?')
      .get(userId, moduleId, itemId) as { completed: number } | undefined;

    if (existing) {
      const next = existing.completed ? 0 : 1;
      db.prepare(
        "UPDATE progress SET completed = ?, updated_at = datetime('now') WHERE user_id = ? AND module_id = ? AND item_id = ?"
      ).run(next, userId, moduleId, itemId);
      return c.json({ moduleId, itemId, completed: next === 1 });
    }

    db.prepare(
      "INSERT INTO progress (user_id, module_id, item_id, item_type, completed, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'))"
    ).run(userId, moduleId, itemId, itemType);
    return c.json({ moduleId, itemId, completed: true });
  });

  return router;
}
