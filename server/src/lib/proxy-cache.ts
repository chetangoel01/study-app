import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { LRUCache } from 'lru-cache';
import { config } from '../config.js';

const PRIVATE_RE = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0)/;
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const cache = new LRUCache<string, string>({ max: 150, ttl: 60 * 60 * 1000 });

export function isAllowedUrl(urlString: string): boolean {
  let url: URL;
  try { url = new URL(urlString); } catch { return false; }
  const h = url.hostname.toLowerCase();
  if (PRIVATE_RE.test(h)) return false;
  const bare = h.replace(/^www\./, '');
  return config.PROXY_ALLOWLIST.has(h) || config.PROXY_ALLOWLIST.has(bare) || config.PROXY_ALLOWLIST.has(`www.${bare}`);
}

export async function fetchAndExtract(urlString: string): Promise<string | null> {
  const cached = cache.get(urlString);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(urlString, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'study-app/1.0' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url: urlString });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;
    const md = turndown.turndown(article.content);
    cache.set(urlString, md);
    return md;
  } catch { return null; }
}
