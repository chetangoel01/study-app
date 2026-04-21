import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchInviteSummaryRows,
  fetchInviteEvents,
  findOverlappingInvite,
  getInitials,
  insertEvent,
  isRoleCompatible,
  isValidRole,
  type InviteSummaryRow,
  type RolePreference,
} from '../lib/scheduling.js';

function parseEventPayload(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

interface InviteRow {
  id: number;
  initiator_id: number;
  peer_id: number;
  status: string;
  scheduled_for: string;
  duration_minutes: number;
}

function loadInviteForTransition(
  db: Database.Database,
  inviteId: number,
  callerId: number,
  requiredParty: 'any' | 'peer' | 'initiator',
): { row: InviteRow; httpError: null } | { row: null; httpError: { code: number; body: any } } {
  const row = db.prepare(`
    SELECT id, initiator_id, peer_id, status, scheduled_for, duration_minutes
    FROM mock_interviews WHERE id = ?
  `).get(inviteId) as InviteRow | undefined;
  if (!row) return { row: null, httpError: { code: 404, body: { error: 'not_found' } } };
  const isInitiator = row.initiator_id === callerId;
  const isPeer = row.peer_id === callerId;
  if (!isInitiator && !isPeer) return { row: null, httpError: { code: 403, body: { error: 'forbidden' } } };
  if (requiredParty === 'peer' && !isPeer) return { row: null, httpError: { code: 403, body: { error: 'forbidden', detail: 'only peer can perform this action' } } };
  if (requiredParty === 'initiator' && !isInitiator) return { row: null, httpError: { code: 403, body: { error: 'forbidden', detail: 'only initiator can perform this action' } } };
  return { row, httpError: null };
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
      payload: parseEventPayload(e.payload),
      createdAt: e.created_at,
    }));

    return c.json({
      ...summaryRowToResponse(row, user.id),
      events,
    });
  });

  router.post('/schedule', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({} as any));
    const { peerId, scheduledFor, durationMinutes, topic, rolePreference } = body;

    if (!peerId || !scheduledFor || !rolePreference) {
      return c.json({ error: 'missing_fields', detail: 'peerId, scheduledFor, rolePreference required' }, 400);
    }
    if (!isValidRole(rolePreference)) {
      return c.json({ error: 'invalid_role' }, 400);
    }
    if (Number.isNaN(Date.parse(scheduledFor))) {
      return c.json({ error: 'invalid_datetime' }, 400);
    }
    const duration = Number(durationMinutes ?? 45);
    if (!Number.isFinite(duration) || duration < 15 || duration > 180) {
      return c.json({ error: 'invalid_duration' }, 400);
    }
    const peerIdNum = Number(peerId);
    if (!Number.isInteger(peerIdNum) || peerIdNum === user.id) {
      return c.json({ error: 'invalid_peer' }, 400);
    }

    const peer = db.prepare(`
      SELECT u.id, p.default_role_preference
      FROM users u JOIN user_preferences p ON u.id = p.user_id
      WHERE u.id = ? AND p.allow_mock_interviews = 1
    `).get(peerIdNum) as { id: number; default_role_preference: RolePreference } | undefined;
    if (!peer) return c.json({ error: 'peer_unavailable' }, 404);

    if (!isRoleCompatible(rolePreference as RolePreference, peer.default_role_preference)) {
      return c.json({
        error: 'role_incompatible',
        detail: `Peer's default role (${peer.default_role_preference}) is not compatible with your requested role (${rolePreference}).`,
      }, 409);
    }

    const conflictId = findOverlappingInvite(db, user.id, scheduledFor, duration);
    if (conflictId != null) {
      return c.json({
        error: 'overlap',
        detail: 'This time overlaps an existing accepted invite.',
        context: { conflictingInviteId: String(conflictId) },
      }, 409);
    }

    const insertInvite = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO mock_interviews
          (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference)
        VALUES (?, ?, 'pending_acceptance', ?, ?, ?, ?)
      `).run(user.id, peerIdNum, scheduledFor, Math.round(duration), topic || 'General Technical', rolePreference);
      const inviteId = Number(info.lastInsertRowid);
      insertEvent(db, inviteId, user.id, 'created');
      return inviteId;
    });
    const inviteId = insertInvite();

    return c.json({ id: String(inviteId) });
  });

  router.post('/:id/accept', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const loaded = loadInviteForTransition(db, id, user.id, 'peer');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    const { row } = loaded;
    if (row.status !== 'pending_acceptance') {
      return c.json({ error: 'invalid_transition', detail: `cannot accept from status ${row.status}` }, 422);
    }
    const conflictId = findOverlappingInvite(db, user.id, row.scheduled_for, row.duration_minutes, row.id);
    if (conflictId != null) {
      return c.json({ error: 'overlap', context: { conflictingInviteId: String(conflictId) } }, 409);
    }
    db.transaction(() => {
      db.prepare(`UPDATE mock_interviews SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`).run(id);
      insertEvent(db, id, user.id, 'accepted');
    })();
    return c.json({ ok: true });
  });

  router.post('/:id/decline', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const loaded = loadInviteForTransition(db, id, user.id, 'peer');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    if (loaded.row.status !== 'pending_acceptance') {
      return c.json({ error: 'invalid_transition' }, 422);
    }
    db.transaction(() => {
      db.prepare(`UPDATE mock_interviews SET status = 'declined', updated_at = datetime('now') WHERE id = ?`).run(id);
      insertEvent(db, id, user.id, 'declined');
    })();
    return c.json({ ok: true });
  });

  router.post('/:id/cancel', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const loaded = loadInviteForTransition(db, id, user.id, 'any');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    const { row } = loaded;
    if (row.status === 'cancelled' || row.status === 'declined') {
      return c.json({ error: 'invalid_transition' }, 422);
    }
    db.transaction(() => {
      db.prepare(`UPDATE mock_interviews SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
      insertEvent(db, id, user.id, 'cancelled');
    })();
    return c.json({ ok: true });
  });

  router.post('/:id/reschedule', async (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({} as any));
    const { scheduledFor } = body;
    if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) {
      return c.json({ error: 'invalid_datetime' }, 400);
    }
    const loaded = loadInviteForTransition(db, id, user.id, 'any');
    if (loaded.httpError) return c.json(loaded.httpError.body, loaded.httpError.code as any);
    const { row } = loaded;
    if (row.status !== 'accepted' && row.status !== 'pending_acceptance') {
      return c.json({ error: 'invalid_transition' }, 422);
    }
    // Overlap check for BOTH parties at new window, excluding this invite.
    for (const partyId of [row.initiator_id, row.peer_id]) {
      const conflictId = findOverlappingInvite(db, partyId, scheduledFor, row.duration_minutes, row.id);
      if (conflictId != null) {
        return c.json({ error: 'overlap', context: { conflictingInviteId: String(conflictId) } }, 409);
      }
    }
    const from = row.scheduled_for;
    db.transaction(() => {
      db.prepare(`
        UPDATE mock_interviews
        SET scheduled_for = ?, status = 'pending_acceptance', updated_at = datetime('now')
        WHERE id = ?
      `).run(scheduledFor, id);
      insertEvent(db, id, user.id, 'rescheduled', { from, to: scheduledFor });
    })();
    return c.json({ ok: true });
  });

  return router;
}
