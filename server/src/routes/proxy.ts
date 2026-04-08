import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { isAllowedUrl, fetchAndExtract } from '../lib/proxy-cache.js';

export function makeProxyRouter(): Hono {
  const router = new Hono();
  router.use('*', requireAuth);

  router.get('/', async (c) => {
    const url = c.req.query('url');
    if (!url) return c.json({ error: 'url parameter required' }, 400);
    if (!isAllowedUrl(url)) return c.json({ error: 'URL not permitted' }, 403);
    const markdown = await fetchAndExtract(url);
    if (!markdown) return c.json({ error: 'unavailable' }, 200);
    return c.json({ markdown });
  });

  return router;
}
