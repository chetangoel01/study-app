import type Database from 'better-sqlite3';

export const COMMUNITY_TAGS = [
  'system-design',
  'dsa',
  'career',
  'behavioral',
  'devops',
] as const;

export type CommunityTag = (typeof COMMUNITY_TAGS)[number];

export function isValidTag(x: unknown): x is CommunityTag {
  return typeof x === 'string' && (COMMUNITY_TAGS as readonly string[]).includes(x);
}

export const TITLE_MAX = 200;
export const THREAD_BODY_MAX = 20_000;
export const REPLY_BODY_MAX = 10_000;

export function displayName(user: { full_name?: string | null; email: string }): string {
  const fn = (user.full_name ?? '').trim();
  if (fn.length > 0) return fn;
  return user.email.split('@')[0] ?? user.email;
}

/**
 * Insert-or-conditional-update the viewer's view row. The row exists after
 * the first call (so distinct-user view count is stable); subsequent calls
 * within 24h do nothing. After 24h, last_viewed_at advances — still one row.
 */
export function recordView(db: Database.Database, userId: number, threadId: string): void {
  db.prepare(
    `INSERT INTO forum_thread_views (user_id, thread_id, last_viewed_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id, thread_id) DO UPDATE SET
       last_viewed_at = excluded.last_viewed_at
     WHERE last_viewed_at < datetime('now', '-24 hours')`
  ).run(userId, threadId);
}

export function totalViewCount(db: Database.Database, threadId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM forum_thread_views WHERE thread_id = ?')
    .get(threadId) as { n: number };
  return row.n;
}
