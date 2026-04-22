import type Database from 'better-sqlite3';

export type RolePreference = 'interviewee' | 'interviewer' | 'either';

export const ROLE_PREFERENCES: readonly RolePreference[] = ['interviewee', 'interviewer', 'either'] as const;

export function isValidRole(value: unknown): value is RolePreference {
  return typeof value === 'string' && (ROLE_PREFERENCES as readonly string[]).includes(value);
}

export function isRoleCompatible(a: RolePreference, b: RolePreference): boolean {
  if (a === 'either' || b === 'either') return true;
  return a !== b;
}

export function findOverlappingInvite(
  db: Database.Database,
  userId: number,
  windowStartIso: string,
  windowDurationMinutes: number,
  excludeInviteId?: number,
): number | null {
  const windowEndIso = new Date(
    new Date(windowStartIso).getTime() + windowDurationMinutes * 60_000,
  ).toISOString();

  const row = db.prepare(`
    SELECT id
    FROM mock_interviews
    WHERE status = 'accepted'
      AND (initiator_id = ? OR peer_id = ?)
      AND datetime(scheduled_for) < datetime(?)
      AND datetime(scheduled_for, '+' || duration_minutes || ' minutes') > datetime(?)
      ${excludeInviteId ? 'AND id != ?' : ''}
    LIMIT 1
  `).get(
    userId,
    userId,
    windowEndIso,
    windowStartIso,
    ...(excludeInviteId ? [excludeInviteId] : []),
  ) as { id: number } | undefined;

  return row ? row.id : null;
}

export interface InviteSummaryRow {
  id: number;
  initiator_id: number;
  peer_id: number;
  status: string;
  scheduled_for: string;
  duration_minutes: number;
  topic: string;
  role_preference: RolePreference;
  source_block_id: number | null;
  created_at: string;
  updated_at: string;
  counterparty_full_name: string | null;
}

export function fetchInviteSummaryRows(
  db: Database.Database,
  userId: number,
  opts: {
    direction?: 'sent' | 'received' | 'all';
    statuses?: string[];
    windowFrom?: string;
    windowTo?: string;
    sort?: 'asc' | 'desc';
  } = {},
): InviteSummaryRow[] {
  const direction = opts.direction ?? 'all';
  const sort = opts.sort ?? 'desc';
  const filters: string[] = [];
  const params: unknown[] = [];

  if (direction === 'sent') {
    filters.push('mi.initiator_id = ?');
    params.push(userId);
  } else if (direction === 'received') {
    filters.push('mi.peer_id = ?');
    params.push(userId);
  } else {
    filters.push('(mi.initiator_id = ? OR mi.peer_id = ?)');
    params.push(userId, userId);
  }

  if (opts.statuses && opts.statuses.length > 0) {
    filters.push(`mi.status IN (${opts.statuses.map(() => '?').join(',')})`);
    params.push(...opts.statuses);
  }

  if (opts.windowFrom) {
    filters.push('datetime(mi.scheduled_for) >= datetime(?)');
    params.push(opts.windowFrom);
  }

  if (opts.windowTo) {
    filters.push('datetime(mi.scheduled_for) < datetime(?)');
    params.push(opts.windowTo);
  }

  const sql = `
    SELECT
      mi.id, mi.initiator_id, mi.peer_id, mi.status, mi.scheduled_for,
      mi.duration_minutes, mi.topic, mi.role_preference, mi.source_block_id,
      mi.created_at, mi.updated_at,
      counterparty.full_name AS counterparty_full_name
    FROM mock_interviews mi
    JOIN users counterparty ON counterparty.id = CASE WHEN mi.initiator_id = ? THEN mi.peer_id ELSE mi.initiator_id END
    WHERE ${filters.join(' AND ')}
    ORDER BY mi.scheduled_for ${sort === 'asc' ? 'ASC' : 'DESC'}
    LIMIT 200
  `;
  return db.prepare(sql).all(userId, ...params) as InviteSummaryRow[];
}

export interface InviteEventRow {
  id: number;
  actor_id: number;
  event_type: string;
  payload: string | null;
  created_at: string;
}

export function fetchInviteEvents(db: Database.Database, inviteId: number): InviteEventRow[] {
  return db.prepare(`
    SELECT id, actor_id, event_type, payload, created_at
    FROM mock_interview_events
    WHERE invite_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(inviteId) as InviteEventRow[];
}

export function insertEvent(
  db: Database.Database,
  inviteId: number,
  actorId: number,
  eventType: 'created' | 'accepted' | 'declined' | 'cancelled' | 'rescheduled',
  payload?: Record<string, unknown>,
): void {
  db.prepare(`
    INSERT INTO mock_interview_events (invite_id, actor_id, event_type, payload)
    VALUES (?, ?, ?, ?)
  `).run(inviteId, actorId, eventType, payload ? JSON.stringify(payload) : null);
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}
