// LexiLearn API routes — all server-side logic lives here.
// Single file with route handlers; called from client via fetch().

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deck, word, srsCard, reviewLog, quizSession, appStat, mentorProject, mentorBranch, mentorNode, mentorAttempt, mentorErrorCard, mentorProfile, mentorSkillMastery, mentorKnowledge, pronunciationAttempt, naturalnessAttempt, mentorSession } from '@/db/schema'
import { eq, gte, lte, and, isNull, asc, desc, like } from 'drizzle-orm'
import { calculateSm2, GRADE_XP, type Grade } from '@/lib/srs'
import { dayKey } from '@/lib/date'
import { createId } from '@/db/id'
import { z } from 'zod'
import type { WordDTO, SrsCardDTO, QuizMode, QuizQuestion } from '@/lib/api'
import { getStat, setStat, wordHasNoSrsCard, getDashboardStats, getAnalytics } from '@/server/stats'
import { generateNextNode, evaluateAttempt, getMentorOverview, ensureMentorSeed, buildWeeklyCoachReport, evaluatePronunciation, evaluateNaturalness } from '@/features/coach/server/mentor-agent'

// ---------- Helpers ----------
function parseWord(w: typeof word.$inferSelect): WordDTO {
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

async function updateStreakAndXp(grade: Grade) {
  const today = dayKey(new Date())
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

  // Single source of truth for XP: the same GRADE_XP table every view displays (W1).
  const xpDelta = GRADE_XP[grade]
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

  await updateStreakAndXp(grade)
}

async function createCustomDeck(name: string, description: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; amharic?: string }[]) {
  const deckId = createId()
  await db.insert(deck).values({ id: deckId, name, description, isCustom: true })

  for (const w of words) {
    if (!w.word || !w.word.trim()) continue
    await db.insert(word).values({
      id: createId(),
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

async function generateQuiz(deckId: string | null, mode: QuizMode, count: number) {
  const wordRows = await db.select({ w: word, srs: srsCard }).from(word).leftJoin(srsCard, eq(srsCard.wordId, word.id)).where(deckId ? eq(word.deckId, deckId) : undefined)
  const words = wordRows.map((r) => ({ ...r.w, srsCard: r.srs }))
  if (words.length < 4) return []

  const sample = pickRandom(words, Math.min(count, words.length))
  const questions: QuizQuestion[] = []

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
        id: createId(), mode, prompt: `What does "${w.word}" mean?`,
        promptWord: wordDto, options, correctAnswer: firstDef, wordDTO: wordDto,
      })
    } else if (mode === 'reverse_mc') {
      const distractors = pickRandom(allWords.filter((x) => x !== w.word), 3)
      const options = pickRandom([w.word, ...distractors], 4)
      questions.push({
        id: createId(), mode, prompt: `Which word means: "${firstDef}"?`,
        definition: firstDef, options, correctAnswer: w.word, wordDTO: wordDto,
      })
    } else if (mode === 'typing') {
      questions.push({
        id: createId(), mode, prompt: `Type the word that means: "${firstDef}"`,
        definition: firstDef, correctAnswer: w.word.toLowerCase(), wordDTO: wordDto,
      })
    } else if (mode === 'spelling_bee') {
      questions.push({
        id: createId(), mode, prompt: 'Listen and type the word you hear.',
        audioWord: w.word, promptWord: wordDto, correctAnswer: w.word.toLowerCase(), wordDTO: wordDto,
      })
    } else if (mode === 'speed_round') {
      const distractors = pickRandom(
        words.filter((x) => x.id !== w.id).map((x) => parseWord(x).definitions[0]?.text ?? '').filter(Boolean),
        3
      )
      const options = pickRandom([firstDef, ...distractors], 4)
      questions.push({
        id: createId(), mode, prompt: `What does "${w.word}" mean?`,
        promptWord: wordDto, options, correctAnswer: firstDef, wordDTO: wordDto,
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
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)
  const mode = (url.searchParams.get('mode') as QuizMode | null) || 'mc'
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
        // Truly new words only (no SRS card yet), filtered and limited in SQL.
        // The old JS filter fetched `limit * 3` rows first, so it silently
        // stopped returning anything once a deck outgrew the window (B1).
        const rows = await db.select({ w: word }).from(word)
          .where(and(wordHasNoSrsCard(), deckId ? eq(word.deckId, deckId) : undefined))
          .orderBy(asc(word.createdAt))
          .limit(limit)
        return NextResponse.json(rows.map((r) => ({ word: parseWord(r.w), srs: null })))
      }

      case 'reviewable': {
        // Due cards only — fresh words come from ?action=new. The old filter
        // under-fetched (a `limit * 2` scan) AND let fresh cards leak in,
        // duplicating the same word across both queues (B1).
        const now = new Date()
        const rows = await db.select({ c: srsCard, w: word }).from(srsCard)
          .innerJoin(word, eq(srsCard.wordId, word.id))
          .where(and(lte(srsCard.nextReview, now), deckId ? eq(word.deckId, deckId) : undefined))
          .orderBy(asc(srsCard.nextReview))
          .limit(limit)
        return NextResponse.json(rows.map((r) => ({ word: parseWord(r.w), srs: toSrsDto(r.c) })))
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
  } catch (e) {
    console.error('API GET error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 })
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
})

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
        const parsed = ReviewBody.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'wordId and a valid grade (0, 3, 4 or 5) required' }, { status: 400 })
        const { wordId, grade, mode: reviewMode = 'review' } = parsed.data
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
            id: createId(),
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
        const { key } = body as { key?: string }
        const today = dayKey(new Date())
        const claimed = await getStat('challengeClaimedDate', '')
        if (claimed === today) return NextResponse.json({ ok: true, xpAwarded: 0, alreadyClaimed: true })
        const start = new Date(); start.setHours(0, 0, 0, 0)
        const end = new Date(); end.setHours(23, 59, 59, 999)
        const logs = await db.select().from(reviewLog).where(and(gte(reviewLog.reviewedAt, start), lte(reviewLog.reviewedAt, end)))
        // Review log only — every quiz answer is logged per question, so the
        // quizSession totals would double-count them (W1).
        const todayCorrect = logs.filter((l) => l.isCorrect).length
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
        const today = dayKey(new Date())
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
        const parsed = SettingsPatch.safeParse(body)
        if (!parsed.success) return NextResponse.json({ error: 'invalid settings payload' }, { status: 400 })
        const patch = parsed.data
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
          id: createId(),
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
  } catch (e) {
    console.error('API POST error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown error' }, { status: 500 })
  }
}
