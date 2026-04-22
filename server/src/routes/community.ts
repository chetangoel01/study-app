import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import {
  isValidTag,
  TITLE_MAX,
  THREAD_BODY_MAX,
  REPLY_BODY_MAX,
  displayName,
  totalViewCount,
  recordView,
} from '../lib/community.js';

type UserRow = { id: number; email: string; full_name: string | null };

type ThreadRow = {
  id: string;
  author_id: number;
  title: string;
  body_md: string;
  tag: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  reply_count: number;
  edited_at: string | null;
  deleted_at: string | null;
};

type ReplyRow = {
  id: string;
  thread_id: string;
  author_id: number;
  body_md: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

function shapeReply(db: Database.Database, row: ReplyRow, viewerId: number) {
  if (row.deleted_at) {
    return {
      id: row.id,
      author: null,
      body_md: '[deleted]',
      createdAt: row.created_at,
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
      canEdit: false,
    };
  }
  const author = db
    .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
    .get(row.author_id) as UserRow | undefined;
  return {
    id: row.id,
    author: author
      ? { id: author.id, name: displayName(author), avatarUrl: null }
      : null,
    body_md: row.body_md,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: null,
    canEdit: row.author_id === viewerId,
  };
}

function shapeThread(
  db: Database.Database,
  row: ThreadRow,
  viewerId: number,
  includeBody: boolean,
) {
  const author = row.deleted_at
    ? undefined
    : (db
        .prepare('SELECT id, email, full_name FROM users WHERE id = ?')
        .get(row.author_id) as UserRow | undefined);

  const isSubscribed =
    db
      .prepare('SELECT 1 FROM forum_subscriptions WHERE user_id = ? AND thread_id = ?')
      .get(viewerId, row.id) !== undefined;

  const excerpt = row.deleted_at
    ? ''
    : row.body_md.slice(0, 200).replace(/\s+/g, ' ').trim();

  return {
    id: row.id,
    title: row.deleted_at ? '[deleted thread]' : row.title,
    tag: row.tag,
    author: author
      ? { id: author.id, name: displayName(author), avatarUrl: null }
      : null,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    replyCount: row.reply_count,
    viewCount: totalViewCount(db, row.id),
    isSubscribed,
    excerpt,
    ...(includeBody
      ? { body_md: row.deleted_at ? '' : row.body_md }
      : {}),
  };
}

export function makeCommunityRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  // ---- Create thread ----
  router.post('/threads', async (c) => {
    const user = c.get('user') as { id: number };
    const payload = await c.req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return c.json({ error: 'invalid body' }, 400);
    }
    const { title, body_md, tag } = payload as Record<string, unknown>;
    if (typeof title !== 'string' || typeof body_md !== 'string' || !isValidTag(tag)) {
      return c.json({ error: 'title, body_md, tag required; tag must be a known value' }, 400);
    }
    const titleTrim = title.trim();
    if (titleTrim.length === 0) {
      return c.json({ error: 'title cannot be empty' }, 400);
    }
    if (titleTrim.length > TITLE_MAX) {
      return c.json({ error: `title exceeds ${TITLE_MAX} chars` }, 413);
    }
    if (body_md.length > THREAD_BODY_MAX) {
      return c.json({ error: `body exceeds ${THREAD_BODY_MAX} chars` }, 413);
    }

    const id = randomUUID();
    const insertThread = db.prepare(
      `INSERT INTO forum_threads (id, author_id, title, body_md, tag)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insertSub = db.prepare(
      `INSERT OR IGNORE INTO forum_subscriptions (user_id, thread_id) VALUES (?, ?)`,
    );
    const txn = db.transaction(() => {
      insertThread.run(id, user.id, titleTrim, body_md, tag);
      insertSub.run(user.id, id);
    });
    txn();

    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as ThreadRow;
    return c.json({ thread: shapeThread(db, row, user.id, true) }, 201);
  });

  // ---- Get one thread ----
  router.get('/threads/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);

    if (!row.deleted_at) {
      recordView(db, user.id, id);
    }

    const replyRows = db
      .prepare('SELECT * FROM forum_replies WHERE thread_id = ? ORDER BY created_at ASC, rowid ASC')
      .all(id) as ReplyRow[];

    return c.json({
      thread: shapeThread(db, row, user.id, true),
      replies: replyRows.map((r) => shapeReply(db, r, user.id)),
      canEdit: row.author_id === user.id && !row.deleted_at,
    });
  });

  // ---- Edit thread ----
  router.put('/threads/:id', async (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.deleted_at) return c.json({ error: 'cannot edit deleted thread' }, 409);

    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload) return c.json({ error: 'invalid body' }, 400);

    let title = row.title;
    let body_md = row.body_md;
    let tag = row.tag;

    if (payload.title !== undefined) {
      if (typeof payload.title !== 'string') return c.json({ error: 'title must be a string' }, 400);
      const t = payload.title.trim();
      if (t.length === 0) return c.json({ error: 'title cannot be empty' }, 400);
      if (t.length > TITLE_MAX) return c.json({ error: `title exceeds ${TITLE_MAX} chars` }, 413);
      title = t;
    }
    if (payload.body_md !== undefined) {
      if (typeof payload.body_md !== 'string') return c.json({ error: 'body_md must be a string' }, 400);
      if (payload.body_md.length > THREAD_BODY_MAX) {
        return c.json({ error: `body exceeds ${THREAD_BODY_MAX} chars` }, 413);
      }
      body_md = payload.body_md;
    }
    if (payload.tag !== undefined) {
      if (!isValidTag(payload.tag)) return c.json({ error: 'invalid tag' }, 400);
      tag = payload.tag;
    }

    db.prepare(
      `UPDATE forum_threads
       SET title = ?, body_md = ?, tag = ?,
           updated_at = datetime('now'),
           edited_at = datetime('now')
       WHERE id = ?`,
    ).run(title, body_md, tag, id);

    const updated = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as ThreadRow;
    return c.json({ thread: shapeThread(db, updated, user.id, true) });
  });

  // ---- Delete thread ----
  router.delete('/threads/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);

    const replyCount = (
      db
        .prepare('SELECT COUNT(*) AS n FROM forum_replies WHERE thread_id = ? AND deleted_at IS NULL')
        .get(id) as { n: number }
    ).n;

    if (replyCount === 0) {
      db.prepare('DELETE FROM forum_threads WHERE id = ?').run(id);
      return c.json({ deleted: 'hard' });
    } else {
      db.prepare(
        `UPDATE forum_threads SET deleted_at = datetime('now') WHERE id = ?`,
      ).run(id);
      return c.json({ deleted: 'soft' });
    }
  });

  // ---- Subscribe ----
  router.post('/threads/:id/subscribe', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT 1 FROM forum_threads WHERE id = ?').get(id);
    if (!row) return c.json({ error: 'not found' }, 404);
    db.prepare(
      `INSERT OR IGNORE INTO forum_subscriptions (user_id, thread_id) VALUES (?, ?)`,
    ).run(user.id, id);
    return c.json({ subscribed: true });
  });

  // ---- Unsubscribe ----
  router.delete('/threads/:id/subscribe', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    db.prepare(
      `DELETE FROM forum_subscriptions WHERE user_id = ? AND thread_id = ?`,
    ).run(user.id, id);
    return c.json({ subscribed: false });
  });

  // ---- List threads ----
  router.get('/threads', (c) => {
    const user = c.get('user') as { id: number };
    const filter = c.req.query('filter') ?? 'all';
    const tag = c.req.query('tag');
    const limit = Math.min(Number(c.req.query('limit') ?? 20) || 20, 50);

    const tagOk = tag && isValidTag(tag);

    let rows: ThreadRow[];
    if (filter === 'trending') {
      const sql = `
        SELECT t.*,
          (t.reply_count * 2.0 + COALESCE(v.view_count, 0) * 0.1)
            / (((julianday('now') - julianday(t.last_activity_at)) * 24 + 2) * sqrt((julianday('now') - julianday(t.last_activity_at)) * 24 + 2)) AS score
        FROM forum_threads t
          LEFT JOIN (
            SELECT thread_id, COUNT(*) AS view_count
            FROM forum_thread_views
            GROUP BY thread_id
          ) v ON v.thread_id = t.id
        WHERE t.deleted_at IS NULL
          AND t.last_activity_at > datetime('now', '-7 days')
          ${tagOk ? 'AND t.tag = ?' : ''}
        ORDER BY score DESC
        LIMIT ?`;
      rows = (tagOk
        ? db.prepare(sql).all(tag, limit)
        : db.prepare(sql).all(limit)) as ThreadRow[];
    } else if (filter === 'subscribed') {
      const sql = `
        SELECT t.* FROM forum_threads t
        INNER JOIN forum_subscriptions s ON s.thread_id = t.id AND s.user_id = ?
        WHERE t.deleted_at IS NULL
          ${tagOk ? 'AND t.tag = ?' : ''}
        ORDER BY t.last_activity_at DESC, t.id DESC
        LIMIT ?`;
      rows = (tagOk
        ? db.prepare(sql).all(user.id, tag, limit)
        : db.prepare(sql).all(user.id, limit)) as ThreadRow[];
    } else {
      const sql = `
        SELECT * FROM forum_threads
        WHERE deleted_at IS NULL
          ${tagOk ? 'AND tag = ?' : ''}
        ORDER BY last_activity_at DESC, id DESC
        LIMIT ?`;
      rows = (tagOk
        ? db.prepare(sql).all(tag, limit)
        : db.prepare(sql).all(limit)) as ThreadRow[];
    }

    return c.json({
      threads: rows.map((r) => shapeThread(db, r, user.id, false)),
      nextCursor: null,
    });
  });

  // ---- Create reply ----
  router.post('/threads/:id/replies', async (c) => {
    const user = c.get('user') as { id: number };
    const threadId = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(threadId) as
      | ThreadRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.deleted_at) return c.json({ error: 'thread deleted' }, 409);

    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload.body_md !== 'string') {
      return c.json({ error: 'body_md required' }, 400);
    }
    if (payload.body_md.trim().length === 0) {
      return c.json({ error: 'body_md cannot be empty' }, 400);
    }
    if (payload.body_md.length > REPLY_BODY_MAX) {
      return c.json({ error: `body exceeds ${REPLY_BODY_MAX} chars` }, 413);
    }

    const id = randomUUID();
    const insertReply = db.prepare(
      `INSERT INTO forum_replies (id, thread_id, author_id, body_md) VALUES (?, ?, ?, ?)`,
    );
    const bumpThread = db.prepare(
      `UPDATE forum_threads
       SET reply_count = reply_count + 1, last_activity_at = datetime('now')
       WHERE id = ?`,
    );
    const subUpsert = db.prepare(
      `INSERT OR IGNORE INTO forum_subscriptions (user_id, thread_id) VALUES (?, ?)`,
    );
    db.transaction(() => {
      insertReply.run(id, threadId, user.id, payload.body_md);
      bumpThread.run(threadId);
      subUpsert.run(user.id, threadId);
    })();

    const inserted = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as ReplyRow;
    return c.json({ reply: shapeReply(db, inserted, user.id) }, 201);
  });

  // ---- Edit reply ----
  router.put('/replies/:id', async (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as
      | ReplyRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.deleted_at) return c.json({ error: 'cannot edit deleted reply' }, 409);

    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload.body_md !== 'string') {
      return c.json({ error: 'body_md required' }, 400);
    }
    if (payload.body_md.trim().length === 0) {
      return c.json({ error: 'body_md cannot be empty' }, 400);
    }
    if (payload.body_md.length > REPLY_BODY_MAX) {
      return c.json({ error: `body exceeds ${REPLY_BODY_MAX} chars` }, 413);
    }

    db.prepare(
      `UPDATE forum_replies SET body_md = ?, edited_at = datetime('now') WHERE id = ?`,
    ).run(payload.body_md, id);

    const updated = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as ReplyRow;
    return c.json({ reply: shapeReply(db, updated, user.id) });
  });

  // ---- Delete reply (soft) ----
  router.delete('/replies/:id', (c) => {
    const user = c.get('user') as { id: number };
    const id = c.req.param('id');
    const row = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(id) as
      | ReplyRow
      | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.author_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.deleted_at) return c.json({ deleted: 'soft' });

    db.prepare(
      `UPDATE forum_replies SET deleted_at = datetime('now') WHERE id = ?`,
    ).run(id);
    return c.json({ deleted: 'soft' });
  });

  return router;
}
