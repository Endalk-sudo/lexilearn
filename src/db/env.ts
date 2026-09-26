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

  // Refuse a database that lives inside the build output. The tracer copies the
  // project into .next/standalone, so `.next/standalone/db/custom.db` is a
  // build-time *snapshot*. A server started from that directory resolves
  // relative to its own cwd and would silently read and write the snapshot,
  // diverging from the real study database with no visible error. Failing loudly
  // is far better than quietly teaching on last month's progress.
  //
  // Only .next/ is rejected: an absolute path outside the project root is a
  // legitimate override (LEXILEARN_DB_URL is how scripts/e2e-isolated.sh points
  // the server at a throwaway clone in $TMPDIR).
  const rel = path.relative(root, p)
  if (rel === '.next' || rel.startsWith(`.next${path.sep}`)) {
    throw new Error(
      `Refusing to use a database inside the build output (got "${p}"). ` +
      'Run the server from the project root, or set LEXILEARN_DB_URL to a path ' +
      'outside .next/. A .next/** path almost certainly means you started the ' +
      'standalone server from .next/standalone, where a stale copy of your ' +
      'database was bundled.'
    )
  }

  return p
}
