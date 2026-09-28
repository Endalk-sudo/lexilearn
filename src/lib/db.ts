import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { resolveDbPath } from '@/db/env'

const globalForDb = globalThis as unknown as {
  sqlite: Database.Database | undefined
  db: ReturnType<typeof createDb> | undefined
}

function createDb() {
  const sqlite = globalForDb.sqlite ?? new Database(resolveDbPath())
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const d = drizzle(sqlite, { schema })
  // Cache in all environments — the HMR issue was that the old code only
  // cached in development, causing a new DB connection on every hot reload.
  // The globalThis cache prevents connection leaks across HMR cycles.
  globalForDb.sqlite = sqlite
  globalForDb.db = d
  return d
}

export const db = globalForDb.db ?? createDb()

