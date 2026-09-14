// Backfill some sample historical review logs so the contribution calendar
// shows activity. This is for demo/verification purposes only.
//
// Run: bun run scripts/backfill-activity.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const words = await db.word.findMany({ take: 50 })
  if (words.length === 0) {
    console.log('No words found. Run `bun run scripts/seed.ts` first.')
    return
  }

  // Clear existing logs (optional — comment out to keep)
  await db.reviewLog.deleteMany()

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

      await db.reviewLog.create({
        data: {
          wordId: word.id,
          word: word.word,
          deckId: word.deckId,
          grade,
          mode: 'review',
          isCorrect: grade >= 3,
          reviewedAt,
        },
      })
      totalLogs++
    }
  }

  // Update aggregate stats
  const totalReviews = await db.reviewLog.count()
  const totalCorrect = await db.reviewLog.count({ where: { isCorrect: true } })
  await db.appStat.upsert({ where: { key: 'totalReviews' }, update: { value: String(totalReviews) }, create: { key: 'totalReviews', value: String(totalReviews) } })
  await db.appStat.upsert({ where: { key: 'totalCorrect' }, update: { value: String(totalCorrect) }, create: { key: 'totalCorrect', value: String(totalCorrect) } })

  // Approximate XP: 1 for Again, 3 for Hard, 5 for Good, 8 for Easy
  const allLogs = await db.reviewLog.findMany()
  const xp = allLogs.reduce((sum, l) => sum + (l.grade === 0 ? 1 : l.grade === 3 ? 3 : l.grade === 4 ? 5 : 8), 0)
  await db.appStat.upsert({ where: { key: 'totalXp' }, update: { value: String(xp) }, create: { key: 'totalXp', value: String(xp) } })

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
  await db.appStat.upsert({ where: { key: 'streak' }, update: { value: String(streak) }, create: { key: 'streak', value: String(streak) } })
  await db.appStat.upsert({ where: { key: 'longestStreak' }, update: { value: String(Math.max(streak, 42)) }, create: { key: 'longestStreak', value: String(Math.max(streak, 42)) } })
  await db.appStat.upsert({ where: { key: 'lastSessionDate' }, update: { value: today.toISOString().slice(0, 10) }, create: { key: 'lastSessionDate', value: today.toISOString().slice(0, 10) } })

  console.log(`✅ Backfilled ${totalLogs} review logs across ~10 months`)
  console.log(`   Total reviews: ${totalReviews}`)
  console.log(`   Total XP: ${xp}`)
  console.log(`   Current streak: ${streak} days`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
