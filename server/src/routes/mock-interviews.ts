import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { fetchInviteSummaryRows, getInitials, type InviteSummaryRow } from '../lib/scheduling.js';

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

  return router;
}
