import fs from 'node:fs'
import path from 'node:path'

/**
 * Resolve the SQLite database path without extra dependencies.
 * Priority: LEXILEARN_DB_URL (explicit override, e.g. for tests) > project-root
 * .env DATABASE_URL > ambient process.env > default.
 * Relative paths are always resolved against the project root (cwd), which
 * matches Next.js's dev server and all scripts.
 */
export function resolveDbPath(): string {
  const root = process.cwd()
  let url: string | undefined = process.env.LEXILEARN_DB_URL
  if (!url) {
    try {
      const raw = fs.readFileSync(path.join(root, '.env'), 'utf8')
      const line = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))
      if (line) url = line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
    } catch {
      // .env missing — fall through
    }
  }
  if (!url) url = process.env.DATABASE_URL || 'file:./db/custom.db'
  let p = url.replace(/^file:/, '')
  if (!path.isAbsolute(p)) p = path.resolve(root, p)
  return p
}
