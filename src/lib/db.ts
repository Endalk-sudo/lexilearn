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
  // NORMAL is the documented safe setting under WAL (FULL costs 2 fsyncs per
  // commit — every mutation paid that). Set explicitly: driver and OS
  // defaults vary, and this connection is the whole database.
  sqlite.pragma('synchronous = NORMAL')
  // A second writer (double-clicked submit, SW retry racing a POST) must wait,
  // not fail instantly with SQLITE_BUSY.
  sqlite.pragma('busy_timeout = 5000')
  // Dashboard/analytics aggregations and search/deck loads re-scan large ranges;
  // the 2 MB default thrashed the page cache on every one.
  sqlite.pragma('cache_size = -64000')
  // GROUP BY / ORDER BY spill files are pure overhead on a local disk-backed
  // app — sort in memory instead.
  sqlite.pragma('temp_store = MEMORY')
  // Long-lived local servers grow -wal/-shm without bound (every answer is a
  // reviewLog insert); cap it so a restart never replays a giant WAL.
  sqlite.pragma('journal_size_limit = 67108864')
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

