import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { requireAuth } from '../middleware/auth.js';

export function makePracticeRouter(db: Database.Database): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  // Daily Challenge
  router.get('/daily-challenge', (c) => {
    const user = c.get('user');
    const today = new Date().toISOString().split('T')[0];

    // Get today's challenge
    let challenge = db.prepare('SELECT * FROM daily_challenge_pool WHERE active_date = ?').get(today) as any;
    
    // If no challenge exists for today, grab fallback
    if (!challenge) {
      const fallback = db.prepare('SELECT * FROM daily_challenge_pool ORDER BY active_date DESC LIMIT 1').get() as any;
      if (!fallback) {
        return c.json({ error: 'No daily challenges available' }, 404);
      }
      challenge = fallback;
    }

    // Check completion
    const completion = db.prepare(
      'SELECT completed_at FROM daily_challenge_completions WHERE user_id = ? AND challenge_id = ?'
    ).get(user.id, challenge.id) as any;

    return c.json({
      id: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty,
      leetcodeUrl: challenge.leetcode_url,
      durationMins: challenge.duration_mins,
      completed: !!completion,
      completedAt: completion?.completed_at || null,
    });
  });

  router.post('/daily-challenge/complete', async (c) => {
    const user = c.get('user');
    const { challengeId } = await c.req.json().catch(() => ({ challengeId: null }));
    if (!challengeId) return c.json({ error: 'Missing challengeId' }, 400);

    db.prepare(`
      INSERT INTO daily_challenge_completions (user_id, challenge_id, completed_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT DO NOTHING
    `).run(user.id, challengeId);

    // Inject practice session
    db.prepare(`
      INSERT INTO practice_sessions (user_id, type, title, duration_seconds, score_percentage, created_at)
      VALUES (?, 'daily_challenge', 'Daily Challenge', 1800, 100, datetime('now'))
    `).run(user.id);

    return c.json({ ok: true });
  });

  // Streaks and Stats
  router.get('/stats', (c) => {
    const user = c.get('user');
    
    const sessions = db.prepare(`
      SELECT id, type, title, duration_seconds as durationSeconds, score_percentage as score, created_at as createdAt
      FROM practice_sessions 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(user.id);

    const streakDays = 12; // Static placeholder
    const percentile = 5; // Static placeholder

    return c.json({
      streakDays,
      percentile,
      recentSessions: sessions,
      skillBreakdown: [
        { name: 'Algorithms', score: 88 },
        { name: 'System Design', score: 64 },
        { name: 'Concurrency', score: 92 },
      ]
    });
  });

  // Peers for mock interviews
  router.get('/peers', (c) => {
    const user = c.get('user');
    const peers = db.prepare(`
      SELECT u.id, u.full_name, u.bio
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
      WHERE p.allow_mock_interviews = 1
        AND u.id != ?
      LIMIT 50
    `).all(user.id) as any[];

    return c.json(peers.map((p) => ({
      id: String(p.id),
      fullName: p.full_name || 'Anonymous User',
      initials: (p.full_name || 'U').substring(0, 1).toUpperCase()
    })));
  });

  router.post('/mock-interviews/schedule', async (c) => {
    const user = c.get('user');
    const { peerId, scheduledFor, topic } = await c.req.json().catch(() => ({} as any));

    if (!peerId || !scheduledFor) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    db.prepare(`
      INSERT INTO mock_interviews (initiator_id, peer_id, status, scheduled_for, topic)
      VALUES (?, ?, 'pending_acceptance', ?, ?)
    `).run(user.id, peerId, scheduledFor, topic || 'General Technical');

    return c.json({ ok: true });
  });

  return router;
}
