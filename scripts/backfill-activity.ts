// Backfill some sample historical review logs so the contribution calendar
// shows activity. This is for demo/verification purposes only.
//
// Run: npx tsx scripts/backfill-activity.ts

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { resolveDbPath } from '../src/db/env'
import * as schema from '../src/db/schema'

const sqlite = new Database(resolveDbPath())
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })
const { word, reviewLog, appStat } = schema

async function upsertStat(key: string, value: string) {
  await db.insert(appStat).values({ key, value }).onConflictDoUpdate({ target: appStat.key, set: { value } })
}

async function main() {
  const words = await db.select().from(word).limit(50)
  if (words.length === 0) {
    console.log('No words found. Run `pnpm db:seed` first.')
    return
  }

  // Clear existing logs (optional — comment out to keep)
  await db.delete(reviewLog)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate activity for the last ~10 months with varying density
  // Higher density in recent weeks, sparser further back
  let totalLogs = 0
  for (let daysAgo = 300; daysAgo >= 0; daysAgo--) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)

    // Probability of activity on a given day, decreasing with age
    // Recent 30 days: ~80% chance, 30-90 days: ~60%, 90-180: ~40%, 180+: ~25%
    let prob = 0.25
    if (daysAgo < 30) prob = 0.85
    else if (daysAgo < 90) prob = 0.65
    else if (daysAgo < 180) prob = 0.45

    if (Math.random() > prob) continue

    // Number of reviews that day: 2-25
    const count = Math.floor(Math.random() * 24) + 2

    for (let i = 0; i < count; i++) {
      const word = words[Math.floor(Math.random() * words.length)]
      const grade = [0, 3, 4, 5][Math.floor(Math.random() * 4)]
      const reviewedAt = new Date(date)
      reviewedAt.setHours(9 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0)

      await db.insert(reviewLog).values({
        wordId: word.id,
        word: word.word,
        deckId: word.deckId,
        grade,
        mode: 'review',
        isCorrect: grade >= 3,
        reviewedAt,
      })
      totalLogs++
    }
  }

  // Update aggregate stats
  const totalReviews = await db.$count(reviewLog)
  const totalCorrect = await db.$count(reviewLog, eq(reviewLog.isCorrect, true))
  await upsertStat('totalReviews', String(totalReviews))
  await upsertStat('totalCorrect', String(totalCorrect))

  // Approximate XP: 1 for Again, 3 for Hard, 5 for Good, 8 for Easy
  const allLogs = await db.select().from(reviewLog)
  const xp = allLogs.reduce((sum, l) => sum + (l.grade === 0 ? 1 : l.grade === 3 ? 3 : l.grade === 4 ? 5 : 8), 0)
  await upsertStat('totalXp', String(xp))

  // Streak: count consecutive days with activity ending today or yesterday
  const byDay = new Map<string, boolean>()
  for (const l of allLogs) {
    byDay.set(l.reviewedAt.toISOString().slice(0, 10), true)
  }
  let streak = 0
  const cursor = new Date(today)
  if (!byDay.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (byDay.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  await upsertStat('streak', String(streak))
  await upsertStat('longestStreak', String(Math.max(streak, 42)))
  await upsertStat('lastSessionDate', today.toISOString().slice(0, 10))

  console.log(`✅ Backfilled ${totalLogs} review logs across ~10 months`)
  console.log(`   Total reviews: ${totalReviews}`)
  console.log(`   Total XP: ${xp}`)
  console.log(`   Current streak: ${streak} days`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => { sqlite.close() })
