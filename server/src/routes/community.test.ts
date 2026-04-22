import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { applySchema } from '../db/schema.js';
import { makeAuthRouter } from './auth.js';
import { makeCommunityRouter } from './community.js';

let db: Database.Database;
let app: Hono;

async function authedCookie(email: string): Promise<string> {
  await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const match = (res.headers.get('set-cookie') ?? '').match(/access_token=([^;]+)/);
  return match ? `access_token=${match[1]}` : '';
}

beforeEach(() => {
  db = new Database(':memory:');
  applySchema(db);
  app = new Hono();
  app.route('/api/auth', makeAuthRouter(db));
  app.route('/api/community', makeCommunityRouter(db));
});
afterEach(() => db.close());

describe('POST /api/community/threads', () => {
  it('creates a thread and auto-subscribes the author', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Hello', body_md: '# Hi', tag: 'dsa' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.thread.title).toBe('Hello');
    expect(body.thread.tag).toBe('dsa');
    expect(body.thread.isSubscribed).toBe(true);
    expect(body.thread.id).toMatch(/^[0-9a-f-]{36}$/);

    const sub = db
      .prepare('SELECT * FROM forum_subscriptions WHERE thread_id = ?')
      .all(body.thread.id);
    expect(sub.length).toBe(1);
  });

  it('rejects invalid tag', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'x', body_md: 'y', tag: 'not-a-tag' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversized title (413)', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'x'.repeat(201), body_md: 'y', tag: 'dsa' }),
    });
    expect(res.status).toBe(413);
  });

  it('rejects oversized body (413)', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 't', body_md: 'y'.repeat(20_001), tag: 'dsa' }),
    });
    expect(res.status).toBe(413);
  });

  it('rejects unauthenticated', async () => {
    const res = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 't', body_md: 'y', tag: 'dsa' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/community/threads/:id', () => {
  it('returns thread detail for logged-in user', async () => {
    const cookie = await authedCookie('a@x.com');
    const create = await app.request('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    });
    const { thread } = await create.json();
    const get = await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: cookie },
    });
    expect(get.status).toBe(200);
    const body = await get.json();
    expect(body.thread.body_md).toBe('B');
    expect(body.replies).toEqual([]);
    expect(body.canEdit).toBe(true);
  });

  it('returns 404 for unknown thread', async () => {
    const cookie = await authedCookie('a@x.com');
    const res = await app.request('/api/community/threads/missing', { headers: { Cookie: cookie } });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/community/threads (filter=all, default)', () => {
  it('returns threads sorted by last_activity_at DESC', async () => {
    const cookie = await authedCookie('a@x.com');
    const t1 = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'First', body_md: 'x', tag: 'dsa' }),
    })).json();
    const t2 = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Second', body_md: 'x', tag: 'dsa' }),
    })).json();
    db.prepare("UPDATE forum_threads SET last_activity_at = datetime('now', '+1 hour') WHERE id = ?")
      .run(t2.thread.id);

    const res = await app.request('/api/community/threads', { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threads.map((t: { id: string }) => t.id)).toEqual([t2.thread.id, t1.thread.id]);
    expect(body.threads[0].isSubscribed).toBe(true);
  });

  it('omits soft-deleted threads', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'X', body_md: 'x', tag: 'dsa' }),
    })).json();
    db.prepare("UPDATE forum_threads SET deleted_at = datetime('now') WHERE id = ?").run(thread.id);
    const res = await app.request('/api/community/threads', { headers: { Cookie: cookie } });
    expect((await res.json()).threads).toEqual([]);
  });
});

describe('PUT /api/community/threads/:id', () => {
  it('author can edit; sets edited_at', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T2', body_md: 'B2', tag: 'career' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread.title).toBe('T2');
    expect(body.thread.tag).toBe('career');
    expect(body.thread.editedAt).not.toBeNull();
  });

  it('non-author gets 403', async () => {
    const authorCookie = await authedCookie('a@x.com');
    const otherCookie = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: authorCookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: otherCookie },
      body: JSON.stringify({ title: 'hacked' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/community/threads/:id', () => {
  it('hard-deletes thread with no replies', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const exists = db.prepare('SELECT 1 FROM forum_threads WHERE id = ?').get(thread.id);
    expect(exists).toBeUndefined();
  });

  it('soft-deletes thread when replies exist', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    db.prepare(
      `INSERT INTO forum_replies (id, thread_id, author_id, body_md)
       VALUES ('r1', ?, 1, 'hi')`,
    ).run(thread.id);
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT deleted_at FROM forum_threads WHERE id = ?')
      .get(thread.id) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });

  it('non-author gets 403', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: b },
    });
    expect(res.status).toBe(403);
  });
});

describe('replies', () => {
  it('POST reply bumps last_activity_at and reply_count; auto-subscribes replier', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();

    db.prepare("UPDATE forum_threads SET last_activity_at = '2000-01-01 00:00:00' WHERE id = ?")
      .run(thread.id);

    const res = await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: b },
      body: JSON.stringify({ body_md: 'nice post' }),
    });
    expect(res.status).toBe(201);
    const { reply } = await res.json();
    expect(reply.body_md).toBe('nice post');

    const row = db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(thread.id) as {
      reply_count: number; last_activity_at: string;
    };
    expect(row.reply_count).toBe(1);
    expect(row.last_activity_at > '2000-01-01 00:00:00').toBe(true);

    const sub = db.prepare('SELECT 1 FROM forum_subscriptions WHERE thread_id = ? AND user_id = 2')
      .get(thread.id);
    expect(sub).toBeDefined();
  });

  it('GET thread includes replies in chronological order', async () => {
    const a = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'first' }),
    });
    await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'second' }),
    });
    const detail = await (await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: a },
    })).json();
    expect(detail.replies.map((r: { body_md: string }) => r.body_md)).toEqual(['first', 'second']);
    expect(detail.replies[0].canEdit).toBe(true);
  });

  it('PUT reply: author-only edit sets edited_at; does not bump last_activity_at', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const { reply } = await (await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'orig' }),
    })).json();

    db.prepare("UPDATE forum_threads SET last_activity_at = '2000-01-01 00:00:00' WHERE id = ?")
      .run(thread.id);

    const forbid = await app.request(`/api/community/replies/${reply.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: b },
      body: JSON.stringify({ body_md: 'hacked' }),
    });
    expect(forbid.status).toBe(403);

    const edit = await app.request(`/api/community/replies/${reply.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'updated' }),
    });
    expect(edit.status).toBe(200);
    const { reply: updated } = await edit.json();
    expect(updated.body_md).toBe('updated');
    expect(updated.editedAt).not.toBeNull();

    const activity = db.prepare('SELECT last_activity_at FROM forum_threads WHERE id = ?')
      .get(thread.id) as { last_activity_at: string };
    expect(activity.last_activity_at).toBe('2000-01-01 00:00:00');
  });

  it('DELETE reply: soft-delete strips body + author', async () => {
    const a = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const { reply } = await (await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ body_md: 'gone soon' }),
    })).json();
    const del = await app.request(`/api/community/replies/${reply.id}`, {
      method: 'DELETE', headers: { Cookie: a },
    });
    expect(del.status).toBe(200);

    const detail = await (await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: a },
    })).json();
    expect(detail.replies[0].body_md).toBe('[deleted]');
    expect(detail.replies[0].author).toBeNull();
    expect(detail.replies[0].deletedAt).not.toBeNull();
  });
});

describe('views + trending + tag filter', () => {
  it('GET thread records a view; dedups within 24h', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();

    await app.request(`/api/community/threads/${thread.id}`, { headers: { Cookie: b } });
    await app.request(`/api/community/threads/${thread.id}`, { headers: { Cookie: b } });
    const view1 = (db.prepare('SELECT COUNT(*) AS n FROM forum_thread_views WHERE thread_id = ?')
      .get(thread.id) as { n: number }).n;
    expect(view1).toBe(1);

    await app.request(`/api/community/threads/${thread.id}`, { headers: { Cookie: a } });
    const view2 = (db.prepare('SELECT COUNT(*) AS n FROM forum_thread_views WHERE thread_id = ?')
      .get(thread.id) as { n: number }).n;
    expect(view2).toBe(2);
  });

  it('filter=trending returns threads in score order within 7-day window', async () => {
    const a = await authedCookie('a@x.com');
    const { thread: hot } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'Hot', body_md: 'x', tag: 'dsa' }),
    })).json();
    const { thread: cold } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'Cold', body_md: 'y', tag: 'dsa' }),
    })).json();
    const { thread: stale } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'Stale', body_md: 'z', tag: 'dsa' }),
    })).json();

    db.prepare('UPDATE forum_threads SET reply_count = 20 WHERE id = ?').run(hot.id);
    db.prepare("UPDATE forum_threads SET last_activity_at = datetime('now', '-10 days') WHERE id = ?")
      .run(stale.id);

    const res = await app.request('/api/community/threads?filter=trending', {
      headers: { Cookie: a },
    });
    const body = await res.json();
    const ids = body.threads.map((t: { id: string }) => t.id);
    expect(ids).toContain(hot.id);
    expect(ids).toContain(cold.id);
    expect(ids).not.toContain(stale.id);
    expect(ids[0]).toBe(hot.id);
  });

  it('tag filter narrows results', async () => {
    const a = await authedCookie('a@x.com');
    const { thread: tDsa } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'DSA', body_md: 'x', tag: 'dsa' }),
    })).json();
    const { thread: tCareer } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'CAREER', body_md: 'y', tag: 'career' }),
    })).json();

    const res = await app.request('/api/community/threads?tag=dsa', { headers: { Cookie: a } });
    const ids = (await res.json()).threads.map((t: { id: string }) => t.id);
    expect(ids).toContain(tDsa.id);
    expect(ids).not.toContain(tCareer.id);
  });
});

describe('subscribe / unsubscribe', () => {
  it('subscribe is idempotent; unsubscribe is idempotent', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();

    const s1 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'POST', headers: { Cookie: b },
    });
    expect(s1.status).toBe(200);
    const s2 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'POST', headers: { Cookie: b },
    });
    expect(s2.status).toBe(200);
    const count1 = (db.prepare('SELECT COUNT(*) AS n FROM forum_subscriptions WHERE user_id = 2')
      .get() as { n: number }).n;
    expect(count1).toBe(1);

    const u1 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'DELETE', headers: { Cookie: b },
    });
    expect(u1.status).toBe(200);
    const u2 = await app.request(`/api/community/threads/${thread.id}/subscribe`, {
      method: 'DELETE', headers: { Cookie: b },
    });
    expect(u2.status).toBe(200);
    const count2 = (db.prepare('SELECT COUNT(*) AS n FROM forum_subscriptions WHERE user_id = 2')
      .get() as { n: number }).n;
    expect(count2).toBe(0);
  });

  it('filter=subscribed returns only threads the caller subscribes to', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread: ta } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'A', body_md: 'x', tag: 'dsa' }),
    })).json();
    const { thread: tb } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: b },
      body: JSON.stringify({ title: 'B', body_md: 'y', tag: 'career' }),
    })).json();

    const res = await app.request('/api/community/threads?filter=subscribed', {
      headers: { Cookie: a },
    });
    const body = await res.json();
    const ids = body.threads.map((t: { id: string }) => t.id);
    expect(ids).toContain(ta.id);
    expect(ids).not.toContain(tb.id);
  });
});

describe('soft-delete invariants (regression)', () => {
  it('hard-deletes thread whose only reply was soft-deleted', async () => {
    const cookie = await authedCookie('a@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    const { reply } = await (await app.request(`/api/community/threads/${thread.id}/replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ body_md: 'gone' }),
    })).json();
    await app.request(`/api/community/replies/${reply.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });

    const res = await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe('hard');
    const exists = db.prepare('SELECT 1 FROM forum_threads WHERE id = ?').get(thread.id);
    expect(exists).toBeUndefined();
  });

  it('strips author from soft-deleted thread on detail and list', async () => {
    const a = await authedCookie('a@x.com');
    const b = await authedCookie('b@x.com');
    const { thread } = await (await app.request('/api/community/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a },
      body: JSON.stringify({ title: 'T', body_md: 'B', tag: 'dsa' }),
    })).json();
    db.prepare(
      `INSERT INTO forum_replies (id, thread_id, author_id, body_md) VALUES ('r1', ?, 1, 'hi')`,
    ).run(thread.id);
    await app.request(`/api/community/threads/${thread.id}`, {
      method: 'DELETE', headers: { Cookie: a },
    });

    const detail = await (await app.request(`/api/community/threads/${thread.id}`, {
      headers: { Cookie: b },
    })).json();
    expect(detail.thread.deletedAt).not.toBeNull();
    expect(detail.thread.author).toBeNull();
    expect(detail.thread.title).toBe('[deleted thread]');
  });
});
