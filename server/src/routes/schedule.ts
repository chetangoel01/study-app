import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { fetchInviteSummaryRows, getInitials, type InviteSummaryRow } from '../lib/scheduling.js';
import { buildIcsEvent } from '../lib/ics.js';
import { config } from '../config.js';

const SCHEDULE_STATUSES = ['pending_acceptance', 'accepted'];

function summaryToResponse(row: InviteSummaryRow, callerId: number) {
  const isSent = row.initiator_id === callerId;
  return {
    id: String(row.id),
    direction: isSent ? 'sent' : 'received',
    counterparty: {
      id: String(isSent ? row.peer_id : row.initiator_id),
      fullName: row.counterparty_full_name || 'Anonymous User',
      initials: getInitials(row.counterparty_full_name || ''),
    },
    status: row.status,
    scheduledFor: row.scheduled_for,
    durationMinutes: row.duration_minutes,
    topic: row.topic ?? '',
    rolePreference: row.role_preference,
    sourceBlockId: row.source_block_id ? String(row.source_block_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function makeScheduleRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/', (c) => {
    const user = c.get('user');
    const includePast = c.req.query('includePast') === 'true';
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const defaultTo = new Date(now.getTime() + 90 * 86_400_000).toISOString();
    const windowFrom = includePast
      ? (c.req.query('from') ?? defaultFrom)
      : new Date(Math.max(now.getTime(), Date.parse(c.req.query('from') ?? defaultFrom))).toISOString();
    const windowTo = c.req.query('to') ?? defaultTo;

    const rows = fetchInviteSummaryRows(db, user.id, {
      statuses: SCHEDULE_STATUSES,
      windowFrom,
      windowTo,
      sort: 'asc',
    });
    return c.json({ invites: rows.map((r) => summaryToResponse(r, user.id)) });
  });

  router.get('/ics/:id', (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400);

    const base = db.prepare(`
      SELECT id, initiator_id, peer_id, status, scheduled_for, duration_minutes, topic
      FROM mock_interviews
      WHERE id = ?
    `).get(id) as
      | { id: number; initiator_id: number; peer_id: number; status: string; scheduled_for: string; duration_minutes: number; topic: string | null }
      | undefined;

    if (!base) return c.json({ error: 'not_found' }, 404);
    if (base.initiator_id !== user.id && base.peer_id !== user.id) {
      return c.json({ error: 'forbidden' }, 403);
    }
    if (base.status !== 'accepted') {
      return c.json({ error: 'invalid_state' }, 422);
    }

    const counterpartyId = base.initiator_id === user.id ? base.peer_id : base.initiator_id;
    const cp = db.prepare('SELECT full_name FROM users WHERE id = ?').get(counterpartyId) as
      | { full_name: string | null }
      | undefined;

    const baseHost = new URL(config.baseUrl).host;
    const counterparty = cp?.full_name || 'Anonymous User';
    const topic = base.topic || 'General Technical';
    const inviteUrl = `${config.baseUrl}/practice`;

    const ics = buildIcsEvent({
      uid: `mock-invite-${base.id}@${baseHost}`,
      summary: `Mock interview with ${counterparty}`,
      description: `Topic: ${topic}\n\nOpen in app: ${inviteUrl}`,
      startIso: base.scheduled_for,
      durationMinutes: base.duration_minutes,
      dtstampIso: new Date().toISOString(),
    });

    return new Response(ics, {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': `attachment; filename="mock-interview-${base.id}.ics"`,
      },
    });
  });

  return router;
}
