// LexiLearn API routes — all server-side logic lives here.
// Single file with route handlers; called from client via fetch().

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateSm2, type Grade } from '@/lib/srs'
import { v4 as uuid } from 'uuid'

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

async function getStat(key: string, fallback = ''): Promise<string> {
  const row = await db.appStat.findUnique({ where: { key } })
  return row?.value ?? fallback
}

async function setStat(key: string, value: string): Promise<void> {
  await db.appStat.upsert({ where: { key }, update: { value }, create: { key, value } })
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
  const existing = await db.srsCard.findUnique({ where: { wordId } })
  const word = await db.word.findUnique({ where: { id: wordId } })
  if (!word) return

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

  await db.srsCard.upsert({
    where: { wordId },
    update: {
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      lastReviewed: updated.lastReviewed,
      nextReview: updated.nextReview,
      status: updated.status,
      totalReviews: updated.totalReviews,
      correctReviews: updated.correctReviews,
    },
    create: {
      wordId,
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

  await db.reviewLog.create({
    data: {
      wordId,
      word: word.word,
      deckId: word.deckId,
      grade,
      mode,
      isCorrect: grade >= 3,
    },
  })

  await updateStreakAndXp(grade)
}

async function createCustomDeck(name: string, description: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; amharic?: string }[]) {
  const deckId = uuid()
  const deck = await db.deck.create({ data: { id: deckId, name, description, isCustom: true } })

  for (const w of words) {
    if (!w.word || !w.word.trim()) continue
    await db.word.create({
      data: {
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
        deckId: deck.id,
      },
    })
  }
  return { id: deck.id, count: words.length }
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
  const words = await db.word.findMany({
    where: deckId ? { deckId } : {},
    include: { srsCard: true },
  })
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
    db.srsCard.count({ where: { nextReview: { lte: now } } }),
    db.word.count({ where: { srsCard: null } }),
    db.reviewLog.findMany({ where: { reviewedAt: { gte: startOfToday, lte: endOfToday } } }),
    db.srsCard.count({ where: { status: 'mastered' } }),
    db.srsCard.count({ where: { status: 'learning' } }),
    db.srsCard.count({ where: { status: 'reviewing' } }),
    db.word.count(),
    db.reviewLog.findMany({ orderBy: { reviewedAt: 'asc' } }),
  ])

  const streak = parseInt(await getStat('streak', '0'), 10) || 0
  const longestStreak = parseInt(await getStat('longestStreak', '0'), 10) || 0
  const totalXp = parseInt(await getStat('totalXp', '0'), 10) || 0
  const totalReviews = parseInt(await getStat('totalReviews', '0'), 10) || 0
  const totalCorrect = parseInt(await getStat('totalCorrect', '0'), 10) || 0
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
    const count = await db.srsCard.count({ where: { nextReview: { gte: d, lt: next } } })
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

  return {
    dueCount,
    newCount: newCardsCount,
    learnedToday: todayLogs.length,
    streak,
    longestStreak,
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
  const [decks, allLogsAsc, quizSessions, cards, totalWords, newWords] = await Promise.all([
    db.deck.findMany({ include: { words: { include: { srsCard: true } } } }),
    db.reviewLog.findMany({ orderBy: { reviewedAt: 'asc' } }),
    db.quizSession.findMany({ orderBy: { completedAt: 'desc' }, take: 20 }),
    db.srsCard.findMany(),
    db.word.count(),
    db.word.count({ where: { srsCard: null } }),
  ])
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
        const cards = await db.srsCard.findMany({
          where: { nextReview: { lte: now } },
          take: limit,
          orderBy: { nextReview: 'asc' },
          include: { word: true },
        })
        return NextResponse.json(cards.map((c) => ({ word: parseWord(c.word), srs: toSrsDto(c) })))
      }

      case 'new': {
        const words = await db.word.findMany({
          where: deckId ? { deckId } : {},
          take: limit * 3,
          orderBy: { createdAt: 'asc' },
          include: { srsCard: true },
        })
        const fresh = words.filter((w) => !w.srsCard).slice(0, limit)
        return NextResponse.json(fresh.map((w) => ({ word: parseWord(w), srs: null })))
      }

      case 'reviewable': {
        const words = await db.word.findMany({
          where: deckId ? { deckId } : {},
          take: limit * 2,
          orderBy: { createdAt: 'asc' },
          include: { srsCard: true },
        })
        const result: CardWithWord[] = []
        for (const w of words) {
          if (w.srsCard) {
            if (w.srsCard.nextReview <= new Date()) {
              result.push({ word: parseWord(w), srs: toSrsDto(w.srsCard) })
            }
          } else {
            result.push({ word: parseWord(w), srs: null })
          }
          if (result.length >= limit) break
        }
        return NextResponse.json(result)
      }

      case 'decks': {
        const decks = await db.deck.findMany({ orderBy: { createdAt: 'asc' }, include: { words: true } })
        return NextResponse.json(decks.map((d) => ({
          id: d.id, name: d.name, description: d.description,
          isCustom: d.isCustom, wordCount: d.words.length, createdAt: d.createdAt,
        })))
      }

      case 'deck': {
        if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 })
        const deck = await db.deck.findUnique({
          where: { id: deckId },
          include: { words: { include: { srsCard: true } } },
        })
        if (!deck) return NextResponse.json({ error: 'not found' }, { status: 404 })
        return NextResponse.json({
          id: deck.id, name: deck.name, description: deck.description,
          isCustom: deck.isCustom,
          words: deck.words.map((w) => ({ ...parseWord(w), srs: w.srsCard ? toSrsDto(w.srsCard) : null })),
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

      case 'ollamaStatus': {
        const { checkOllamaStatus } = await import('@/lib/ollama')
        const status = await checkOllamaStatus()
        return NextResponse.json(status)
      }

      case 'search': {
        if (!query.trim()) return NextResponse.json([])
        const words = await db.word.findMany({
          where: { word: { contains: query.toLowerCase() } },
          take: 20,
        })
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
        const deck = await db.deck.findUnique({ where: { id: deckId } })
        if (!deck) return NextResponse.json({ error: 'deck not found' }, { status: 404 })
        let count = 0
        for (const w of words) {
          if (!w.word || !w.word.trim()) continue
          await db.word.create({
            data: {
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
            },
          })
          count++
        }
        return NextResponse.json({ count })
      }

      case 'deleteDeck': {
        const { deckId: id } = body as { deckId: string }
        if (!id) return NextResponse.json({ error: 'deckId required' }, { status: 400 })
        await db.deck.delete({ where: { id } })
        return NextResponse.json({ ok: true })
      }

      case 'quizSession': {
        const { mode: qMode, total, correct, xpEarned } = body as any
        await db.quizSession.create({ data: { mode: qMode, total, correct, xpEarned, completedAt: new Date() } })
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
        const deck = await db.deck.findUnique({ where: { id: deckId } })
        if (!deck) return NextResponse.json({ error: 'deck not found' }, { status: 404 })
        const word = await db.word.create({
          data: {
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
          },
        })
        return NextResponse.json({ id: word.id })
      }

      case 'updateWord': {
        const { wordId, pos, ipa, definition, example, cefr, synonyms, antonyms, amharic } = body as any
        if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })
        const existing = await db.word.findUnique({ where: { id: wordId } })
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
        await db.word.update({ where: { id: wordId }, data })
        return NextResponse.json({ ok: true })
      }

      case 'deleteWord': {
        const { wordId } = body as { wordId: string }
        if (!wordId) return NextResponse.json({ error: 'wordId required' }, { status: 400 })
        await db.word.delete({ where: { id: wordId } })
        return NextResponse.json({ ok: true })
      }

      case 'reset': {
        await db.reviewLog.deleteMany()
        await db.quizSession.deleteMany()
        await db.srsCard.deleteMany()
        await db.appStat.deleteMany()
        const initialStats: Record<string, string> = {
          streak: '0', longestStreak: '0', lastSessionDate: '', totalXp: '0',
          dailyGoal: '20', ttsVoice: '', ttsRate: '1', theme: 'system',
          totalReviews: '0', totalCorrect: '0', achievements: '[]',
        }
        for (const [k, v] of Object.entries(initialStats)) {
          await db.appStat.create({ data: { key: k, value: v } })
        }
        return NextResponse.json({ ok: true })
      }

      case 'mentor': {
        const {
          MENTOR_SYSTEM,
          ollamaChat,
          buildPracticePrompt,
          buildWritingFeedbackPrompt,
          buildConversationSystem,
          buildExplainPrompt,
        } = await import('@/lib/ollama')

        const mode = body.mode as string
        if (!mode) return NextResponse.json({ error: 'mode required' }, { status: 400 })

        let responseText = ''

        if (mode === 'practice') {
          const words = (body.words || []) as { word: string; definition?: string; amharic?: string }[]
          const practiceType = body.practiceType || 'cloze'
          const userPrompt = buildPracticePrompt({
            words,
            type: practiceType,
            count: body.count || 5,
            level: body.level,
          })
          responseText = await ollamaChat([
            { role: 'system', content: MENTOR_SYSTEM },
            { role: 'user', content: userPrompt },
          ])
        } else if (mode === 'writing') {
          const text = body.text as string
          if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
          const userPrompt = buildWritingFeedbackPrompt(text, body.targetWords)
          responseText = await ollamaChat([
            { role: 'system', content: MENTOR_SYSTEM },
            { role: 'user', content: userPrompt },
          ])
        } else if (mode === 'conversation') {
          const scenario = body.scenario || 'Casual conversation practice'
          const prior = (body.messages || []) as { role: string; content: string }[]
          const system = buildConversationSystem(scenario, body.targetWords)
          const messages = [
            { role: 'system' as const, content: system },
            ...prior.map((m) => ({
              role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.content,
            })),
          ]
          if (body.start || prior.length === 0) {
            messages.push({
              role: 'user',
              content: 'Please start the conversation in character with a short, natural opening line and a question for me.',
            })
          }
          responseText = await ollamaChat(messages, { temperature: 0.8 })
        } else if (mode === 'explain') {
          const query = body.query as string
          if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })
          const userPrompt = buildExplainPrompt(query, body.context)
          responseText = await ollamaChat([
            { role: 'system', content: MENTOR_SYSTEM },
            { role: 'user', content: userPrompt },
          ])
        } else {
          return NextResponse.json({ error: 'unknown mentor mode' }, { status: 400 })
        }

        // Persist lightly (optional)
        try {
          await db.mentorSession.create({
            data: {
              mode,
              title: body.title || mode,
              prompt: JSON.stringify(body).slice(0, 2000),
              response: responseText.slice(0, 15000),
              metadata: body.metadata ? JSON.stringify(body.metadata) : null,
            },
          })
        } catch {
          // schema may not be migrated yet — ignore
        }

        return NextResponse.json({ response: responseText })
      }

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e: any) {
    console.error('API POST error:', e)
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 })
  }
}
