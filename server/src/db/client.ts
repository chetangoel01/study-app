import Database from 'better-sqlite3';
import { resolve } from 'path';
import { applySchema } from './schema.js';

export function createDb(path?: string): Database.Database {
  const dbPath = path ?? process.env.DB_PATH ?? resolve(process.cwd(), 'study.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applySchema(db);
  return db;
}
