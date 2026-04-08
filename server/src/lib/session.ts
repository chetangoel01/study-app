import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const DAYS_30 = 30 * 86400 * 1000;

export function createSession(userId: number, db: Database.Database): string {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + DAYS_30).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return id;
}

export function isSessionValid(tokenId: string, db: Database.Database): boolean {
  const row = db
    .prepare("SELECT id FROM sessions WHERE id = ? AND revoked = 0 AND expires_at > datetime('now')")
    .get(tokenId);
  return row !== undefined;
}

export function getUserIdFromSession(tokenId: string, db: Database.Database): number | null {
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE id = ? AND revoked = 0 AND expires_at > datetime('now')")
    .get(tokenId) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

export function rotateSession(oldId: string, db: Database.Database): string | null {
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE id = ? AND revoked = 0 AND expires_at > datetime('now')")
    .get(oldId) as { user_id: number } | undefined;
  if (!row) return null;
  db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(oldId);
  return createSession(row.user_id, db);
}

export function revokeSession(tokenId: string, db: Database.Database): void {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(tokenId);
}

export function revokeAllUserSessions(userId: number, db: Database.Database): void {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(userId);
}
