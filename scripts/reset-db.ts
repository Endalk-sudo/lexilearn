// Delete the local SQLite database and its WAL sidecars.
// Run with: npm run db:reset   (recreates the schema afterwards)
//
// Honors LEXILEARN_DB_URL / .env DATABASE_URL via the same resolver the app and
// the e2e runner use, so it can never delete the wrong file.
import fs from 'node:fs'
import { resolveDbPath } from '../src/db/env'

const dbPath = resolveDbPath()
const removed: string[] = []

for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true })
    removed.push(file)
  }
}

if (removed.length === 0) {
  console.log(`Nothing to remove at ${dbPath}`)
} else {
  console.log(`Removed:\n  ${removed.join('\n  ')}`)
}
