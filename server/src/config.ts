import { resolve } from 'path';

const REPO_ROOT = resolve(process.cwd(), '..');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  dbPath: process.env.DB_PATH ?? resolve(process.cwd(), 'study.db'),
  curriculumPath: process.env.CURRICULUM_PATH ?? resolve(REPO_ROOT, 'curriculum.json'),
  knowledgeBasePath: process.env.KNOWLEDGE_BASE_PATH ?? resolve(REPO_ROOT, 'knowledge-base.json'),
  clientDistPath: resolve(process.cwd(), '../client/dist'),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  baseUrl: (() => {
    const raw = process.env.BASE_URL;
    if (!raw || raw === '/' || !/^https?:\/\//.test(raw)) return 'http://localhost:3000';
    return raw;
  })(),
  CURRICULUM_JSON_VERSION: 1,
  KNOWLEDGE_BASE_VERSION: '3',
  PROXY_ALLOWLIST: new Set([
    'en.wikipedia.org',
    'www.geeksforgeeks.org', 'geeksforgeeks.org',
    'www.freecodecamp.org', 'freecodecamp.org',
    'raw.githubusercontent.com', 'github.com',
    'startupnextdoor.com', 'www.startupnextdoor.com',
    'www.bigocheatsheet.com', 'bigocheatsheet.com',
    'www.programiz.com', 'programiz.com',
    'www.topcoder.com', 'topcoder.com',
    'www.techinterviewhandbook.org', 'techinterviewhandbook.org',
  ]),
};
