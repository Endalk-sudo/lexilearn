// Server-side statistics: dashboard + analytics builders, plus the tiny
// key/value app-stat helpers shared with the API route.
//
// Split out of route.ts (N5) so the route file stays a thin action router.
// All queries here are range-bounded or aggregated in SQL — never full-table
// scans shipped to JS (W7).

import { db } from '@/lib/db'
import { deck, word, srsCard, reviewLog, quizSession, appStat } from '@/db/schema'
import { eq, gte, lt, lte, and, notExists, desc, sql } from 'drizzle-orm'
import { dayKey, startOfDay, addDays } from '@/lib/date'
import { GRADE_XP, getLevel } from '@/lib/srs'

// ---------- App-stat key/value store ----------

export async function getStat(key: string, fallback = ''): Promise<string> {
  const row = await db.select().from(appStat).where(eq(appStat.key, key)).get()
  return row?.value ?? fallback
}

export async function setStat(key: string, value: string): Promise<void> {
  await db.insert(appStat).values({ key, value }).onConflictDoUpdate({ target: appStat.key, set: { value } })
}

/** Drizzle equivalent of Prisma's `where: { srsCard: null }` (words without an SRS card). */
export function wordHasNoSrsCard() {
  return notExists(db.select({ d: sql`1` }).from(srsCard).where(eq(srsCard.wordId, word.id)))
}

// ---------- Heatmap ----------

/**
 * The 53-week contribution window, Sunday-aligned, ending on the current
 * week's Saturday — the same shape GitHub uses.
 */
export function heatmapWindow() {
  const today = startOfDay(new Date())
  const endOfGrid = addDays(today, 6 - today.getDay())
  const startOfGrid = addDays(endOfGrid, -(53 * 7 - 1))
  return { startOfGrid, endOfGrid }
}

/**
 * Sparse contribution calendar: only the days that actually have activity,
 * inside the 53-week window, oldest first. Callers must bound `logs` to the
 * window with a range query (W7) — the grid is rebuilt client-side.
 */
function buildHeatmap(logs: { reviewedAt: Date; isCorrect: boolean }[]) {
  const { startOfGrid, endOfGrid } = heatmapWindow()
  const windowStart = dayKey(startOfGrid)
  const windowEnd = dayKey(endOfGrid)
  const byDay = new Map<string, { date: string; count: number; correct: number }>()
  for (const log of logs) {
    const key = dayKey(log.reviewedAt)
    if (key < windowStart || key > windowEnd) continue
    const entry = byDay.get(key) ?? { date: key, count: 0, correct: 0 }
    entry.count += 1
    if (log.isCorrect) entry.correct += 1
    byDay.set(key, entry)
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ---------- Dashboard ----------

export async function getDashboardStats() {
  const now = new Date()
  const startOfToday = startOfDay(new Date())
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const { startOfGrid } = heatmapWindow()

  const [dueCount, newCardsCount, todayLogs, mastered, learning, reviewing, totalWords, heatmapLogs, dueHorizon] = await Promise.all([
    db.$count(srsCard, lte(srsCard.nextReview, now)),
    db.$count(word, wordHasNoSrsCard()),
    db.select().from(reviewLog).where(and(gte(reviewLog.reviewedAt, startOfToday), lte(reviewLog.reviewedAt, endOfToday))),
    db.$count(srsCard, eq(srsCard.status, 'mastered')),
    db.$count(srsCard, eq(srsCard.status, 'learning')),
    db.$count(srsCard, eq(srsCard.status, 'reviewing')),
    db.$count(word),
    // Heatmap: only the 53-week grid, never the entire review history (W7).
    db.select({ reviewedAt: reviewLog.reviewedAt, isCorrect: reviewLog.isCorrect })
      .from(reviewLog).where(gte(reviewLog.reviewedAt, startOfGrid)),
    // One range query replaces the old seven per-day forecast queries (W7).
    db.select({ nextReview: srsCard.nextReview })
      .from(srsCard).where(lt(srsCard.nextReview, addDays(startOfToday, 7))),
  ])

  const streak = parseInt(await getStat('streak', '0'), 10) || 0
  const longestStreak = parseInt(await getStat('longestStreak', '0'), 10) || 0
  const totalXp = parseInt(await getStat('totalXp', '0'), 10) || 0
  const totalReviews = parseInt(await getStat('totalReviews', '0'), 10) || 0
  const totalCorrect = parseInt(await getStat('totalCorrect', '0'), 10) || 0
  const lastSessionDate = await getStat('lastSessionDate', '')
  const streakShieldUsedDate = await getStat('streakShieldUsedDate', '')
  const challengeClaimedDate = await getStat('challengeClaimedDate', '')
  // XP and correct-counts come from the review log alone: every quiz answer
  // (and dictation/learn/review attempt) is logged per question, so adding the
  // quizSession totals here would double-count them (W1).
  const todayCorrect = todayLogs.filter((l) => l.isCorrect).length
  const xpToday = todayLogs.reduce((sum, l) => sum + ((GRADE_XP as Record<number, number>)[l.grade] ?? 0), 0)
  const dailyGoal = parseInt(await getStat('dailyGoal', '20'), 10) || 20
  const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0

  const { level, nextLevel, pct: levelPct } = getLevel(totalXp)

  // 7-day forecast: bucket every card due before day+7 into its local day;
  // overdue cards count toward today (same semantics as the old per-day loop).
  const buckets = new Map<string, number>()
  for (let i = 0; i < 7; i++) buckets.set(dayKey(addDays(startOfToday, i)), 0)
  const today = dayKey(startOfToday)
  for (const r of dueHorizon) {
    const k = dayKey(r.nextReview)
    const key = buckets.has(k) ? k : today // past-due → today
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const forecast = [...buckets].map(([date, count]) => ({ date, count }))

  const heatmap = buildHeatmap(heatmapLogs)

  let streakGap = 0
  let streakShieldCooldownDays = 0
  if (lastSessionDate) {
    const last = new Date(lastSessionDate + 'T00:00:00')
    const nowDay = new Date()
    nowDay.setHours(0, 0, 0, 0)
    streakGap = Math.max(0, Math.round((nowDay.getTime() - last.getTime()) / 86_400_000))
  }
  if (streakShieldUsedDate) {
    const used = new Date(streakShieldUsedDate + 'T00:00:00')
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    streakShieldCooldownDays = Math.max(0, 7 - Math.round((todayDate.getTime() - used.getTime()) / 86_400_000))
  }

  return {
    dueCount,
    newCount: newCardsCount,
    learnedToday: todayLogs.length,
    streak,
    longestStreak,
    lastSessionDate,
    streakShieldAvailable: !!lastSessionDate && streak > 0 && streakGap > 1 && streakShieldCooldownDays === 0,
    streakGap,
    streakShieldCooldownDays,
    todayCorrect,
    xpToday,
    challengeClaimedDate,
    totalXp,
    totalReviews,
    totalCorrect,
    accuracy,
    dailyGoal,
    masteredCount: mastered,
    learningCount: learning,
    reviewingCount: reviewing,
    totalWords,
    level,
    nextLevel,
    levelPct,
    nextReviewForecast: forecast,
    heatmap,
  }
}

// ---------- Analytics ----------

export async function getAnalytics() {
  const today = startOfDay(new Date())
  const weekStart = addDays(today, -6)
  const { startOfGrid } = heatmapWindow()

  const [
    deckRows, recentLogs, quizSessions, statusRows, deckWordCounts,
    deckStatusCounts, deckLogCounts, totalWords, newWords, gradeRows,
    heatmapLogs, weekLogs,
  ] = await Promise.all([
    db.select().from(deck),
    // Latest 100 only — the client renders the head of this feed (W4/W7).
    db.select().from(reviewLog).orderBy(desc(reviewLog.reviewedAt)).limit(100),
    db.select().from(quizSession).orderBy(desc(quizSession.completedAt)).limit(20),
    // Aggregates computed in SQL instead of loading every row into JS (W7):
    db.select({ status: srsCard.status, total: sql<number>`count(*)` }).from(srsCard).groupBy(srsCard.status),
    db.select({ deckId: word.deckId, total: sql<number>`count(*)` }).from(word).groupBy(word.deckId),
    db.select({ deckId: word.deckId, status: srsCard.status, total: sql<number>`count(*)` })
      .from(word).innerJoin(srsCard, eq(srsCard.wordId, word.id)).groupBy(word.deckId, srsCard.status),
    db.select({
      deckId: reviewLog.deckId,
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when "isCorrect" then 1 else 0 end)`,
    }).from(reviewLog).groupBy(reviewLog.deckId),
    db.$count(word),
    db.$count(word, wordHasNoSrsCard()),
    db.select({ grade: reviewLog.grade, total: sql<number>`count(*)` }).from(reviewLog).groupBy(reviewLog.grade),
    db.select({ reviewedAt: reviewLog.reviewedAt, isCorrect: reviewLog.isCorrect })
      .from(reviewLog).where(gte(reviewLog.reviewedAt, startOfGrid)),
    db.select({ reviewedAt: reviewLog.reviewedAt, isCorrect: reviewLog.isCorrect })
      .from(reviewLog).where(gte(reviewLog.reviewedAt, weekStart)),
  ])

  const totalReviews = parseInt(await getStat('totalReviews', '0'), 10) || 0
  const totalCorrect = parseInt(await getStat('totalCorrect', '0'), 10) || 0
  const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0
  const totalXp = parseInt(await getStat('totalXp', '0'), 10) || 0
  const streak = parseInt(await getStat('streak', '0'), 10) || 0
  const longestStreak = parseInt(await getStat('longestStreak', '0'), 10) || 0

  const statusCount = (s: string) => statusRows.find((r) => r.status === s)?.total ?? 0
  const mastered = statusCount('mastered')
  const learning = statusCount('learning')
  const reviewing = statusCount('reviewing')

  const wordCountByDeck = new Map(deckWordCounts.map((r) => [r.deckId, r.total]))
  const statusByDeck = new Map<string, Record<string, number>>()
  for (const r of deckStatusCounts) {
    const rec = statusByDeck.get(r.deckId) ?? {}
    rec[r.status] = r.total
    statusByDeck.set(r.deckId, rec)
  }
  const logsByDeck = new Map(deckLogCounts.map((r) => [r.deckId, r]))

  const perDeck = deckRows.map((d) => {
    const total = wordCountByDeck.get(d.id) ?? 0
    const st = statusByDeck.get(d.id) ?? {}
    const cards = (st.mastered ?? 0) + (st.learning ?? 0) + (st.reviewing ?? 0)
    const logs = logsByDeck.get(d.id)
    return {
      id: d.id, name: d.name, total,
      mastered: st.mastered ?? 0, learning: st.learning ?? 0, reviewing: st.reviewing ?? 0,
      new: total - cards,
      accuracy: logs && logs.total > 0 ? Math.round((logs.correct / logs.total) * 100) : 0,
    }
  })

  const weekBuckets = new Map<string, { count: number; correct: number }>()
  for (let i = 6; i >= 0; i--) weekBuckets.set(dayKey(addDays(today, -i)), { count: 0, correct: 0 })
  for (const l of weekLogs) {
    const b = weekBuckets.get(dayKey(l.reviewedAt))
    if (!b) continue
    b.count += 1
    if (l.isCorrect) b.correct += 1
  }
  const weeklyActivity = [...weekBuckets].map(([date, b]) => ({ date, count: b.count, correct: b.correct }))

  // Sparse contribution calendar — the client rebuilds the 53-week grid.
  const heatmap = buildHeatmap(heatmapLogs)

  const gradeMap = new Map(gradeRows.map((r) => [r.grade, r.total]))
  const gradeDistribution = [0, 3, 4, 5].map((g) => ({ grade: g, count: gradeMap.get(g) ?? 0 }))

  return {
    totalReviews, totalCorrect, accuracy,
    masteredCount: mastered, learningCount: learning,
    reviewingCount: reviewing, newCount: newWords,
    totalWords, totalXp, streak, longestStreak,
    recentLogs: recentLogs.map((l) => ({
      id: l.id, word: l.word, grade: l.grade, mode: l.mode,
      isCorrect: l.isCorrect, reviewedAt: l.reviewedAt,
    })),
    perDeck, weeklyActivity, gradeDistribution, heatmap,
    quizSessions: quizSessions.map((q) => ({
      id: q.id, mode: q.mode, total: q.total, correct: q.correct,
      xpEarned: q.xpEarned, completedAt: q.completedAt,
    })),
  }
}
