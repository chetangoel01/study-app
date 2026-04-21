import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import { isValidRole, type RolePreference } from '../lib/scheduling.js';

interface CreateBody {
  durationMinutes?: number;
  topic?: string;
  notes?: string;
  rolePreference?: string;
  blocks?: Array<{ startsAt?: string }>;
}

function blocksOverlapWithin(blocks: Array<{ startsAt: string }>, durationMinutes: number): boolean {
  const sorted = [...blocks].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(new Date(sorted[i - 1].startsAt).getTime() + durationMinutes * 60_000);
    const curStart = new Date(sorted[i].startsAt);
    if (curStart < prevEnd) return true;
  }
  return false;
}

export function makeAvailabilityRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.post('/', async (c) => {
    const user = c.get('user');
    const body = (await c.req.json().catch(() => ({}))) as CreateBody;

    const duration = Number(body.durationMinutes ?? 45);
    if (!Number.isFinite(duration) || duration < 15 || duration > 180) {
      return c.json({ error: 'invalid_duration' }, 400);
    }
    if (!isValidRole(body.rolePreference)) return c.json({ error: 'invalid_role' }, 400);
    const role = body.rolePreference as RolePreference;

    const rawBlocks = Array.isArray(body.blocks) ? body.blocks : [];
    if (rawBlocks.length < 1 || rawBlocks.length > 8) {
      return c.json({ error: 'invalid_block_count', detail: '1..8 blocks required' }, 400);
    }
    const normalized: Array<{ startsAt: string }> = [];
    for (const b of rawBlocks) {
      if (!b || typeof b.startsAt !== 'string' || Number.isNaN(Date.parse(b.startsAt))) {
        return c.json({ error: 'invalid_block_start' }, 400);
      }
      normalized.push({ startsAt: new Date(b.startsAt).toISOString() });
    }
    if (blocksOverlapWithin(normalized, duration)) {
      return c.json({ error: 'blocks_overlap', detail: 'two blocks within durationMinutes of each other' }, 400);
    }

    const topic = typeof body.topic === 'string' ? body.topic : '';
    const notes = typeof body.notes === 'string' ? body.notes : '';

    const proposalId = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO availability_proposals (user_id, duration_minutes, topic, notes, role_preference)
        VALUES (?, ?, ?, ?, ?)
      `).run(user.id, Math.round(duration), topic, notes, role);
      const id = Number(info.lastInsertRowid);
      const insertBlock = db.prepare(
        `INSERT INTO availability_blocks (proposal_id, starts_at) VALUES (?, ?)`,
      );
      for (const b of normalized) insertBlock.run(id, b.startsAt);
      return id;
    })();

    return c.json({ proposalId: String(proposalId) });
  });

  router.get('/mine', (c) => {
    const user = c.get('user');
    const proposals = db.prepare(`
      SELECT id, duration_minutes, topic, notes, role_preference, created_at
      FROM availability_proposals
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(user.id) as Array<{
      id: number; duration_minutes: number; topic: string | null; notes: string | null;
      role_preference: RolePreference; created_at: string;
    }>;

    const blocksStmt = db.prepare(`
      SELECT b.id, b.proposal_id, b.starts_at, b.status, b.mock_interview_id,
             b.claimed_by, cu.full_name AS claimer_full_name
      FROM availability_blocks b
      LEFT JOIN users cu ON cu.id = b.claimed_by
      WHERE proposal_id = ?
      ORDER BY starts_at ASC
    `);

    return c.json({
      proposals: proposals.map((p) => ({
        id: String(p.id),
        durationMinutes: p.duration_minutes,
        topic: p.topic ?? '',
        notes: p.notes ?? '',
        rolePreference: p.role_preference,
        createdAt: p.created_at,
        blocks: (blocksStmt.all(p.id) as any[]).map((b) => ({
          blockId: String(b.id),
          proposalId: String(b.proposal_id),
          startsAt: b.starts_at,
          status: b.status,
          claimedBy: b.claimed_by ? { id: String(b.claimed_by), fullName: b.claimer_full_name || 'Anonymous User' } : null,
          mockInterviewId: b.mock_interview_id ? String(b.mock_interview_id) : null,
        })),
      })),
    });
  });

  router.delete('/blocks/:id', (c) => {
    const user = c.get('user');
    const blockId = Number(c.req.param('id'));
    const row = db.prepare(`
      SELECT b.id, b.status, p.user_id
      FROM availability_blocks b
      JOIN availability_proposals p ON p.id = b.proposal_id
      WHERE b.id = ?
    `).get(blockId) as { id: number; status: string; user_id: number } | undefined;
    if (!row) return c.json({ error: 'not_found' }, 404);
    if (row.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    if (row.status !== 'open') return c.json({ error: 'invalid_state' }, 422);
    db.prepare(`UPDATE availability_blocks SET status = 'cancelled' WHERE id = ?`).run(blockId);
    return c.json({ ok: true });
  });

  router.delete('/:proposalId', (c) => {
    const user = c.get('user');
    const id = Number(c.req.param('proposalId'));
    const prop = db.prepare('SELECT user_id FROM availability_proposals WHERE id = ?').get(id) as { user_id: number } | undefined;
    if (!prop) return c.json({ error: 'not_found' }, 404);
    if (prop.user_id !== user.id) return c.json({ error: 'forbidden' }, 403);
    db.prepare(`UPDATE availability_blocks SET status = 'cancelled' WHERE proposal_id = ? AND status = 'open'`).run(id);
    return c.json({ ok: true });
  });

  return router;
}
