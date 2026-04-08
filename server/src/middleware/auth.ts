import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyAccessToken } from '../lib/jwt.js';

export interface AuthUser { id: number; email: string; }

declare module 'hono' {
  interface ContextVariableMap { user: AuthUser; }
}

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const token = getCookie(c, 'access_token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifyAccessToken(token);
    c.set('user', { id: Number(payload.sub), email: payload.email });
    return next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}
