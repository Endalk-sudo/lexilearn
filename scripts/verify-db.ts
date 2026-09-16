// Drizzle migration smoke test — exercises representative queries against the real DB.
// Run: npx tsx scripts/verify-db.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, lte, notExists, asc, like, sql } from 'drizzle-orm'
import { resolveDbPath } from '../src/db/env'
import * as s from '../src/db/schema'

const sqlite = new Database(resolveDbPath())
const db = drizzle(sqlite, { schema: s })

async function main() {
  const decks = await db.select().from(s.deck)
  console.log('decks:', decks.length, decks.map((d) => d.name).join(' | '))

  const words = await db.select().from(s.word).limit(3)
  console.log('word sample:', words[0]?.word, '| createdAt is Date:', words[0]?.createdAt instanceof Date, '| value:', words[0]?.createdAt)

  const wSrs = await db.select({ w: s.word, srs: s.srsCard }).from(s.word).leftJoin(s.srsCard, eq(s.srsCard.wordId, s.word.id)).limit(3)
  console.log('word+srs join rows:', wSrs.length, '| first has srs:', !!wSrs[0]?.srs)

  const due = await db.$count(s.srsCard, lte(s.srsCard.nextReview, new Date()))
  console.log('due cards count:', due)

  const dueCards = await db.select({ c: s.srsCard, w: s.word }).from(s.srsCard)
    .innerJoin(s.word, eq(s.srsCard.wordId, s.word.id))
    .where(lte(s.srsCard.nextReview, new Date()))
    .orderBy(asc(s.srsCard.nextReview)).limit(3)
  console.log('due cards fetched:', dueCards.length, '| first word:', dueCards[0]?.w.word)

  const noSrs = await db.$count(s.word, notExists(db.select({ d: sql`1` }).from(s.srsCard).where(eq(s.srsCard.wordId, s.word.id))))
  console.log('new words (no srs card):', noSrs)

  const searched = await db.select().from(s.word).where(like(s.word.word, '%a%')).limit(3)
  console.log('search (contains "a"):', searched.length > 0 ? 'ok' : 'EMPTY')

  const stats = await db.select().from(s.appStat).limit(6)
  console.log('app stats keys:', stats.map((x) => x.key).join(','))

  const profile = await db.select().from(s.mentorProfile).where(eq(s.mentorProfile.id, 1)).get()
  console.log('mentor profile:', profile ? 'exists' : 'none (seeded lazily at runtime)')

  const branch = await db.query.mentorBranch.findFirst({ with: { project: true, nodes: { with: { attempts: { with: { feedback: true } } } } } })
  console.log('mentor branch RQB:', branch ? `${branch.title} | project=${branch.project?.name} | nodes=${branch.nodes.length}` : 'none yet')

  console.log('ALL SMOKE TESTS PASSED')
  sqlite.close()
}

main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1) })
