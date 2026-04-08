import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';

const MAX_CHARS = 50_000;

export function makeNotesRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/:moduleId', (c) => {
    const row = db
      .prepare('SELECT content, updated_at FROM notes WHERE user_id = ? AND module_id = ?')
      .get(c.get('user').id, c.req.param('moduleId')) as { content: string; updated_at: string } | undefined;
    return c.json({ content: row?.content ?? '', updated_at: row?.updated_at ?? null });
  });

  router.put('/:moduleId', async (c) => {
    const { content } = await c.req.json<{ content: string }>();
    if (typeof content !== 'string') return c.json({ error: 'content must be a string' }, 400);
    if (content.length > MAX_CHARS) return c.json({ error: 'Content too large' }, 413);
    db.prepare(
      `INSERT INTO notes (user_id, module_id, content, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, module_id)
       DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
    ).run(c.get('user').id, c.req.param('moduleId'), content);
    return c.json({ saved: true });
  });

  return router;
}
