// LexiLearn API routes — all server-side logic lives here.
// Single file with route handlers; called from client via fetch().

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deck, category, wordCategory, word, srsCard, reviewLog, quizSession, appStat, errorLog, practiceMaterial, mentorProject, mentorBranch, mentorNode, mentorAttempt, mentorErrorCard, mentorProfile, mentorSkillMastery, mentorKnowledge, mentorWeeklyReport, mentorTurn, pronunciationAttempt, naturalnessAttempt, mentorSession } from '@/db/schema'
import { eq, gte, lte, and, isNull, asc, desc, sql, inArray, exists } from 'drizzle-orm'
import { calculateSm2, GRADE_XP, type Grade } from '@/lib/srs'
import { dayKey } from '@/lib/date'
import { createId } from '@/db/id'
import { z } from 'zod'
import type { WordDTO, SrsCardDTO, QuizMode, QuizQuestion, CategoryDTO } from '@/lib/api'
import { getStat, setStat, wordHasNoSrsCard, getDashboardStats, getAnalytics } from '@/server/stats'
import { assertSameOrigin } from '@/server/csrf'
import { isRateLimited } from '@/server/rate-limit'
import { generateNextNode, evaluateAttempt, getMentorOverview, ensureMentorSeed, buildWeeklyCoachReport, evaluatePronunciation, evaluateNaturalness } from '@/features/coach/server/mentor-agent'

// ---------- Helpers ----------
async function fetchCategoriesForWords(wordIds: string[]): Promise<Map<string, CategoryDTO[]>> {
  const map = new Map<string, CategoryDTO[]>()
  if (wordIds.length === 0) return map
  const rows = await db.select({
    wordId: wordCategory.wordId,
    id: category.id,
    name: category.name,
    color: category.color,
  }).from(wordCategory)
    .innerJoin(category, eq(wordCategory.categoryId, category.id))
    .where(inArray(wordCategory.wordId, wordIds))
    .orderBy(asc(category.name))

  for (const r of rows) {
    const list = map.get(r.wordId)
    const dto: CategoryDTO = { id: r.id, name: r.name, color: r.color }
    if (list) list.push(dto)
    else map.set(r.wordId, [dto])
  }
  return map
}

function parseWord(w: typeof word.$inferSelect, categories: CategoryDTO[] = []): WordDTO {
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
    categories,
  }
}

function safeParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T } catch { return fallback }
}

function toSrsDto(c: typeof srsCard.$inferSelect): SrsCardDTO {
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

function updateStreakAndXp(grade: Grade) {
  const today = dayKey(new Date())
  // Read-modify-write on AppStat, done synchronously inside one transaction.
  // better-sqlite3 is synchronous, so an `await` between the read and the write
  // yielded to the microtask queue and let two concurrent reviews read the same
  // totalXp — one increment then vanished. No awaits inside the callback, so
  // the whole read-modify-write commits atomically.
  db.transaction((tx) => {
    const get = (key: string, fallback = '') =>
      tx.select().from(appStat).where(eq(appStat.key, key)).get()?.value ?? fallback
    const set = (key: string, value: string) => {
      tx.insert(appStat).values({ key, value })
        .onConflictDoUpdate({ target: appStat.key, set: { value } }).run()
    }

    const lastSession = get('lastSessionDate', '')
    let streak = parseInt(get('streak', '0'), 10) || 0
    let longest = parseInt(get('longestStreak', '0'), 10) || 0

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
      set('lastSessionDate', today)
      set('streak', String(streak))
      if (streak > longest) {
        longest = streak
        set('longestStreak', String(longest))
      }
    }

    // Single source of truth for XP: the same GRADE_XP table every view displays (W1).
    set('totalXp', String((parseInt(get('totalXp', '0'), 10) || 0) + GRADE_XP[grade]))
    set('totalReviews', String((parseInt(get('totalReviews', '0'), 10) || 0) + 1))
    set('totalCorrect', String((parseInt(get('totalCorrect', '0'), 10) || 0) + (grade >= 3 ? 1 : 0)))
  })
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

  const updated = calculateSm2(baseCard, grade)

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

  updateStreakAndXp(grade)
}

/** Cap on a single bulk import. Without it, `addWords` accepts an arbitrarily
 *  large array and each row was its own implicit transaction, so a single
 *  request could pin the local server for seconds and bloat the WAL. */
const MAX_BULK_WORDS = 1000

type BulkWord = {
  word: string; pos?: string; ipa?: string; definition?: string
  example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string
  category?: string; categories?: string | string[]
}

function extractCategoryNames(w: BulkWord): string[] {
  const list: string[] = []
  if (typeof w.category === 'string' && w.category.trim()) {
    list.push(...w.category.split(/[|,]/).map((s) => s.trim()).filter(Boolean))
  }
  if (Array.isArray(w.categories)) {
    for (const c of w.categories) {
      if (typeof c === 'string' && c.trim()) list.push(...c.split(/[|,]/).map((s) => s.trim()).filter(Boolean))
    }
  } else if (typeof w.categories === 'string' && w.categories.trim()) {
    list.push(...w.categories.split(/[|,]/).map((s) => s.trim()).filter(Boolean))
  }
  return [...new Set(list)].slice(0, 20)
}

function ensureCategories(tx: any, names: string[]): string[] {
  const ids: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const existing = tx.select().from(category).where(sql`lower(${category.name}) = lower(${name})`).get()
    if (existing) {
      ids.push(existing.id)
    } else {
      const id = createId()
      tx.insert(category).values({ id, name }).run()
      ids.push(id)
    }
  }
  return ids
}

/** Map one loose word payload to an insert row. `synonyms`/`antonyms` accept
 *  pipe- or comma-separated lists (the UI label says so), split and cleaned here.
 *  Display casing is preserved; dedupe stays case-insensitive at the call site. */
function toWordRow(w: BulkWord, deckId: string) {
  const splitList = (s?: string) =>
    s ? JSON.stringify(s.split(/[|,]/).map((x) => x.trim()).filter(Boolean)) : null
  const cefrNorm = w.cefr?.trim().toUpperCase() || null
  const cats = extractCategoryNames(w)
  return {
    id: createId(),
    word: w.word.trim(),
    pos: w.pos ?? null,
    ipa: w.ipa ?? null,
    definitions: w.definition ? JSON.stringify([{ pos: w.pos ?? 'n.', text: w.definition }]) : null,
    examples: w.example ? JSON.stringify([w.example]) : null,
    syllables: null,
    cefr: cefrNorm,
    synonyms: splitList(w.synonyms),
    antonyms: splitList(w.antonyms),
    etymology: null,
    amharic: w.amharic ?? null,
    category: cats[0] ?? null,
    deckId,
  }
}

async function createCustomDeck(name: string, description: string, words: BulkWord[]) {
  const deckId = createId()
  const validWords = words.filter((w) => w.word && w.word.trim())

  // De-duplicate within the import itself (same deck is brand new, so no
  // existing words to collide with).
  const seen = new Set<string>()
  const uniqueWords = validWords.filter((w) => {
    const key = w.word.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const rows = uniqueWords.map((w) => ({ row: toWordRow(w, deckId), rawCats: extractCategoryNames(w) }))

  // One transaction for the deck and all of its words: a failure part-way
  // through used to leave an empty deck behind with no way to tell.
  db.transaction((tx) => {
    tx.insert(deck).values({ id: deckId, name, description, isCustom: true }).run()
    if (rows.length) {
      tx.insert(word).values(rows.map((r) => r.row)).run()
      for (const r of rows) {
        if (r.rawCats.length) {
          const catIds = ensureCategories(tx, r.rawCats)
          if (catIds.length) {
            tx.insert(wordCategory).values(catIds.map((cid) => ({ wordId: r.row.id, categoryId: cid }))).run()
          }
        }
      }
    }
  })

  return { id: deckId, count: rows.length, skipped: validWords.length - uniqueWords.length }
}

function pickRandom<T>(arr: T[], n: number): T[] {
  // Fisher-Yates rather than repeated splice: pickOptions shuffles the whole
  // distractor pool, and splice-per-element is O(n^2) — fine for a 78-word
  // deck, painful once someone imports a few thousand words.
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)))
}

/** Words that carry a usable definition — the only ones a definition-based
 *  question can be built from. A word added via CSV import with no definition
 *  used to become a question whose correct answer was the empty string, with
 *  `''` sitting in the option list (F-200/F-207). */
type QuizWord = { dto: WordDTO; firstDef: string }

function buildWordPool(rows: (typeof word.$inferSelect)[], catMap?: Map<string, CategoryDTO[]>): { all: QuizWord[]; withDef: QuizWord[] } {
  const all = rows.map((r) => {
    const dto = parseWord(r, catMap?.get(r.id) ?? [])
    return { dto, firstDef: dto.definitions[0]?.text?.trim() ?? '' }
  })
  return { all, withDef: all.filter((x) => x.firstDef.length > 0) }
}

/**
 * Pick `n` distinct options that all differ from the correct answer.
 * Deduplication is essential: two words can legitimately share a definition,
 * and offering it twice makes the question unanswerable in a different way —
 * the learner can pick the "wrong" option that is in fact also correct.
 */
function pickOptions(correct: string, pool: string[], n: number): string[] | null {
  const seen = new Set([correct])
  const distractors: string[] = []
  for (const candidate of pickRandom(pool, pool.length)) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    distractors.push(candidate)
    if (distractors.length === n - 1) break
  }
  return distractors.length === n - 1 ? [correct, ...distractors] : null
}

async function generateQuiz(deckId: string | null, mode: QuizMode, count: number, categoryId?: string | null) {
  const categoryCondition = categoryId
    ? exists(
        db.select({ d: sql`1` })
          .from(wordCategory)
          .where(and(eq(wordCategory.wordId, word.id), eq(wordCategory.categoryId, categoryId)))
      )
    : undefined

  const wordRows = await db.select({ w: word, srs: srsCard })
    .from(word)
    .leftJoin(srsCard, eq(srsCard.wordId, word.id))
    .where(and(deckId ? eq(word.deckId, deckId) : undefined, categoryCondition))
  const words = wordRows.map((r) => ({ ...r.w, srsCard: r.srs }))
  if (words.length < 4) return []

  const catMap = await fetchCategoriesForWords(words.map((w) => w.id))

  // `typing` and `spelling_bee` are graded on the word itself, so they can use
  // every word. The three multiple-choice modes need a definition on both sides.
  const definitionBased = mode === 'mc' || mode === 'reverse_mc' || mode === 'speed_round'
  const deckPool = buildWordPool(words, catMap)
  const sample = pickRandom(definitionBased ? deckPool.withDef : deckPool.all, Math.min(count, words.length))
  if (sample.length === 0) return []

  // A deck can be too small to yield 4 unique options on its own. Widen the
  // distractor pool to the whole dictionary before giving up on a question,
  // so a 5-word custom deck still produces a real multiple-choice question.
  let globalDefPool: string[] = []
  let globalWordPool: string[] = []
  if (definitionBased) {
    const allWordRows = deckId || categoryId
      ? await db.select().from(word)
      : words
    const global = buildWordPool(allWordRows as (typeof word.$inferSelect)[])
    globalDefPool = [...new Set(global.withDef.map((x) => x.firstDef))]
    globalWordPool = [...new Set(global.all.map((x) => x.dto.word))]
  }

  const questions: QuizQuestion[] = []

  for (const { dto: wordDto, firstDef } of sample) {
    if (mode === 'mc' || mode === 'speed_round') {
      const own = [...new Set(deckPool.withDef.filter((x) => x.dto.id !== wordDto.id).map((x) => x.firstDef))]
      const options = pickOptions(firstDef, [...own, ...globalDefPool], 4)
      if (!options) continue
      questions.push({
        id: createId(), mode, prompt: `What does "${wordDto.word}" mean?`,
        promptWord: wordDto, options, correctAnswer: firstDef, wordDTO: wordDto,
      })
    } else if (mode === 'reverse_mc') {
      const own = [...new Set(deckPool.all.filter((x) => x.dto.word !== wordDto.word).map((x) => x.dto.word))]
      const options = pickOptions(wordDto.word, [...own, ...globalWordPool], 4)
      if (!options) continue
      questions.push({
        id: createId(), mode, prompt: `Which word means: "${firstDef}"?`,
        definition: firstDef, options, correctAnswer: wordDto.word, wordDTO: wordDto,
      })
    } else if (mode === 'typing') {
      questions.push({
        id: createId(), mode, prompt: `Type the word that means: "${firstDef}"`,
        definition: firstDef, correctAnswer: wordDto.word.toLowerCase(), wordDTO: wordDto,
      })
    } else if (mode === 'spelling_bee') {
      questions.push({
        id: createId(), mode, prompt: 'Listen and type the word you hear.',
        audioWord: wordDto.word, promptWord: wordDto, correctAnswer: wordDto.word.toLowerCase(), wordDTO: wordDto,
      })
    }
  }

  return questions
}

// ============================================================
//  GET /api/lexilearn?action=...
// ============================================================
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  const deckId = url.searchParams.get('deckId')
  const categoryId = url.searchParams.get('categoryId')
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)
  const mode = (url.searchParams.get('mode') as QuizMode | null) || 'mc'
  const count = parseInt(url.searchParams.get('count') || '10', 10)
  const query = url.searchParams.get('query') || ''

  try {
    switch (action) {
      case 'categories': {
        const catRows = await db.select().from(category).orderBy(asc(category.name))
        const now = new Date()

        const wordCounts = await db.select({
          categoryId: wordCategory.categoryId,
          total: sql<number>`count(distinct ${wordCategory.wordId})`,
        }).from(wordCategory).groupBy(wordCategory.categoryId)
        const wordCountMap = new Map(wordCounts.map((c) => [c.categoryId, c.total]))

        const dueCounts = await db.select({
          categoryId: wordCategory.categoryId,
          total: sql<number>`count(distinct ${wordCategory.wordId})`,
        }).from(wordCategory)
          .innerJoin(srsCard, eq(wordCategory.wordId, srsCard.wordId))
          .where(lte(srsCard.nextReview, now))
          .groupBy(wordCategory.categoryId)
        const dueCountMap = new Map(dueCounts.map((c) => [c.categoryId, c.total]))

        const newCounts = await db.select({
          categoryId: wordCategory.categoryId,
          total: sql<number>`count(distinct ${wordCategory.wordId})`,
        }).from(wordCategory)
          .innerJoin(word, eq(wordCategory.wordId, word.id))
          .where(wordHasNoSrsCard())
          .groupBy(wordCategory.categoryId)
        const newCountMap = new Map(newCounts.map((c) => [c.categoryId, c.total]))

        return NextResponse.json(catRows.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          wordCount: wordCountMap.get(c.id) ?? 0,
          dueCount: dueCountMap.get(c.id) ?? 0,
          newCount: newCountMap.get(c.id) ?? 0,
        })))
      }

      case 'due': {
        // Kept as part of the public API surface: the e2e suite smoke-tests it
        // directly, and it is the deck-agnostic variant of `reviewable`.
        const now = new Date()
        const categoryCondition = categoryId
          ? exists(
              db.select({ d: sql`1` })
                .from(wordCategory)
                .where(and(eq(wordCategory.wordId, word.id), eq(wordCategory.categoryId, categoryId)))
            )
          : undefined
        const rows = await db.select({ c: srsCard, w: word }).from(srsCard)
          .innerJoin(word, eq(srsCard.wordId, word.id))
          .where(and(lte(srsCard.nextReview, now), deckId ? eq(word.deckId, deckId) : undefined, categoryCondition))
          .orderBy(asc(srsCard.nextReview))
          .limit(limit)
        const catMap = await fetchCategoriesForWords(rows.map((r) => r.w.id))
        return NextResponse.json(rows.map((r) => ({ word: parseWord(r.w, catMap.get(r.w.id) ?? []), srs: toSrsDto(r.c) })))
      }

      case 'new': {
        // Truly new words only (no SRS card yet), filtered and limited in SQL.
        // The old JS filter fetched `limit * 3` rows first, so it silently
        // stopped returning anything once a deck outgrew the window (B1).
        const categoryCondition = categoryId
          ? exists(
              db.select({ d: sql`1` })
                .from(wordCategory)
                .where(and(eq(wordCategory.wordId, word.id), eq(wordCategory.categoryId, categoryId)))
            )
          : undefined
        const rows = await db.select({ w: word }).from(word)
          .where(and(wordHasNoSrsCard(), deckId ? eq(word.deckId, deckId) : undefined, categoryCondition))
          .orderBy(asc(word.createdAt))
          .limit(limit)
        const catMap = await fetchCategoriesForWords(rows.map((r) => r.w.id))
        return NextResponse.json(rows.map((r) => ({ word: parseWord(r.w, catMap.get(r.w.id) ?? []), srs: null })))
      }

      case 'reviewable': {
        // Due cards only — fresh words come from ?action=new. The old filter
        // under-fetched (a `limit * 2` scan) AND let fresh cards leak in,
        // duplicating the same word across both queues (B1).
        const now = new Date()
        const categoryCondition = categoryId
          ? exists(
              db.select({ d: sql`1` })
                .from(wordCategory)
                .where(and(eq(wordCategory.wordId, word.id), eq(wordCategory.categoryId, categoryId)))
            )
          : undefined
        const rows = await db.select({ c: srsCard, w: word }).from(srsCard)
          .innerJoin(word, eq(srsCard.wordId, word.id))
          .where(and(lte(srsCard.nextReview, now), deckId ? eq(word.deckId, deckId) : undefined, categoryCondition))
          .orderBy(asc(srsCard.nextReview))
          .limit(limit)
        const catMap = await fetchCategoriesForWords(rows.map((r) => r.w.id))
        return NextResponse.json(rows.map((r) => ({ word: parseWord(r.w, catMap.get(r.w.id) ?? []), srs: toSrsDto(r.c) })))
      }

      case 'decks': {
        const deckRows = await db.select().from(deck).orderBy(asc(deck.createdAt))
        // Single GROUP BY instead of fetching every word row into JS (W7).
        const counts = await db.select({ deckId: word.deckId, total: sql<number>`count(*)` }).from(word).groupBy(word.deckId)
        const countByDeck = new Map(counts.map((c) => [c.deckId, c.total]))
        return NextResponse.json(deckRows.map((d) => ({
          id: d.id, name: d.name, description: d.description,
          isCustom: d.isCustom, wordCount: countByDeck.get(d.id) ?? 0, createdAt: d.createdAt,
        })), { headers: { 'Cache-Control': 'private, max-age=30' } })
      }

      case 'deck': {
        if (!deckId) return NextResponse.json({ error: 'deckId required' }, { status: 400 })
        const deckRow = await db.select().from(deck).where(eq(deck.id, deckId)).get()
        if (!deckRow) return NextResponse.json({ error: 'not found' }, { status: 404 })
        const wordRows = await db.select({ w: word, srs: srsCard }).from(word)
          .leftJoin(srsCard, eq(srsCard.wordId, word.id))
          .where(eq(word.deckId, deckId))
          .orderBy(asc(word.createdAt))
        const catMap = await fetchCategoriesForWords(wordRows.map((r) => r.w.id))
        return NextResponse.json({
          id: deckRow.id, name: deckRow.name, description: deckRow.description,
          isCustom: deckRow.isCustom,
          words: wordRows.map((r) => ({ ...parseWord(r.w, catMap.get(r.w.id) ?? []), srs: r.srs ? toSrsDto(r.srs) : null })),
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
          autoSpeak: (await getStat('autoSpeak', 'false')) === 'true',
        })
      }

      case 'quiz': {
        const questions = await generateQuiz(deckId, mode, count, categoryId)
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
        const branch = {
          ...branchRow,
          nodes: [...(branchRow.nodes ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        }
        for (const n of branch.nodes) n.attempts = [...(n.attempts ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return NextResponse.json(branch)
      }

      case 'mentorNodeNext': {
        const branchId = url.searchParams.get('branchId')
        if (!branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })
        const node = await generateNextNode(branchId)
        return NextResponse.json(node)
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
        const q = query.trim().toLowerCase()
        // instr() instead of LIKE: a literal "%" or "_" typed into the search
        // box is a LIKE wildcard, so searching for one used to return 20
        // arbitrary words. instr() has no wildcard semantics to escape.
        // Prefix matches rank first, then alphabetical; cap raised to 50 so
        // the result count label stops lying on bigger dictionaries.
        const words = await db.select().from(word)
          .where(sql`instr(lower(${word.word}), lower(${q})) > 0`)
          .orderBy(sql`case when instr(lower(${word.word}), lower(${q})) = 1 then 0 else 1 end`, asc(word.word))
          .limit(50)
        const catMap = await fetchCategoriesForWords(words.map((w) => w.id))
        return NextResponse.json(words.map((w) => parseWord(w, catMap.get(w.id) ?? [])))
      }

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e) {
    console.error('API GET error:', e)
    // Don't leak internal error details to the client in production.
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (e instanceof Error ? e.message : 'unknown error')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------- Validation (POST bodies) ----------
const ReviewBody = z.object({
  wordId: z.string().min(1),
  grade: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)]),
  mode: z.string().max(32).optional(),
})

const QuizSessionBody = z.object({
  mode: z.enum(['mc', 'reverse_mc', 'typing', 'spelling_bee', 'speed_round', 'match']),
  total: z.number().int().min(0).max(1000),
  correct: z.number().int().min(0).max(1000),
  xpEarned: z.number().int().min(0).max(100_000),
})

const SettingsPatch = z.object({
  ttsVoice: z.string().max(300).optional(),
  ttsRate: z.number().min(0.5).max(2).optional(),
  dailyGoal: z.number().int().min(1).max(50).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  autoSpeak: z.boolean().optional(),
})

// Bulk-import shapes. `words` is capped so one request cannot pin the local
// server (see MAX_BULK_WORDS); every field is length-bounded so a stray
// megabyte in a textarea cannot reach the database.
const BulkWordSchema = z.object({
  word: z.string().min(1).max(200),
  pos: z.string().max(50).optional(),
  ipa: z.string().max(200).optional(),
  definition: z.string().max(2000).optional(),
  example: z.string().max(2000).optional(),
  cefr: z.string().max(10).optional(),
  synonyms: z.string().max(2000).optional(),
  antonyms: z.string().max(2000).optional(),
  amharic: z.string().max(500).optional(),
  category: z.string().max(200).optional(),
  categories: z.union([z.string(), z.array(z.string().max(100))]).optional(),
})

const CreateDeckBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  words: z.array(BulkWordSchema).max(MAX_BULK_WORDS),
})

const AddWordsBody = z.object({
  deckId: z.string().min(1),
  words: z.array(BulkWordSchema).min(1).max(MAX_BULK_WORDS),
})

const AddWordBody = z.object({
  deckId: z.string().min(1),
  word: z.string().min(1).max(200),
  pos: z.string().max(50).optional(),
  ipa: z.string().max(200).optional(),
  definition: z.string().max(2000).optional(),
  example: z.string().max(2000).optional(),
  cefr: z.string().max(10).optional(),
  synonyms: z.string().max(2000).optional(),
  antonyms: z.string().max(2000).optional(),
  amharic: z.string().max(500).optional(),
  categoryIds: z.array(z.string().min(1)).max(20).optional(),
  categories: z.array(z.string().max(100)).max(20).optional(),
})

const UpdateWordBody = z.object({
  wordId: z.string().min(1),
  pos: z.string().max(50).nullable().optional(),
  ipa: z.string().max(200).nullable().optional(),
  definition: z.string().max(2000).optional(),
  example: z.string().max(2000).optional(),
  cefr: z.string().max(10).nullable().optional(),
  synonyms: z.string().max(2000).optional(),
  antonyms: z.string().max(2000).optional(),
  amharic: z.string().max(500).nullable().optional(),
  categoryIds: z.array(z.string().min(1)).max(20).optional(),
})

const CreateCategoryBody = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(50).nullable().optional(),
})

const RenameCategoryBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(100),
})

const CategoryIdBody = z.object({ categoryId: z.string().min(1) })

const SetWordCategoriesBody = z.object({
  wordId: z.string().min(1),
  categoryIds: z.array(z.string().min(1)).max(50),
})

const IdBody = z.object({ wordId: z.string().min(1) })
const DeckIdBody = z.object({ deckId: z.string().min(1) })

const ClaimChallengeBody = z.object({
  key: z.enum(['sprint', 'recall', 'streak']),
})

const MentorProjectBody = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().max(2000).optional(),
})

const MentorBranchBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  focusTag: z.string().min(1).max(100),
  mode: z.enum(['drill', 'scenario', 'challenge', 'review', 'question', 'exam']).optional(),
  difficultyCeiling: z.number().int().min(1).max(5).optional(),
  locked: z.boolean().optional(),
})

const MentorNextBody = z.object({ branchId: z.string().min(1) })

const MentorAttemptBody = z.object({
  nodeId: z.string().min(1),
  answer: z.string().min(1).max(10_000),
  confidence: z.number().int().min(1).max(5).optional(),
  timeMs: z.number().int().min(0).max(86_400_000).optional(),
  keystrokes: z.number().int().min(0).max(100_000).optional(),
  hintLevel: z.number().int().min(0).max(4).optional(),
  selfCorrect: z.string().max(10_000).optional(),
})

const MentorHintBody = z.object({
  nodeId: z.string().min(1),
  level: z.number().int().min(1).max(4).optional(),
})

const MentorSelfCorrectBody = z.object({
  attemptId: z.string().min(1),
  correction: z.string().max(10_000).optional(),
})

const MentorForkBody = z.object({
  nodeId: z.string().min(1),
  title: z.string().max(300).optional(),
  focusTag: z.string().max(100).optional(),
  mode: z.enum(['drill', 'scenario', 'challenge', 'review', 'question', 'exam']).optional(),
  difficultyCeiling: z.number().int().min(1).max(5).optional(),
})

const MentorExplainBody = z.object({
  query: z.string().min(1).max(4000),
  context: z.string().max(10_000).optional(),
})

const MentorPronunciationBody = z.object({
  target: z.string().min(1).max(2000),
  transcript: z.string().min(1).max(2000),
})

const MentorNaturalnessBody = z.object({ input: z.string().min(1).max(10_000) })

const MentorBody = z.object({
  mode: z.enum(['practice', 'writing', 'conversation', 'explain']),
  words: z.array(z.object({
    word: z.string().min(1).max(200),
    definition: z.string().max(2000).optional(),
    amharic: z.string().max(500).optional(),
  })).max(500).optional(),
  practiceType: z.enum(['cloze', 'rewrite', 'error_correction', 'use_in_paragraph', 'discussion']).optional(),
  count: z.number().int().min(1).max(50).optional(),
  level: z.string().max(50).optional(),
  text: z.string().min(1).max(10_000).optional(),
  targetWords: z.array(z.string().min(1).max(200)).max(50).optional(),
  scenario: z.string().max(200).optional(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) })).max(50).optional(),
  start: z.boolean().optional(),
  query: z.string().min(1).max(4000).optional(),
  context: z.string().max(10_000).optional(),
  title: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ============================================================
//  POST /api/lexilearn?action=...   body = JSON
// ============================================================
export async function POST(req: NextRequest) {
  // Reject cross-site writes before anything touches the database. A browser
  // on any website can POST to this endpoint; without this, a one-line form
  // could wipe the user's study history (see src/server/csrf.ts).
  const blocked = assertSameOrigin(req)
  if (blocked) return blocked

  // Rate limit by IP to prevent a buggy client from flooding the server.
  const ip = req.headers.get('x-forwarded-for') ?? 'localhost'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || ''
  let body: any = {}
  try { body = await req.json() } catch {}

  try {
    switch (action) {
      case 'review': {
        const parsed = ReviewBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'wordId and a valid grade (0, 3, 4 or 5) required' }, { status: 400 })
        const { wordId, grade, mode: reviewMode = 'review' } = parsed.data
        await submitReview(wordId, grade, reviewMode)
        return NextResponse.json({ ok: true })
      }

      case 'createDeck': {
        const parsed = CreateDeckBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'name and words required' }, { status: 400 })
        const result = await createCustomDeck(parsed.data.name, parsed.data.description ?? '', parsed.data.words)
        return NextResponse.json(result)
      }

      case 'addWords': {
        const parsed = AddWordsBody.safeParse(body)
        if (!parsed.success) {
          const tooMany = parsed.error.issues.some((i) => i.code === 'too_big')
          return NextResponse.json(
            { error: tooMany ? `at most ${MAX_BULK_WORDS} words per import` : 'deckId and words array required' },
            { status: 400 }
          )
        }
        const deckRow = await db.select().from(deck).where(eq(deck.id, parsed.data.deckId)).get()
        if (!deckRow) return NextResponse.json({ error: 'deck not found' }, { status: 404 })

        const validWords = parsed.data.words.filter((w) => w.word && w.word.trim())
        if (validWords.length === 0) {
          return NextResponse.json({ error: 'No valid words found — every row was empty.' }, { status: 400 })
        }

        // Check for duplicates already in the deck so we can report them
        // instead of failing the entire import on a constraint violation.
        const deckWords = await db.select({ word: word.word }).from(word).where(eq(word.deckId, parsed.data.deckId)).all()
        const existing = new Set(deckWords.map((r) => r.word.toLowerCase()))
        const duplicates: string[] = []
        const toInsert = validWords.filter((w) => {
          const key = w.word.trim().toLowerCase()
          if (existing.has(key)) { duplicates.push(key); return false }
          existing.add(key) // also catch duplicates within the same import
          return true
        })

        if (toInsert.length === 0) {
          return NextResponse.json(
            { error: `All ${duplicates.length} word(s) already exist in this deck`, duplicates },
            { status: 409 }
          )
        }

        const rows = toInsert.map((w) => ({ row: toWordRow(w, parsed.data.deckId), rawCats: extractCategoryNames(w) }))
        db.transaction((tx) => {
          tx.insert(word).values(rows.map((r) => r.row)).run()
          for (const r of rows) {
            if (r.rawCats.length) {
              const catIds = ensureCategories(tx, r.rawCats)
              if (catIds.length) {
                tx.insert(wordCategory).values(catIds.map((cid) => ({ wordId: r.row.id, categoryId: cid }))).run()
              }
            }
          }
        })
        return NextResponse.json({
          count: rows.length,
          skipped: duplicates.length,
          duplicates: duplicates.length ? duplicates : undefined,
        })
      }

      case 'deleteDeck': {
        const parsed = DeckIdBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'deckId required' }, { status: 400 })
        const id = parsed.data.deckId
        // Bundled decks (Common 500 / IELTS / TOEFL / GRE) ship with the
        // offline seed and must not be deletable — only custom decks (W5).
        const deckRow = await db.select().from(deck).where(eq(deck.id, id)).get()
        if (!deckRow) return NextResponse.json({ error: 'deck not found' }, { status: 404 })
        if (!deckRow.isCustom) return NextResponse.json({ error: 'This deck ships with the app and cannot be deleted.' }, { status: 403 })
        await db.delete(deck).where(eq(deck.id, id))
        return NextResponse.json({ ok: true })
      }

      case 'quizSession': {
        const parsed = QuizSessionBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'invalid quiz session payload' }, { status: 400 })
        // Log only: XP, review counts, streak and per-word SRS cards are all
        // written per answer by `review`. The old session-level totals were
        // double-counting every quiz answer in xpToday/todayCorrect/totalXp (W1).
        const { mode: qMode, total, correct, xpEarned } = parsed.data
        await db.insert(quizSession).values({ mode: qMode, total, correct, xpEarned, completedAt: new Date() })
        return NextResponse.json({ ok: true })
      }

      case 'claimChallenge': {
        const parsed = ClaimChallengeBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'unknown challenge' }, { status: 400 })
        const today = dayKey(new Date())
        const start = new Date(); start.setHours(0, 0, 0, 0)
        const end = new Date(); end.setHours(23, 59, 59, 999)
        const logs = await db.select().from(reviewLog).where(and(gte(reviewLog.reviewedAt, start), lte(reviewLog.reviewedAt, end)))

        // Awarding XP and marking the challenge claimed is one read-modify-write;
        // doing it in a transaction stops a double-click from paying out twice.
        const outcome = db.transaction((tx) => {
          const get = (key: string, fallback = '') =>
            tx.select().from(appStat).where(eq(appStat.key, key)).get()?.value ?? fallback
          const set = (key: string, value: string) => {
            tx.insert(appStat).values({ key, value })
              .onConflictDoUpdate({ target: appStat.key, set: { value } }).run()
          }

          if (get('challengeClaimedDate', '') === today) return { alreadyClaimed: true as const, reward: 0 }

          // Review log only — every quiz answer is logged per question, so the
          // quizSession totals would double-count them (W1).
          const todayCorrect = logs.filter((l) => l.isCorrect).length
          const streak = parseInt(get('streak', '0'), 10) || 0
          const targets: Record<string, { progress: number; target: number; reward: number }> = {
            sprint: { progress: logs.length, target: 10, reward: 35 },
            recall: { progress: todayCorrect, target: 8, reward: 40 },
            streak: { progress: streak > 0 ? 1 : 0, target: 1, reward: 25 },
          }
          const challenge = targets[parsed.data.key]
          if (!challenge || challenge.progress < challenge.target) return { incomplete: true as const }

          set('totalXp', String((parseInt(get('totalXp', '0'), 10) || 0) + challenge.reward))
          set('challengeClaimedDate', today)
          return { alreadyClaimed: false as const, reward: challenge.reward }
        })

        if ('incomplete' in outcome) return NextResponse.json({ error: 'Challenge is not complete yet' }, { status: 400 })
        if (outcome.alreadyClaimed) return NextResponse.json({ ok: true, xpAwarded: 0, alreadyClaimed: true })
        return NextResponse.json({ ok: true, xpAwarded: outcome.reward, alreadyClaimed: false })
      }

      case 'repairStreak': {
        const today = dayKey(new Date())
        // Same read-modify-write as claimChallenge: the shield has a cooldown,
        // so two clicks in quick succession must not both consume it.
        const result = db.transaction((tx) => {
          const get = (key: string, fallback = '') =>
            tx.select().from(appStat).where(eq(appStat.key, key)).get()?.value ?? fallback
          const set = (key: string, value: string) => {
            tx.insert(appStat).values({ key, value })
              .onConflictDoUpdate({ target: appStat.key, set: { value } }).run()
          }

          const lastSession = get('lastSessionDate', '')
          if (!lastSession) return { error: 'No streak shield available' } as const
          const usedDate = get('streakShieldUsedDate', '')
          if (usedDate) {
            const used = new Date(usedDate + 'T00:00:00')
            const nowDay = new Date(today + 'T00:00:00')
            const cooldown = Math.max(0, 7 - Math.round((nowDay.getTime() - used.getTime()) / 86_400_000))
            if (cooldown > 0) return { error: `Streak shield recharges in ${cooldown} day${cooldown === 1 ? '' : 's'}` } as const
          }
          const last = new Date(lastSession + 'T00:00:00')
          const now = new Date(today + 'T00:00:00')
          if (Math.round((now.getTime() - last.getTime()) / 86_400_000) <= 1) {
            return { error: 'Your streak does not need repair' } as const
          }

          const repaired = Math.max(1, (parseInt(get('streak', '0'), 10) || 0) + 1)
          set('streak', String(repaired))
          if (repaired > (parseInt(get('longestStreak', '0'), 10) || 0)) set('longestStreak', String(repaired))
          set('lastSessionDate', today)
          set('streakShieldUsedDate', today)
          return { streak: repaired } as const
        })

        if ('error' in result) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
        return NextResponse.json({ ok: true, streak: result.streak })
      }

      case 'updateSettings': {
        const parsed = SettingsPatch.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'invalid settings payload' }, { status: 400 })
        const patch = parsed.data
        if (patch.ttsVoice !== undefined) await setStat('ttsVoice', patch.ttsVoice)
        if (patch.ttsRate !== undefined) await setStat('ttsRate', String(patch.ttsRate))
        if (patch.dailyGoal !== undefined) await setStat('dailyGoal', String(patch.dailyGoal))
        if (patch.theme !== undefined) await setStat('theme', patch.theme)
        if (patch.autoSpeak !== undefined) await setStat('autoSpeak', String(patch.autoSpeak))
        return NextResponse.json({ ok: true })
      }

      case 'addWord': {
        const parsed = AddWordBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'deckId and word required' }, { status: 400 })
        const { deckId, ...fields } = parsed.data
        const wordKey = fields.word.trim().toLowerCase()
        try {
          const inserted = db.transaction((tx) => {
            const deckRow = tx.select().from(deck).where(eq(deck.id, deckId)).get()
            if (!deckRow) return null
            // Case-insensitive: display casing is preserved, so `eq` on the
            // raw column would miss "Abate" vs "abate".
            const existing = tx.select({ id: word.id }).from(word)
              .where(and(eq(word.deckId, deckId), sql`lower(${word.word}) = lower(${wordKey})`)).get()
            if (existing) return { duplicate: true }
            const newWord = tx.insert(word).values(toWordRow(fields, deckId)).returning({ id: word.id }).get()
            let catIds = fields.categoryIds ?? []
            if (fields.categories && fields.categories.length) {
              const extraIds = ensureCategories(tx, fields.categories)
              catIds = [...new Set([...catIds, ...extraIds])]
            }
            if (catIds.length) {
              tx.insert(wordCategory).values(catIds.map((cid) => ({ wordId: newWord.id, categoryId: cid }))).run()
            }
            return newWord
          })
          if (!inserted) return NextResponse.json({ error: 'deck not found' }, { status: 404 })
          if ('duplicate' in inserted) {
            return NextResponse.json({ error: `"${wordKey}" already exists in this deck` }, { status: 409 })
          }
          return NextResponse.json({ id: inserted.id })
        } catch {
          return NextResponse.json({ error: `"${wordKey}" already exists in this deck` }, { status: 409 })
        }
      }

      case 'updateWord': {
        const parsed = UpdateWordBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'invalid word payload' }, { status: 400 })
        const { wordId, pos, ipa, definition, example, cefr, synonyms, antonyms, amharic, categoryIds } = parsed.data
        const existing = await db.select().from(word).where(eq(word.id, wordId)).get()
        if (!existing) return NextResponse.json({ error: 'word not found' }, { status: 404 })
        const splitList = (s: string) => JSON.stringify(s.split(/[|,]/).map((x) => x.trim()).filter(Boolean))
        const data: Record<string, unknown> = {}
        if (pos !== undefined) data.pos = pos
        if (ipa !== undefined) data.ipa = ipa
        if (definition !== undefined) data.definitions = JSON.stringify([{ pos: pos ?? existing.pos ?? 'n.', text: definition }])
        if (example !== undefined) data.examples = example ? JSON.stringify([example]) : null
        if (cefr !== undefined) data.cefr = cefr ? cefr.trim().toUpperCase() : cefr
        if (synonyms !== undefined) data.synonyms = synonyms ? splitList(synonyms) : null
        if (antonyms !== undefined) data.antonyms = antonyms ? splitList(antonyms) : null
        if (amharic !== undefined) data.amharic = amharic

        db.transaction((tx) => {
          if (Object.keys(data).length) tx.update(word).set(data).where(eq(word.id, wordId)).run()
          if (categoryIds !== undefined) {
            tx.delete(wordCategory).where(eq(wordCategory.wordId, wordId)).run()
            if (categoryIds.length) {
              tx.insert(wordCategory).values(categoryIds.map((cid) => ({ wordId, categoryId: cid }))).run()
            }
          }
        })
        return NextResponse.json({ ok: true })
      }

      case 'createCategory': {
        const parsed = CreateCategoryBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'category name required' }, { status: 400 })
        const name = parsed.data.name.trim()
        const existing = await db.select().from(category).where(sql`lower(${category.name}) = lower(${name})`).get()
        if (existing) return NextResponse.json({ id: existing.id })
        const id = createId()
        await db.insert(category).values({ id, name, color: parsed.data.color ?? null })
        return NextResponse.json({ id })
      }

      case 'renameCategory': {
        const parsed = RenameCategoryBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'categoryId and name required' }, { status: 400 })
        await db.update(category).set({ name: parsed.data.name.trim() }).where(eq(category.id, parsed.data.categoryId))
        return NextResponse.json({ ok: true })
      }

      case 'deleteCategory': {
        const parsed = CategoryIdBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
        await db.delete(category).where(eq(category.id, parsed.data.categoryId))
        return NextResponse.json({ ok: true })
      }

      case 'setWordCategories': {
        const parsed = SetWordCategoriesBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'wordId and categoryIds required' }, { status: 400 })
        const { wordId, categoryIds } = parsed.data
        db.transaction((tx) => {
          tx.delete(wordCategory).where(eq(wordCategory.wordId, wordId)).run()
          if (categoryIds.length) {
            tx.insert(wordCategory).values(categoryIds.map((cid) => ({ wordId, categoryId: cid }))).run()
          }
        })
        return NextResponse.json({ ok: true })
      }

      case 'deleteWord': {
        const parsed = IdBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'wordId required' }, { status: 400 })
        await db.delete(word).where(eq(word.id, parsed.data.wordId))
        return NextResponse.json({ ok: true })
      }

      case 'reset': {
        // "Reset all progress" now covers the AI Coach too — leaving months of
        // mentor conversations, skill mastery and weekly reports behind while
        // wiping XP read as a bug to users. F-504.
        //
        // Word data (Deck/Word/SrsCard-free vocabulary) is deliberately
        // preserved. mentorKnowledge is preserved as well: it is seeded
        // reference content, not user progress, and deleting it would force a
        // full re-embed of the RAG index on the next mentor request.
        //
        // Deleting mentorProject cascades branch -> node -> attempt -> feedback
        // (see onDelete in db/schema.ts); everything below is FK-less and has
        // to be cleared explicitly.
        const mentorTables = [
          pronunciationAttempt, naturalnessAttempt, mentorWeeklyReport,
          mentorSkillMastery, mentorErrorCard, mentorTurn, mentorSession,
          practiceMaterial, errorLog, mentorProfile, mentorProject,
        ]
        db.transaction((tx) => {
          tx.delete(reviewLog).run()
          tx.delete(quizSession).run()
          tx.delete(srsCard).run()
          tx.delete(appStat).run()
          for (const t of mentorTables) tx.delete(t).run()

          const initialStats: Record<string, string> = {
            streak: '0', longestStreak: '0', lastSessionDate: '', totalXp: '0',
            dailyGoal: '20', ttsVoice: '', ttsRate: '1', theme: 'system',
            totalReviews: '0', totalCorrect: '0', achievements: '[]', streakShieldUsedDate: '', challengeClaimedDate: '',
          }
          tx.insert(appStat).values(
            Object.entries(initialStats).map(([key, value]) => ({ key, value }))
          ).run()
          // The mentor profile row is a singleton (id = 1); getMentorOverview
          // recreates it via ensureMentorSeed, but seeding it here keeps the
          // post-reset state identical to a fresh install.
          tx.insert(mentorProfile).values({ id: 1 }).run()
        })
        return NextResponse.json({ ok: true })
      }

      case 'mentorIndexKnowledge': {
        // Was a GET, which meant a browser prefetch — or the service worker
        // caching it — could trigger a full re-embed of the knowledge index.
        // It writes, so it is a POST like every other mutation.
        await ensureMentorSeed()
        const { ollamaEmbed } = await import('@/features/coach/server/ollama')
        const chunks = await db.select().from(mentorKnowledge).where(isNull(mentorKnowledge.embedding))
        let indexed = 0
        for (const c of chunks) {
          try { const [vec] = await ollamaEmbed(`${c.title}. ${c.content}`); if (vec?.length) { await db.update(mentorKnowledge).set({ embedding: JSON.stringify(vec) }).where(eq(mentorKnowledge.id, c.id)); indexed++ } } catch {}
        }
        return NextResponse.json({ ok:true, indexed, total:chunks.length })
      }

      case 'mentorExplain': {
        const parsed = MentorExplainBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error:'query required' }, { status:400 })
        const { buildExplainPrompt, ollamaChat, MENTOR_SYSTEM } = await import('@/features/coach/server/ollama')
        const response = await ollamaChat([{ role:'system', content:MENTOR_SYSTEM }, { role:'user', content:buildExplainPrompt(parsed.data.query.trim(), parsed.data.context) }])
        return NextResponse.json({ response })
      }

      case 'mentorProject': {
        const parsed = MentorProjectBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'name required' }, { status: 400 })
        const projectRows = await db.insert(mentorProject).values({ name: parsed.data.name.trim(), goal: parsed.data.goal?.trim() || null }).returning()
        return NextResponse.json(projectRows[0])
      }

      case 'mentorBranch': {
        const parsed = MentorBranchBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'projectId, title and focusTag required' }, { status: 400 })
        const { projectId, title, focusTag, mode = 'drill', difficultyCeiling = 3, locked = true } = parsed.data
        const branchRows = await db.insert(mentorBranch).values({ projectId, title, focusTag, mode, difficultyCeiling, locked }).returning()
        return NextResponse.json(branchRows[0])
      }

      case 'mentorNext': {
        const parsed = MentorNextBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'branchId required' }, { status: 400 })
        const node = await generateNextNode(parsed.data.branchId)
        return NextResponse.json(node)
      }

      case 'mentorWeeklyReport': {
        const result = await buildWeeklyCoachReport()
        return NextResponse.json(result)
      }

      case 'mentorPronunciation': {
        const parsed = MentorPronunciationBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({error:'target and transcript required'},{status:400})
        return NextResponse.json(await evaluatePronunciation(parsed.data.target.trim(), parsed.data.transcript.trim()))
      }

      case 'mentorNaturalness': {
        const parsed = MentorNaturalnessBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({error:'input required'},{status:400})
        return NextResponse.json(await evaluateNaturalness(parsed.data.input.trim()))
      }

      case 'mentorAttempt': {
        const parsed = MentorAttemptBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'nodeId and answer required' }, { status: 400 })
        const { nodeId, answer, confidence, timeMs, keystrokes, hintLevel = 0, selfCorrect } = parsed.data
        const node = await db.select().from(mentorNode).where(eq(mentorNode.id, nodeId)).get()
        if (!node) return NextResponse.json({ error: 'node not found' }, { status: 404 })
        const attemptRows = await db.insert(mentorAttempt).values({ nodeId, branchId: node.branchId, answer: answer.trim(), confidence, timeMs, keystrokes, hintLevel, selfCorrect: selfCorrect ?? null }).returning()
        const attempt = attemptRows[0]
        const result = await evaluateAttempt(attempt.id)
        return NextResponse.json({ attemptId: attempt.id, ...result })
      }

      case 'mentorHint': {
        const parsed = MentorHintBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
        const node = await db.select().from(mentorNode).where(eq(mentorNode.id, parsed.data.nodeId)).get()
        if (!node) return NextResponse.json({ error: 'node not found' }, { status: 404 })
        const hints = JSON.parse(node.hints || '[]') as string[]
        const level = Math.min(Math.max(parsed.data.level ?? 1, 1), Math.max(hints.length, 1))
        return NextResponse.json({ action: 'hint', level, text: hints[level - 1] || hints[hints.length - 1] || 'Look again at the target skill.' })
      }

      case 'mentorSelfCorrect': {
        const parsed = MentorSelfCorrectBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'attemptId required' }, { status: 400 })
        const attemptRows = await db.update(mentorAttempt).set({ selfCorrect: parsed.data.correction || '' }).where(eq(mentorAttempt.id, parsed.data.attemptId)).returning()
        if (!attemptRows[0]) return NextResponse.json({ error: 'attempt not found' }, { status: 404 })
        return NextResponse.json({ ok: true, selfCorrect: attemptRows[0].selfCorrect })
      }

      case 'mentorFork': {
        const parsed = MentorForkBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
        const { nodeId, title, focusTag, mode = 'scenario', difficultyCeiling = 3 } = parsed.data
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
        const parsed = MentorBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'invalid mentor payload' }, { status: 400 })
        const { mode } = parsed.data
        let responseText = ''
        if (mode === 'practice') {
          const userPrompt = buildPracticePrompt({ words: parsed.data.words ?? [], type: parsed.data.practiceType || 'cloze', count: parsed.data.count || 5, level: parsed.data.level })
          responseText = await ollamaChat([{ role:'system', content:MENTOR_SYSTEM }, { role:'user', content:userPrompt }])
        } else if (mode === 'writing') {
          responseText = await ollamaChat([{ role:'system', content:MENTOR_SYSTEM }, { role:'user', content:buildWritingFeedbackPrompt(parsed.data.text!, parsed.data.targetWords) }])
        } else if (mode === 'conversation') {
          const system = buildConversationSystem(parsed.data.scenario || 'Casual conversation practice', parsed.data.targetWords)
          const prior = parsed.data.messages ?? []
          const messages = [{role:'system' as const, content:system}, ...prior.map(m => ({role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content}))]
          if (parsed.data.start || prior.length === 0) messages.push({role:'user' as const, content:'Start with one short natural question and stay in character.'})
          responseText = await ollamaChat(messages, { temperature:0.8 })
        } else if (mode === 'explain') {
          responseText = await ollamaChat([{role:'system' as const, content:MENTOR_SYSTEM},{role:'user' as const, content:buildExplainPrompt(parsed.data.query!, parsed.data.context)}])
        } else return NextResponse.json({ error:'unknown mentor mode' }, {status:400})
        await db.insert(mentorSession).values({ mode, title: parsed.data.title || mode, prompt: JSON.stringify(parsed.data).slice(0, 2000), response: responseText.slice(0, 15000), metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null }).catch(() => {})
        return NextResponse.json({response:responseText})
      }

      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e) {
    console.error('API POST error:', e)
    // Don't leak internal error details to the client in production.
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (e instanceof Error ? e.message : 'unknown error')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
