import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createDb } from './db/client.js';
import { loadCurriculum } from './curriculum/loader.js';
import { makeAuthRouter } from './routes/auth.js';
import { makeCurriculumRouter } from './routes/curriculum.js';
import { makeProgressRouter } from './routes/progress.js';
import { makeNotesRouter } from './routes/notes.js';
import { makeProxyRouter } from './routes/proxy.js';
import { makeUserRouter } from './routes/user.js';
import { makePracticeRouter } from './routes/practice.js';
import { makeMockInterviewsRouter } from './routes/mock-interviews.js';
import { makeAdminRouter } from './routes/admin.js';
import { config } from './config.js';

const db = createDb();
const curriculumIndex = loadCurriculum();
const serveBuiltClient = process.env.NODE_ENV !== 'development';

// Populate PROXY_ALLOWLIST from knowledge-base.json source URLs at startup.
// LeetCode is explicitly excluded per spec.
for (const topic of curriculumIndex.allTopics) {
  const srcUrl = (topic as any).source_url ?? '';
  if (!srcUrl) continue;
  try {
    const hostname = new URL(srcUrl).hostname.toLowerCase();
    if (!hostname.includes('leetcode')) {
      config.PROXY_ALLOWLIST.add(hostname);
      config.PROXY_ALLOWLIST.add(hostname.replace(/^www\./, ''));
    }
  } catch { /* skip malformed URLs */ }
}

const app = new Hono();
app.use('*', logger());

app.route('/api/auth', makeAuthRouter(db));
app.route('/api', makeCurriculumRouter(db, curriculumIndex));
app.route('/api/progress', makeProgressRouter(db, curriculumIndex));
app.route('/api/notes', makeNotesRouter(db));
app.route('/api/proxy', makeProxyRouter());
app.route('/api/user', makeUserRouter(db));
app.route('/api/practice/mock-interviews', makeMockInterviewsRouter(db));
app.route('/api/practice', makePracticeRouter(db));
app.route('/api/admin', makeAdminRouter(db));

if (serveBuiltClient) {
  app.use('/*', serveStatic({ root: config.clientDistPath }));
  app.get('/*', serveStatic({ path: `${config.clientDistPath}/index.html` }));
}

app.notFound((c) => {
  if (!serveBuiltClient && !c.req.path.startsWith('/api')) {
    return c.text(
      'Development API server is running on http://localhost:3000. Use http://localhost:5173 for the frontend.',
      404,
    );
  }

  return c.json({ error: 'Not Found' }, 404);
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
