// LexiLearn API routes — all server-side logic lives here.
// Single file with route handlers; called from client via fetch().

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deck, word, srsCard, reviewLog, quizSession, appStat, mentorProject, mentorBranch, mentorNode, mentorAttempt, mentorErrorCard, mentorProfile, mentorSkillMastery, mentorKnowledge, pronunciationAttempt, naturalnessAttempt, mentorSession } from '@/db/schema'
import { eq, gt, gte, lt, lte, and, isNull, notExists, asc, desc, like, sql } from 'drizzle-orm'
import { calculateSm2, type Grade } from '@/lib/srs'
import { v4 as uuid } from 'uuid'
import { generateNextNode, evaluateAttempt, getMentorOverview, ensureMentorSeed, buildWeeklyCoachReport, evaluatePronunciation, evaluateNaturalness } from '@/features/coach/server/mentor-agent'

// ---------- Types ----------
export type WordDTO = {
  id: string
  word: string
  pos: string | null
  ipa: string | null
  syllables: string[]
  cefr: string | null
  definitions: { pos: string; text: string }[]
  examples: string[]
  synonyms: string[]
  antonyms: string[]
  etymology: string | null
  amharic: string | null
  deckId: string
}

export type SrsCardDTO = {
  wordId: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: Date
  lastReviewed: Date | null
  status: string
  totalReviews: number
  correctReviews: number
}

export type CardWithWord = {
  word: WordDTO
  srs: SrsCardDTO | null
}

// ---------- Helpers ----------
function parseWord(w: any): WordDTO {
  return {
    id: w.id,
    word: w.word,
    pos: w.pos,
    ipa: w.ipa,
    syllables: w.syllables ? safeParse(w.syllables, []) : [],
    cefr: w.cefr,
    definitions: w.definitions ? safeParse(w.definitions, []) : [],
    examples: w.examples ? safeParse(w.examples, []) : [],
    synonyms: w.synonyms ? safeParse(w.synonyms, []) : [],
    antonyms: w.antonyms ? safeParse(w.antonyms, []) : [],
    etymology: w.etymology,
    amharic: w.amharic,
    deckId: w.deckId,
  }
}

function safeParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T } catch { return fallback }
}

/** Drizzle equivalent of Prisma's `where: { srsCard: null }` (words without an SRS card). */
function wordHasNoSrsCard() {
  return notExists(db.select({ d: sql`1` }).from(srsCard).where(eq(srsCard.wordId, word.id)))
}

async function getStat(key: string, fallback = ''): Promise<string> {
  const row = await db.select().from(appStat).where(eq(appStat.key, key)).get()
  return row?.value ?? fallback
}

async function setStat(key: string, value: string): Promise<void> {
  await db.insert(appStat).values({ key, value }).onConflictDoUpdate({ target: appStat.key, set: { value } })
}

function toSrsDto(c: any): SrsCardDTO {
  return {
    wordId: c.wordId,
    easeFactor: c.easeFactor,
    interval: c.interval,
    repetitions: c.repetitions,
    nextReview: c.nextReview,
    lastReviewed: c.lastReviewed,
    status: c.status,
    totalReviews: c.totalReviews,
    correctReviews: c.correctReviews,
  }
}

async function updateStreakAndXp(grade: Grade) {
  const today = new Date().toISOString().slice(0, 10)
  const lastSession = await getStat('lastSessionDate', '')
  let streak = parseInt(await getStat('streak', '0'), 10) || 0
  let longest = parseInt(await getStat('longestStreak', '0'), 10) || 0

  if (lastSession !== today) {
    if (lastSession) {
      const last = new Date(lastSession + 'T00:00:00')
      const now = new Date(today + 'T00:00:00')
      const diff = Math.round((now.getTime() - last.getTime()) / 86_400_000)
      if (diff === 1) streak += 1
      else if (diff > 1) streak = 1
    } else {
      streak = 1
    }
    await setStat('lastSessionDate', today)
    await setStat('streak', String(streak))
    if (streak > longest) {
      longest = streak
      await setStat('longestStreak', String(longest))
    }
  }

  const xpDelta = grade >= 3 ? (grade === 5 ? 8 : grade === 4 ? 5 : 3) : 1
  const totalXp = (parseInt(await getStat('totalXp', '0'), 10) || 0) + xpDelta
  await setStat('totalXp', String(totalXp))

  const totalRev = (parseInt(await getStat('totalReviews', '0'), 10) || 0) + 1
  const totalCorrect = (parseInt(await getStat('totalCorrect', '0'), 10) || 0) + (grade >= 3 ? 1 : 0)
  await setStat('totalReviews', String(totalRev))
  await setStat('totalCorrect', String(totalCorrect))
}

async function submitReview(wordId: string, grade: Grade, mode: string = 'review') {
  const existing = await db.select().from(srsCard).where(eq(srsCard.wordId, wordId)).get()
  const wordRow = await db.select().from(word).where(eq(word.id, wordId)).get()
  if (!wordRow) return

  const baseCard = existing
    ? {
        easeFactor: existing.easeFactor,
        interval: existing.interval,
        repetitions: existing.repetitions,
        lastReviewed: existing.lastReviewed,
        totalReviews: existing.totalReviews,
        correctReviews: existing.correctReviews,
        status: existing.status,
        nextReview: existing.nextReview,
      }
    : {
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        lastReviewed: null,
        totalReviews: 0,
        correctReviews: 0,
        status: 'new' as const,
        nextReview: new Date(),
      }

  const updated = calculateSm2(baseCard as any, grade)

  await db.insert(srsCard).values({
    wordId,
    easeFactor: updated.easeFactor,
    interval: updated.interval,
    repetitions: updated.repetitions,
    lastReviewed: updated.lastReviewed,
    nextReview: updated.nextReview,
    status: updated.status,
    totalReviews: updated.totalReviews,
    correctReviews: updated.correctReviews,
  }).onConflictDoUpdate({
    target: srsCard.wordId,
    set: {
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      lastReviewed: updated.lastReviewed,
      nextReview: updated.nextReview,
      status: updated.status,
      totalReviews: updated.totalReviews,
      correctReviews: updated.correctReviews,
    },
  })

  await db.insert(reviewLog).values({
    wordId,
    word: wordRow.word,
    deckId: wordRow.deckId,
    grade,
    mode,
    isCorrect: grade >= 3,
  })

  await updateStreakAndXp(grade)
}

async function createCustomDeck(name: string, description: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; amharic?: string }[]) {
  const deckId = uuid()
  await db.insert(deck).values({ id: deckId, name, description, isCustom: true })

  for (const w of words) {
    if (!w.word || !w.word.trim()) continue
    await db.insert(word).values({
      id: uuid(),
      word: w.word.trim().toLowerCase(),
      pos: w.pos ?? null,
      ipa: w.ipa ?? null,
      definitions: w.definition ? JSON.stringify([{ pos: w.pos ?? 'n.', text: w.definition }]) : null,
      examples: w.example ? JSON.stringify([w.example]) : null,
      syllables: null,
      cefr: null,
      synonyms: null,
      antonyms: null,
      etymology: null,
      amharic: w.amharic ?? null,
      deckId: deckId,
    })
  }
  return { id: deckId, count: words.length }
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  while (copy.length && out.length < n) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

async function generateQuiz(deckId: string | null, mode: string, count: number) {
  const wordRows = await db.select({ w: word, srs: srsCard }).from(word).leftJoin(srsCard, eq(srsCard.wordId, word.id)).where(deckId ? eq(word.deckId, deckId) : undefined)
  const words = wordRows.map((r) => ({ ...r.w, srsCard: r.srs }))
  if (words.length < 4) return []

  const sample = pickRandom(words, Math.min(count, words.length))
  const questions: any[] = []

  for (const w of sample) {
    const wordDto = parseWord(w)
    const firstDef = wordDto.definitions[0]?.text ?? ''
    const allWords = words.map((x) => x.word)

    if (mode === 'mc') {
      const distractors = pickRandom(
        words.filter((x) => x.id !== w.id).map((x) => parseWord(x).definitions[0]?.text ?? '').filter(Boolean),
        3
      )
      const options = pickRandom([firstDef, ...distractors], 4)
      questions.push({
        id: uuid(), mode, prompt: `What does "${w.word}" mean?`,
        promptWord: wordDto, options, correctAnswer: firstDef, wordDTO: wordDto,
      })
    } else if (mode === 'reverse_mc') {
      const distractors = pickRandom(allWords.filter((x) => x !== w.word), 3)
      const options = pickRandom([w.word, ...distractors], 4)
      questions.push({
        id: uuid(), mode, prompt: `Which word means: "${firstDef}"?`,
        definition: firstDef, options, correctAnswer: w.word, wordDTO: wordDto,
      })
    } else if (mode === 'typing') {
      questions.push({
        id: uuid(), mode, prompt: `Type the word that means: "${firstDef}"`,
        definition: firstDef, correctAnswer: w.word.toLowerCase(), wordDTO: wordDto,
      })
    } else if (mode === 'spelling_bee') {
      questions.push({
        id: uuid(), mode, prompt: 'Listen and type the word you hear.',
        audioWord: w.word, promptWord: wordDto, correctAnswer: w.word.toLowerCase(), wordDTO: wordDto,
      })
    } else if (mode === 'speed_round') {
      const distractors = pickRandom(
        words.filter((x) => x.id !== w.id).map((x) => parseWord(x).definitions[0]?.text ?? '').filter(Boolean),
        3
      )
      const options = pickRandom([firstDef, ...distractors], 4)
      questions.push({
        id: uuid(), mode, prompt: `What does "${w.word}" mean?`,
        promptWord: wordDto, options, correctAnswer: firstDef, wordDTO: wordDto,
      })
    }
  }

  return questions
}

async function getDashboardStats() {
  const now = new Date()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const [dueCount, newCardsCount, todayLogs, mastered, learning, reviewing, totalWords, allLogs] = await Promise.all([
    db.$count(srsCard, lte(srsCard.nextReview, now)),
    db.$count(word, wordHasNoSrsCard()),
    db.select().from(reviewLog).where(and(gte(reviewLog.reviewedAt, startOfToday), lte(reviewLog.reviewedAt, endOfToday))),
    db.$count(srsCard, eq(srsCard.status, 'mastered')),
    db.$count(srsCard, eq(srsCard.status, 'learning')),
    db.$count(srsCard, eq(srsCard.status, 'reviewing')),
    db.$count(word),
    db.select().from(reviewLog).orderBy(asc(reviewLog.reviewedAt)),
  ])

  const streak = parseInt(await getStat('streak', '0'), 10) || 0
  const longestStreak = parseInt(await getStat('longestStreak', '0'), 10) || 0
  const totalXp = parseInt(await getStat('totalXp', '0'), 10) || 0
  const totalReviews = parseInt(await getStat('totalReviews', '0'), 10) || 0
  const totalCorrect = parseInt(await getStat('totalCorrect', '0'), 10) || 0
  const lastSessionDate = await getStat('lastSessionDate', '')
  const streakShieldUsedDate = await getStat('streakShieldUsedDate', '')
  const todayKey = new Date().toISOString().slice(0, 10)
  const challengeClaimedDate = await getStat('challengeClaimedDate', '')
  const todayQuizSessions = await db.select().from(quizSession).where(and(gte(quizSession.completedAt, startOfToday), lte(quizSession.completedAt, endOfToday)))
  const todayCorrect = todayLogs.filter((l) => l.isCorrect).length + todayQuizSessions.reduce((sum, q) => sum + q.correct, 0)
  const xpTodayFromReviews = todayLogs.reduce((sum, l) => sum + (l.grade === 5 ? 8 : l.grade === 4 ? 5 : l.grade >= 3 ? 3 : 1), 0)
  const xpToday = xpTodayFromReviews + todayQuizSessions.reduce((sum, q) => sum + q.xpEarned, 0)
  const dailyGoal = parseInt(await getStat('dailyGoal', '20'), 10) || 20
  const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0

  const LEVELS = [
    { name: 'Beginner', minXp: 0 },
    { name: 'Novice', minXp: 100 },
    { name: 'Intermediate', minXp: 300 },
    { name: 'Advanced', minXp: 700 },
    { name: 'Expert', minXp: 1500 },
    { name: 'Master', minXp: 3000 },
  ]
  let level = LEVELS[0]
  let nextLevel: { name: string; minXp: number } | null = null
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp >= LEVELS[i].minXp) {
      level = LEVELS[i]
      nextLevel = LEVELS[i + 1] ?? null
    }
  }
  const progressIntoLevel = totalXp - level.minXp
  const span = nextLevel ? nextLevel.minXp - level.minXp : 0
  const levelPct = nextLevel ? Math.min(100, Math.round((progressIntoLevel / span) * 100)) : 100

  const forecast: { date: string; count: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + i)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    const count = await db.$count(srsCard, and(gte(srsCard.nextReview, d), lt(srsCard.nextReview, next)))
    forecast.push({ date: d.toISOString().slice(0, 10), count })
  }

  const heatmap: { date: string; count: number; correct: number }[] = []
  const byDay = new Map<string, { count: number; correct: number }>()
  for (const log of allLogs) {
    const day = log.reviewedAt.toISOString().slice(0, 10)
    const entry = byDay.get(day) ?? { count: 0, correct: 0 }
    entry.count += 1
    if (log.isCorrect) entry.correct += 1
    byDay.set(day, entry)
  }
  // Full year (53 weeks × 7 days), aligned to week-start (Sunday)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find the Sunday of the current week, then go back 52 weeks
  const daysSinceSunday = today.getDay() // 0=Sun .. 6=Sat
  const endOfGrid = new Date(today)
  endOfGrid.setDate(today.getDate() - daysSinceSunday + 6) // upcoming Saturday
  const startOfGrid = new Date(endOfGrid)
  startOfGrid.setDate(endOfGrid.getDate() - (53 * 7 - 1))
  const totalDays = 53 * 7
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startOfGrid)
    d.setDate(startOfGrid.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const entry = byDay.get(key) ?? { count: 0, correct: 0 }
    heatmap.push({ date: key, count: entry.count, correct: entry.correct })
  }

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    streakShieldCooldownDays = Math.max(0, 7 - Math.round((today.getTime() - used.getTime()) / 86_400_000))
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

async function getAnalytics() {
  const [deckRows, allLogsAsc, quizSessions, cards, totalWords, newWords] = await Promise.all([
    db.select().from(deck),
    db.select().from(reviewLog).orderBy(asc(reviewLog.reviewedAt)),
    db.select().from(quizSession).orderBy(desc(quizSession.completedAt)).limit(20),
    db.select().from(srsCard),
    db.$count(word),
    db.$count(word, wordHasNoSrsCard()),
  ])
  // Attach words (+ their SRS cards) per deck so perDeck keeps its Prisma shape
  const wordsWithSrs = await db.select({ w: word, srs: srsCard }).from(word).leftJoin(srsCard, eq(srsCard.wordId, word.id))
  const wordsByDeck = new Map<string, any[]>()
  for (const r of wordsWithSrs) {
    const list = wordsByDeck.get(r.w.deckId) ?? []
    list.push({ ...r.w, srsCard: r.srs })
    wordsByDeck.set(r.w.deckId, list)
  }
  const decks = deckRows.map((d) => ({ ...d, words: (wordsByDeck.get(d.id) ?? []) }))
  // Recent 100 for the activity feed (desc order)
  const allLogs = [...allLogsAsc].reverse().slice(0, 100)

  const totalReviews = parseInt(await getStat('totalReviews', '0'), 10) || 0
  const totalCorrect = parseInt(await getStat('totalCorrect', '0'), 10) || 0
  const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0
  const totalXp = parseInt(await getStat('totalXp', '0'), 10) || 0
  const streak = parseInt(await getStat('streak', '0'), 10) || 0
  const longestStreak = parseInt(await getStat('longestStreak', '0'), 10) || 0

  const mastered = cards.filter((c) => c.status === 'mastered').length
  const learning = cards.filter((c) => c.status === 'learning').length
  const reviewing = cards.filter((c) => c.status === 'reviewing').length

  const perDeck = decks.map((d) => {
    const deckCards = d.words.map((w) => w.srsCard).filter(Boolean) as any[]
    const dMastered = deckCards.filter((c) => c.status === 'mastered').length
    const dLearning = deckCards.filter((c) => c.status === 'learning').length
    const dReviewing = deckCards.filter((c) => c.status === 'reviewing').length
    const dNew = d.words.length - deckCards.length
    const deckLogs = allLogs.filter((l) => l.deckId === d.id)
    const deckCorrect = deckLogs.filter((l) => l.isCorrect).length
    const deckAccuracy = deckLogs.length > 0 ? Math.round((deckCorrect / deckLogs.length) * 100) : 0
    return {
      id: d.id, name: d.name, total: d.words.length,
      mastered: dMastered, learning: dLearning, reviewing: dReviewing,
      new: dNew, accuracy: deckAccuracy,
    }
  })

  const weeklyActivity: { date: string; count: number; correct: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    const dayLogs = allLogsAsc.filter((l) => l.reviewedAt >= d && l.reviewedAt < next)
    weeklyActivity.push({
      date: d.toISOString().slice(0, 10),
      count: dayLogs.length,
      correct: dayLogs.filter((l) => l.isCorrect).length,
    })
  }

  // Full-year contribution calendar (53 weeks × 7 days, Sunday-aligned)
  const heatmapByDay = new Map<string, { count: number; correct: number }>()
  for (const log of allLogsAsc) {
    const day = log.reviewedAt.toISOString().slice(0, 10)
    const entry = heatmapByDay.get(day) ?? { count: 0, correct: 0 }
    entry.count += 1
    if (log.isCorrect) entry.correct += 1
    heatmapByDay.set(day, entry)
  }
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const daysSinceSunday = todayMidnight.getDay()
  const endOfGrid = new Date(todayMidnight)
  endOfGrid.setDate(todayMidnight.getDate() - daysSinceSunday + 6)
  const startOfGrid = new Date(endOfGrid)
  startOfGrid.setDate(endOfGrid.getDate() - (53 * 7 - 1))
  const heatmap: { date: string; count: number; correct: number }[] = []
  for (let i = 0; i < 53 * 7; i++) {
    const d = new Date(startOfGrid)
    d.setDate(startOfGrid.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const entry = heatmapByDay.get(key) ?? { count: 0, correct: 0 }
    heatmap.push({ date: key, count: entry.count, correct: entry.correct })
  }

  const gradeDistribution = [
    { grade: 0, count: allLogs.filter((l) => l.grade === 0).length },
    { grade: 3, count: allLogs.filter((l) => l.grade === 3).length },
    { grade: 4, count: allLogs.filter((l) => l.grade === 4).length },
    { grade: 5, count: allLogs.filter((l) => l.grade === 5).length },
  ]

  return {
    totalReviews, totalCorrect, accuracy,
    masteredCount: mastered, learningCount: learning,
    reviewingCount: reviewing, newCount: newWords,
    totalWords, totalXp, streak, longestStreak,
    recentLogs: allLogs.map((l) => ({
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

// ============================================================
//  GET /api/lexilearn?action=...
// ============================================================
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  const deckId = url.searchParams.get('deckId')
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)
  const mode = (url.searchParams.get('mode') as any) || 'mc'
  const count = parseInt(url.searchParams.get('count') || '10', 10)
  const query = url.searchParams.get('query') || ''

  try {
    switch (action) {
      case 'due': {
        const now = new Date()
        const rows = await db.select({ c: srsCard, w: word }).from(srsCard)
          .innerJoin(word, eq(srsCard.wordId, word.id))
          .where(lte(srsCard.nextReview, now))
          .orderBy(asc(srsCard.nextReview))
          .limit(limit)
        return NextResponse.json(rows.map((r) => ({ word: parseWord(r.w), srs: toSrsDto(r.c) })))
      }

      case 'new': {
        const rows = await db.select({ w: word, srs: srsCard }).from(word)
          .leftJoin(srsCard, eq(srsCard.wordId, word.id))
          .where(deckId ? eq(word.deckId, deckId) : undefined)
          .orderBy(asc(word.createdAt))
          .limit(limit * 3)
        const fresh = rows.filter((r) => !r.srs).slice(0, limit)
        return NextResponse.json(fresh.map((r) => ({ word: parseWord(r.w), srs: null })))
      }

      case 'reviewable': {
        const rows = await db.select({ w: word, srs: srsCard }).from(word)
          .leftJoin(srsCard, eq(srsCard.wordId, word.id))
          .where(deckId ? eq(word.deckId, deckId) : undefined)
          .orderBy(asc(word.createdAt))
          .limit(limit * 2)
        const result: CardWithWord[] = []
        for (const r of rows) {
          if (r.srs) {
            if (r.srs.nextReview <= new Date()) {
              result.push({ word: parseWord(r.w), srs: toSrsDto(r.srs) })
            }
          } else {
            result.push({ word: parseWord(r.w), srs: null })
          }
          if (result.length >= limit) break
        }
        return NextResponse.json(result)
      }

      case 'decks': {
        const deckRows = await db.select().from(deck).orderBy(asc(deck.createdAt))
        const counts = await db.select({ deckId: word.deckId, id: word.id }).from(word)
        const countByDeck = new Map<string, number>()
        for (const c of counts) countByDeck.set(c.deckId, (countByDeck.get(c.deckId) ?? 0) + 1)
        return NextResponse.json(deckRows.map((d) => ({
          id: d.id, name: d.name, description: d.description,
          isCustom: d.isCustom, wordCount: countByDeck.get(d.id) ?? 0, createdAt: d.createdAt,
        })))
      }

      case 'deck': {
        if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 })
        const deckRow = await db.select().from(deck).where(eq(deck.id, deckId)).get()
        if (!deckRow) return NextResponse.json({ error: 'not found' }, { status: 404 })
        const wordRows = await db.select({ w: word, srs: srsCard }).from(word)
          .leftJoin(srsCard, eq(srsCard.wordId, word.id))
          .where(eq(word.deckId, deckId))
          .orderBy(asc(word.createdAt))
        return NextResponse.json({
          id: deckRow.id, name: deckRow.name, description: deckRow.description,
          isCustom: deckRow.isCustom,
          words: wordRows.map((r) => ({ ...parseWord(r.w), srs: r.srs ? toSrsDto(r.srs) : null })),
        })
      }

      case 'dashboard': {
        const stats = await getDashboardStats()
        return NextResponse.json(stats)
      }

      case 'analytics': {
        const analytics = await getAnalytics()
        return NextResponse.json(analytics)
      }

      case 'settings': {
        return NextResponse.json({
          ttsVoice: await getStat('ttsVoice', ''),
          ttsRate: parseFloat(await getStat('ttsRate', '1')) || 1,
          dailyGoal: parseInt(await getStat('dailyGoal', '20'), 10) || 20,
          theme: await getStat('theme', 'system'),
        })
      }

      case 'quiz': {
        const questions = await generateQuiz(deckId, mode, count)
        return NextResponse.json(questions)
      }

      case 'mentorOverview': {
        const overview = await getMentorOverview()
        return NextResponse.json(overview)
      }

      case 'mentorBranch': {
        const branchId = url.searchParams.get('branchId')
        if (!branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })
        const branchRow = await db.query.mentorBranch.findFirst({ where: eq(mentorBranch.id, branchId), with: { project: true, nodes: { with: { attempts: { with: { feedback: true } } } } } })
        if (!branchRow) return NextResponse.json({ error: 'branch not found' }, { status: 404 })
        // RQB has no per-relation orderBy; mirror Prisma's asc sort in JS
        const branch = branchRow as any
        branch.nodes = [...(branch.nodes ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        for (const n of branch.nodes) n.attempts = [...(n.attempts ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return NextResponse.json(branch)
      }

      case 'mentorNodeNext': {
        const branchId = url.searchParams.get('branchId')
        if (!branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })
        const node = await generateNextNode(branchId)
        return NextResponse.json(node)
      }

      case 'mentorIndexKnowledge': {
        await ensureMentorSeed()
        const { ollamaEmbed } = await import('@/features/coach/server/ollama')
        const chunks = await db.select().from(mentorKnowledge).where(isNull(mentorKnowledge.embedding))
        let indexed = 0
        for (const c of chunks) {
          try { const [vec] = await ollamaEmbed(`${c.title}. ${c.content}`); if (vec?.length) { await db.update(mentorKnowledge).set({ embedding: JSON.stringify(vec) }).where(eq(mentorKnowledge.id, c.id)); indexed++ } } catch {}
        }
        return NextResponse.json({ ok:true, indexed, total:chunks.length })
      }

      case 'mentorDueErrors': {
        const errors = await db.select().from(mentorErrorCard).where(lte(mentorErrorCard.dueAt, new Date())).orderBy(asc(mentorErrorCard.dueAt)).limit(30)
        return NextResponse.json(errors)
      }

      case 'mentorProfile': {
        await ensureMentorSeed()
        const [profile, mastery] = await Promise.all([db.select().from(mentorProfile).where(eq(mentorProfile.id, 1)).get(), db.select().from(mentorSkillMastery).orderBy(asc(mentorSkillMastery.mastery))])
        return NextResponse.json({ profile, mastery })
      }

      case 'mentorWeeklyReport': {
        const result = await buildWeeklyCoachReport()
        return NextResponse.json(result)
      }

      case 'mentorPronunciationHistory': {
        const items = await db.select().from(pronunciationAttempt).orderBy(desc(pronunciationAttempt.createdAt)).limit(20)
        return NextResponse.json(items.map(x=>({id:x.id,target:x.target,transcript:x.transcript,accuracy:x.accuracy,missingWords:JSON.parse(x.missingWords||'[]'),extraWords:JSON.parse(x.extraWords||'[]'),feedback:JSON.parse(x.feedback||'{}'),createdAt:x.createdAt})))
      }

      case 'mentorNaturalnessHistory': {
        const items = await db.select().from(naturalnessAttempt).orderBy(desc(naturalnessAttempt.createdAt)).limit(20)
        return NextResponse.json(items.map(x=>({id:x.id,input:x.input,score:x.score,verdict:x.verdict,native:x.native,alternatives:JSON.parse(x.alternatives||'[]'),explanation:x.explanation,createdAt:x.createdAt})))
      }

      case 'ollamaStatus': {
        const { checkOllamaStatus } = await import('@/features/coach/server/ollama')
        const status = await checkOllamaStatus()
        return NextResponse.json(status)
      }

      case 'search': {
        if (!query.trim()) return NextResponse.json([])
        const words = await db.select().from(word)
          .where(like(word.word, `%${query.toLowerCase()}%`))
          .limit(20)
        return NextResponse.json(words.map(parseWord))
      }

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('API GET error:', e)
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 })
  }
}

// ============================================================
//  POST /api/lexilearn?action=...   body = JSON
// ============================================================
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  let body: any = {}
  try { body = await req.json() } catch {}

  try {
    switch (action) {
      case 'review': {
        const { wordId, grade, mode: reviewMode = 'review' } = body as { wordId: string; grade: Grade; mode?: string }
        if (!wordId || grade === undefined) return NextResponse.json({ error: 'wordId and grade required' }, { status: 400 })
        await submitReview(wordId, grade, reviewMode)
        return NextResponse.json({ ok: true })
      }

      case 'createDeck': {
        const { name, description, words } = body as { name: string; description?: string; words: any[] }
        if (!name || !Array.isArray(words)) return NextResponse.json({ error: 'name and words required' }, { status: 400 })
        const result = await createCustomDeck(name, description || '', words)
        return NextResponse.json(result)
      }

      case 'addWords': {
        const { deckId, words } = body as { deckId: string; words: any[] }
        if (!deckId || !Array.isArray(words) || words.length === 0) {
          return NextResponse.json({ error: 'deckId and words array required' }, { status: 400 })
        }
        const deckRow = await db.select().from(deck).where(eq(deck.id, deckId)).get()
        if (!deckRow) return NextResponse.json({ error: 'deck not found' }, { status: 404 })
        let count = 0
        for (const w of words) {
          if (!w.word || !w.word.trim()) continue
          await db.insert(word).values({
            id: uuid(),
            word: w.word.trim().toLowerCase(),
            pos: w.pos ?? null,
            ipa: w.ipa ?? null,
            definitions: w.definition ? JSON.stringify([{ pos: w.pos ?? 'n.', text: w.definition }]) : null,
            examples: w.example ? JSON.stringify([w.example]) : null,
            syllables: null,
            cefr: w.cefr ?? null,
            synonyms: w.synonyms ? JSON.stringify(w.synonyms.split('|').map((s: string) => s.trim()).filter(Boolean)) : null,
            antonyms: w.antonyms ? JSON.stringify(w.antonyms.split('|').map((s: string) => s.trim()).filter(Boolean)) : null,
            etymology: null,
            amharic: w.amharic ?? null,
            deckId,
          })
          count++
        }
        return NextResponse.json({ count })
      }

      case 'deleteDeck': {
        const { deckId: id } = body as { deckId: string }
        if (!id) return NextResponse.json({ error: 'deckId required' }, { status: 400 })
        await db.delete(deck).where(eq(deck.id, id))
        return NextResponse.json({ ok: true })
      }

      case 'quizSession': {
        const { mode: qMode, total, correct, xpEarned } = body as any
        await db.insert(quizSession).values({ mode: qMode, total, correct, xpEarned, completedAt: new Date() })
        const cur = parseInt(await getStat('totalXp', '0'), 10) || 0
        await setStat('totalXp', String(cur + (xpEarned || 0)))
        const rev = parseInt(await getStat('totalReviews', '0'), 10) || 0
        await setStat('totalReviews', String(rev + (total || 0)))
        const cor = parseInt(await getStat('totalCorrect', '0'), 10) || 0
        await setStat('totalCorrect', String(cor + (correct || 0)))
        const today = new Date().toISOString().slice(0, 10)
        const lastSession = await getStat('lastSessionDate', '')
        if (lastSession !== today) {
          let streak = parseInt(await getStat('streak', '0'), 10) || 0
          if (lastSession) {
            const last = new Date(lastSession + 'T00:00:00')
            const now = new Date(today + 'T00:00:00')
            const diff = Math.round((now.getTime() - last.getTime()) / 86_400_000)
            if (diff === 1) streak += 1
            else if (diff > 1) streak = 1
          } else {
            streak = 1
          }
          await setStat('lastSessionDate', today)
          await setStat('streak', String(streak))
          const longest = parseInt(await getStat('longestStreak', '0'), 10) || 0
          if (streak > longest) await setStat('longestStreak', String(streak))
        }
        return NextResponse.json({ ok: true })
      }

      case 'claimChallenge': {
        const { key } = body as { key?: string }
        const today = new Date().toISOString().slice(0, 10)
        const claimed = await getStat('challengeClaimedDate', '')
        if (claimed === today) return NextResponse.json({ ok: true, xpAwarded: 0, alreadyClaimed: true })
        const start = new Date(); start.setHours(0, 0, 0, 0)
        const end = new Date(); end.setHours(23, 59, 59, 999)
        const logs = await db.select().from(reviewLog).where(and(gte(reviewLog.reviewedAt, start), lte(reviewLog.reviewedAt, end)))
        const sessions = await db.select().from(quizSession).where(and(gte(quizSession.completedAt, start), lte(quizSession.completedAt, end)))
        const todayCorrect = logs.filter((l) => l.isCorrect).length + sessions.reduce((sum, q) => sum + q.correct, 0)
        const streak = parseInt(await getStat('streak', '0'), 10) || 0
        const targets: Record<string, { progress: number; target: number; reward: number }> = {
          sprint: { progress: logs.length, target: 10, reward: 35 },
          recall: { progress: todayCorrect, target: 8, reward: 40 },
          streak: { progress: streak > 0 ? 1 : 0, target: 1, reward: 25 },
        }
        const challenge = targets[key || '']
        if (!challenge || challenge.progress < challenge.target) return NextResponse.json({ error: 'Challenge is not complete yet' }, { status: 400 })
        const cur = parseInt(await getStat('totalXp', '0'), 10) || 0
        await setStat('totalXp', String(cur + challenge.reward))
        await setStat('challengeClaimedDate', today)
        return NextResponse.json({ ok: true, xpAwarded: challenge.reward, alreadyClaimed: false })
      }

      case 'repairStreak': {
        const today = new Date().toISOString().slice(0, 10)
        const lastSession = await getStat('lastSessionDate', '')
        const usedDate = await getStat('streakShieldUsedDate', '')
        if (!lastSession) return NextResponse.json({ ok: false, error: 'No streak shield available' }, { status: 400 })
        if (usedDate) {
          const used = new Date(usedDate + 'T00:00:00')
          const nowDay = new Date(today + 'T00:00:00')
          const cooldown = Math.max(0, 7 - Math.round((nowDay.getTime() - used.getTime()) / 86_400_000))
          if (cooldown > 0) return NextResponse.json({ ok: false, error: `Streak shield recharges in ${cooldown} day${cooldown === 1 ? '' : 's'}` }, { status: 400 })
        }
        const last = new Date(lastSession + 'T00:00:00')
        const now = new Date(today + 'T00:00:00')
        const diff = Math.round((now.getTime() - last.getTime()) / 86_400_000)
        if (diff <= 1) return NextResponse.json({ ok: false, error: 'Your streak does not need repair' }, { status: 400 })
        const streak = parseInt(await getStat('streak', '0'), 10) || 0
        const repaired = Math.max(1, streak + 1)
        await setStat('streak', String(repaired))
        const longest = parseInt(await getStat('longestStreak', '0'), 10) || 0
        if (repaired > longest) await setStat('longestStreak', String(repaired))
        await setStat('lastSessionDate', today)
        await setStat('streakShieldUsedDate', today)
        return NextResponse.json({ ok: true, streak: repaired })
      }

      case 'updateSettings': {
        const patch = body as any
        if (patch.ttsVoice !== undefined) await setStat('ttsVoice', patch.ttsVoice)
        if (patch.ttsRate !== undefined) await setStat('ttsRate', String(patch.ttsRate))
        if (patch.dailyGoal !== undefined) await setStat('dailyGoal', String(patch.dailyGoal))
        if (patch.theme !== undefined) await setStat('theme', patch.theme)
        return NextResponse.json({ ok: true })
      }

      case 'addWord': {
        const { deckId, word: wordText, pos, ipa, definition, example, cefr, synonyms, antonyms, amharic } = body as any
        if (!deckId || !wordText?.trim()) return NextResponse.json({ error: 'deckId and word required' }, { status: 400 })
        const deckRow = await db.select().from(deck).where(eq(deck.id, deckId)).get()
        if (!deckRow) return NextResponse.json({ error: 'deck not found' }, { status: 404 })
        const inserted = await db.insert(word).values({
          id: uuid(),
          word: wordText.trim().toLowerCase(),
          pos: pos ?? null,
          ipa: ipa ?? null,
          definitions: definition ? JSON.stringify([{ pos: pos ?? 'n.', text: definition }]) : null,
          examples: example ? JSON.stringify([example]) : null,
          syllables: null,
          cefr: cefr ?? null,
          synonyms: synonyms ? JSON.stringify(synonyms.split(',').map((s: string) => s.trim()).filter(Boolean)) : null,
          antonyms: antonyms ? JSON.stringify(antonyms.split(',').map((s: string) => s.trim()).filter(Boolean)) : null,
          etymology: null,
          amharic: amharic ?? null,
          deckId,
        }).returning({ id: word.id })
        return NextResponse.json({ id: inserted[0].id })
      }

      case 'updateWord': {
        const { wordId, pos, ipa, definition, example, cefr, synonyms, antonyms, amharic } = body as any
        if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })
        const existing = await db.select().from(word).where(eq(word.id, wordId)).get()
        if (!existing) return NextResponse.json({ error: 'word not found' }, { status: 404 })
        const data: any = {}
        if (pos !== undefined) data.pos = pos
        if (ipa !== undefined) data.ipa = ipa
        if (definition !== undefined) data.definitions = JSON.stringify([{ pos: pos ?? existing.pos ?? 'n.', text: definition }])
        if (example !== undefined) data.examples = example ? JSON.stringify([example]) : null
        if (cefr !== undefined) data.cefr = cefr
        if (synonyms !== undefined) data.synonyms = synonyms ? JSON.stringify(synonyms.split(',').map((s: string) => s.trim()).filter(Boolean)) : null
        if (antonyms !== undefined) data.antonyms = antonyms ? JSON.stringify(antonyms.split(',').map((s: string) => s.trim()).filter(Boolean)) : null
        if (amharic !== undefined) data.amharic = amharic
        await db.update(word).set(data).where(eq(word.id, wordId))
        return NextResponse.json({ ok: true })
      }

      case 'deleteWord': {
        const { wordId } = body as { wordId: string }
        if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })
        await db.delete(word).where(eq(word.id, wordId))
        return NextResponse.json({ ok: true })
      }

      case 'reset': {
        await db.delete(reviewLog)
        await db.delete(quizSession)
        await db.delete(srsCard)
        await db.delete(appStat)
        const initialStats: Record<string, string> = {
          streak: '0', longestStreak: '0', lastSessionDate: '', totalXp: '0',
          dailyGoal: '20', ttsVoice: '', ttsRate: '1', theme: 'system',
          totalReviews: '0', totalCorrect: '0', achievements: '[]', streakShieldUsedDate: '', challengeClaimedDate: '',
        }
        for (const [k, v] of Object.entries(initialStats)) {
          await db.insert(appStat).values({ key: k, value: v })
        }
        return NextResponse.json({ ok: true })
      }

      case 'mentorExplain': {
        const { buildExplainPrompt, ollamaChat, MENTOR_SYSTEM } = await import('@/features/coach/server/ollama')
        if (!body.query?.trim()) return NextResponse.json({ error:'query required' }, { status:400 })
        const response = await ollamaChat([{ role:'system', content:MENTOR_SYSTEM }, { role:'user', content:buildExplainPrompt(body.query.trim(), body.context) }])
        return NextResponse.json({ response })
      }

      case 'mentorProject': {
        const { name, goal } = body as { name: string; goal?: string }
        if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
        const projectRows = await db.insert(mentorProject).values({ name: name.trim(), goal: goal?.trim() || null }).returning()
        return NextResponse.json(projectRows[0])
      }

      case 'mentorBranch': {
        const { projectId, title, focusTag, mode = 'drill', difficultyCeiling = 3, locked = true } = body as any
        if (!projectId || !title || !focusTag) return NextResponse.json({ error: 'projectId, title and focusTag required' }, { status: 400 })
        const branchRows = await db.insert(mentorBranch).values({ projectId, title, focusTag, mode, difficultyCeiling, locked }).returning()
        return NextResponse.json(branchRows[0])
      }

      case 'mentorNext': {
        if (!body.branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })
        const node = await generateNextNode(body.branchId)
        return NextResponse.json(node)
      }

      case 'mentorWeeklyReport': {
        const result = await buildWeeklyCoachReport()
        return NextResponse.json(result)
      }

      case 'mentorPronunciation': {
        const { target, transcript } = body as any
        if (!target?.trim() || !transcript?.trim()) return NextResponse.json({error:'target and transcript required'},{status:400})
        return NextResponse.json(await evaluatePronunciation(target.trim(), transcript.trim()))
      }

      case 'mentorNaturalness': {
        const { input } = body as any
        if (!input?.trim()) return NextResponse.json({error:'input required'},{status:400})
        return NextResponse.json(await evaluateNaturalness(input.trim()))
      }

      case 'mentorAttempt': {
        const { nodeId, answer, confidence, timeMs, keystrokes, hintLevel = 0, selfCorrect } = body as any
        if (!nodeId || !answer?.trim()) return NextResponse.json({ error: 'nodeId and answer required' }, { status: 400 })
        const node = await db.select().from(mentorNode).where(eq(mentorNode.id, nodeId)).get()
        if (!node) return NextResponse.json({ error: 'node not found' }, { status: 404 })
        const attemptRows = await db.insert(mentorAttempt).values({ nodeId, branchId: node.branchId, answer: answer.trim(), confidence, timeMs, keystrokes, hintLevel, selfCorrect: selfCorrect ? String(selfCorrect) : null }).returning()
        const attempt = attemptRows[0]
        const result = await evaluateAttempt(attempt.id)
        return NextResponse.json({ attemptId: attempt.id, ...result })
      }

      case 'mentorHint': {
        const attemptNodeId = body.nodeId as string
        if (!attemptNodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
        const node = await db.select().from(mentorNode).where(eq(mentorNode.id, attemptNodeId)).get()
        if (!node) return NextResponse.json({ error: 'node not found' }, { status: 404 })
        const hints = JSON.parse(node.hints || '[]') as string[]
        const level = Math.min(Math.max(Number(body.level) || 1, 1), Math.max(hints.length, 1))
        return NextResponse.json({ action: 'hint', level, text: hints[level - 1] || hints[hints.length - 1] || 'Look again at the target skill.' })
      }

      case 'mentorSelfCorrect': {
        const attemptId = body.attemptId as string
        if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 })
        const { correction } = body
        const attemptRows = await db.update(mentorAttempt).set({ selfCorrect: correction || '' }).where(eq(mentorAttempt.id, attemptId)).returning()
        if (!attemptRows[0]) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })
        return NextResponse.json({ ok: true, selfCorrect: attemptRows[0].selfCorrect })
      }

      case 'mentorFork': {
        const { nodeId, title, focusTag, mode = 'scenario', difficultyCeiling = 3 } = body as any
        const node = await db.select().from(mentorNode).where(eq(mentorNode.id, nodeId)).get()
        if (!node) return NextResponse.json({ error: 'node not found' }, { status: 404 })
        const parentBranch = await db.select().from(mentorBranch).where(eq(mentorBranch.id, node.branchId)).get()
        if (!parentBranch) return NextResponse.json({ error: 'branch not found' }, { status: 404 })
        const branchRows = await db.insert(mentorBranch).values({ projectId: parentBranch.projectId, parentBranchId: node.branchId, parentNodeId: node.id, title: title || `Branch from node ${node.id.slice(-4)}`, focusTag: focusTag || JSON.parse(node.targetTags || '[]')[0] || 'naturalness', mode, difficultyCeiling, locked: true }).returning()
        return NextResponse.json(branchRows[0])
      }

      case 'mentor': {
        // Legacy free-form mentor modes remain available; the new agentic flow uses mentorNext/mentorAttempt.
        const { MENTOR_SYSTEM, ollamaChat, buildPracticePrompt, buildWritingFeedbackPrompt, buildConversationSystem, buildExplainPrompt } = await import('@/features/coach/server/ollama')
        const mode = body.mode as string
        if (!mode) return NextResponse.json({ error: 'mode required' }, { status: 400 })
        let responseText = ''
        if (mode === 'practice') {
          const userPrompt = buildPracticePrompt({ words: (body.words || []) as any, type: body.practiceType || 'cloze', count: body.count || 5, level: body.level })
          responseText = await ollamaChat([{ role:'system', content:MENTOR_SYSTEM }, { role:'user', content:userPrompt }])
        } else if (mode === 'writing') {
          if (!body.text?.trim()) return NextResponse.json({ error:'text required' }, { status:400 })
          responseText = await ollamaChat([{ role:'system', content:MENTOR_SYSTEM }, { role:'user', content:buildWritingFeedbackPrompt(body.text.trim(), body.targetWords) }])
        } else if (mode === 'conversation') {
          const system = buildConversationSystem(body.scenario || 'Casual conversation practice', body.targetWords)
          const prior = (body.messages || []) as {role:string;content:string}[]
          const messages:any[] = [{role:'system',content:system}, ...prior.map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}))]
          if (body.start || prior.length === 0) messages.push({role:'user', content:'Start with one short natural question and stay in character.'})
          responseText = await ollamaChat(messages, { temperature:0.8 })
        } else if (mode === 'explain') {
          if (!body.query?.trim()) return NextResponse.json({ error:'query required' }, { status:400 })
          responseText = await ollamaChat([{role:'system',content:MENTOR_SYSTEM},{role:'user',content:buildExplainPrompt(body.query.trim(),body.context)}])
        } else return NextResponse.json({ error:'unknown mentor mode' }, {status:400})
        await db.insert(mentorSession).values({ mode, title: body.title || mode, prompt: JSON.stringify(body).slice(0, 2000), response: responseText.slice(0, 15000), metadata: body.metadata ? JSON.stringify(body.metadata) : null }).catch(() => {})
        return NextResponse.json({response:responseText})
      }

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('API POST error:', e)
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 })
  }
}
