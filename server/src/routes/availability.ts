import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';
import {
  findOverlappingInvite,
  getInitials,
  insertEvent,
  isRoleCompatible,
  isValidRole,
  type RolePreference,
} from '../lib/scheduling.js';

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

  router.get('/feed', (c) => {
    const user = c.get('user');
    const roleParam = c.req.query('role');
    const topicParam = c.req.query('topic');
    const fromParam = c.req.query('from');
    const toParam = c.req.query('to');

    const filters: string[] = ["b.status = 'open'", 'p.user_id != ?'];
    const params: unknown[] = [user.id];

    if (roleParam === 'interviewee') {
      filters.push("p.role_preference IN ('interviewee', 'either')");
    } else if (roleParam === 'interviewer') {
      filters.push("p.role_preference IN ('interviewer', 'either')");
    }
    if (topicParam) {
      filters.push('p.topic LIKE ?');
      params.push(`%${topicParam}%`);
    }
    if (fromParam) {
      filters.push('b.starts_at >= ?');
      params.push(fromParam);
    }
    if (toParam) {
      filters.push('b.starts_at < ?');
      params.push(toParam);
    }

    const rows = db.prepare(`
      SELECT b.id, b.proposal_id, b.starts_at,
             p.duration_minutes, p.topic, p.notes, p.role_preference,
             u.id AS user_id, u.full_name
      FROM availability_blocks b
      JOIN availability_proposals p ON p.id = b.proposal_id
      JOIN users u ON u.id = p.user_id
      WHERE ${filters.join(' AND ')}
      ORDER BY b.starts_at ASC
      LIMIT 100
    `).all(...params) as Array<{
      id: number; proposal_id: number; starts_at: string;
      duration_minutes: number; topic: string | null; notes: string | null;
      role_preference: RolePreference; user_id: number; full_name: string | null;
    }>;

    const accepted = db.prepare(`
      SELECT scheduled_for, duration_minutes
      FROM mock_interviews
      WHERE status = 'accepted' AND (initiator_id = ? OR peer_id = ?)
    `).all(user.id, user.id) as Array<{ scheduled_for: string; duration_minutes: number }>;
    const acceptedRanges = accepted.map((a) => {
      const start = new Date(a.scheduled_for).getTime();
      return { start, end: start + a.duration_minutes * 60_000 };
    });

    const body = rows.flatMap((r) => {
      const start = new Date(r.starts_at).getTime();
      const end = start + r.duration_minutes * 60_000;
      for (const a of acceptedRanges) {
        if (start < a.end && end > a.start) return [];
      }
      return [{
        blockId: String(r.id),
        proposalId: String(r.proposal_id),
        postedBy: {
          id: String(r.user_id),
          fullName: r.full_name || 'Anonymous User',
          initials: getInitials(r.full_name || ''),
        },
        startsAt: r.starts_at,
        durationMinutes: r.duration_minutes,
        topic: r.topic ?? '',
        notes: r.notes ?? '',
        rolePreference: r.role_preference,
      }];
    });

    return c.json(body);
  });

  router.post('/blocks/:id/claim', async (c) => {
    const user = c.get('user');
    const blockId = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({} as any));
    const { rolePreference, notes } = body;
    if (!isValidRole(rolePreference)) return c.json({ error: 'invalid_role' }, 400);

    const block = db.prepare(`
      SELECT b.id, b.status, b.claimed_by, b.starts_at,
             p.id AS proposal_id, p.user_id AS poster_id, p.duration_minutes, p.topic, p.role_preference
      FROM availability_blocks b
      JOIN availability_proposals p ON p.id = b.proposal_id
      WHERE b.id = ?
    `).get(blockId) as {
      id: number; status: string; claimed_by: number | null; starts_at: string;
      proposal_id: number; poster_id: number; duration_minutes: number; topic: string | null;
      role_preference: RolePreference;
    } | undefined;

    if (!block) return c.json({ error: 'not_found' }, 404);
    if (block.poster_id === user.id) return c.json({ error: 'cannot_claim_own_block' }, 400);

    if (!isRoleCompatible(rolePreference as RolePreference, block.role_preference)) {
      return c.json({ error: 'role_incompatible' }, 409);
    }

    const conflictForClaimant = findOverlappingInvite(db, user.id, block.starts_at, block.duration_minutes);
    if (conflictForClaimant != null) {
      return c.json({ error: 'overlap', context: { conflictingInviteId: String(conflictForClaimant) } }, 409);
    }

    const result = db.transaction(() => {
      const upd = db.prepare(`
        UPDATE availability_blocks
        SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now')
        WHERE id = ? AND claimed_by IS NULL AND status = 'open'
      `).run(user.id, blockId);
      if (upd.changes === 0) return { raced: true } as const;

      const ins = db.prepare(`
        INSERT INTO mock_interviews
          (initiator_id, peer_id, status, scheduled_for, duration_minutes, topic, role_preference, source_block_id)
        VALUES (?, ?, 'pending_acceptance', ?, ?, ?, ?, ?)
      `).run(user.id, block.poster_id, block.starts_at, block.duration_minutes, block.topic || 'General Technical', rolePreference, blockId);
      const inviteId = Number(ins.lastInsertRowid);
      db.prepare(`UPDATE availability_blocks SET mock_interview_id = ? WHERE id = ?`).run(inviteId, blockId);
      insertEvent(db, inviteId, user.id, 'created', { sourceBlockId: String(blockId), claimNotes: notes ?? null });
      return { raced: false, inviteId } as const;
    })();

    if (result.raced) return c.json({ error: 'block_already_claimed' }, 409);
    return c.json({ inviteId: String(result.inviteId) });
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
