import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { fetchInviteSummaryRows, fetchInviteEvents, getInitials, type InviteSummaryRow } from '../lib/scheduling.js';

function summaryRowToResponse(row: InviteSummaryRow, callerId: number) {
  return {
    id: String(row.id),
    direction: row.initiator_id === callerId ? 'sent' : 'received',
    counterparty: {
      id: String(row.initiator_id === callerId ? row.peer_id : row.initiator_id),
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

export function makeMockInterviewsRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/peers', (c) => {
    const user = c.get('user');
    const peers = db.prepare(`
      SELECT u.id, u.full_name, p.default_role_preference
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
      WHERE p.allow_mock_interviews = 1 AND u.id != ?
      LIMIT 50
    `).all(user.id) as Array<{ id: number; full_name: string | null; default_role_preference: string }>;

    return c.json(peers.map((p) => ({
      id: String(p.id),
      fullName: p.full_name || 'Anonymous User',
      initials: getInitials(p.full_name || ''),
      defaultRolePreference: p.default_role_preference,
    })));
  });

  router.get('/', (c) => {
    const user = c.get('user');
    const directionParam = c.req.query('direction');
    const direction: 'sent' | 'received' | 'all' =
      directionParam === 'sent' || directionParam === 'received' ? directionParam : 'all';
    const statusParam = c.req.query('status');
    const statuses = statusParam ? statusParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    const rows = fetchInviteSummaryRows(db, user.id, { direction, statuses });
    return c.json(rows.map((r) => summaryRowToResponse(r, user.id)));
  });

  router.get('/:id', (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id)) return c.json({ error: 'invalid_id' }, 400);

    const rows = fetchInviteSummaryRows(db, user.id, {});
    const row = rows.find((r) => r.id === id);
    if (!row) {
      // Check if invite exists at all vs. caller not party.
      const exists = db.prepare('SELECT id, initiator_id, peer_id FROM mock_interviews WHERE id = ?').get(id) as
        | { id: number; initiator_id: number; peer_id: number }
        | undefined;
      if (!exists) return c.json({ error: 'not_found' }, 404);
      if (exists.initiator_id !== user.id && exists.peer_id !== user.id) {
        return c.json({ error: 'forbidden' }, 403);
      }
      return c.json({ error: 'not_found' }, 404);
    }

    const eventRows = fetchInviteEvents(db, id);
    const events = eventRows.map((e) => ({
      id: String(e.id),
      actorId: String(e.actor_id),
      eventType: e.event_type,
      payload: e.payload ? JSON.parse(e.payload) : null,
      createdAt: e.created_at,
    }));

    return c.json({
      ...summaryRowToResponse(row, user.id),
      events,
    });
  });

  return router;
}
