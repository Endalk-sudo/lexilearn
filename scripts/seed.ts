// LexiLearn seed script — populates the "English Vocabulary CEFR A1–B2" deck
// hierarchy from the curated per-level CSVs in docs/.
// Run with: pnpm db:seed

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { resolveDbPath } from '../src/db/env'
import * as schema from '../src/db/schema'
import { createId } from '../src/db/id'
import { parseCsv } from '../src/features/library/lib/csv-parser'

const sqlite = new Database(resolveDbPath())
sqlite.pragma('foreign_keys = ON')
export const db = drizzle(sqlite, { schema })

const {
  deck, word, srsCard, reviewLog, quizSession, appStat, category, wordCategory,
  mentorSession, errorLog, practiceMaterial, mentorProject, mentorBranch,
  mentorNode, mentorAttempt, mentorFeedback, mentorErrorCard, mentorSkillMastery,
  mentorProfile, mentorTurn, mentorKnowledge, mentorWeeklyReport,
  pronunciationAttempt, naturalnessAttempt,
} = schema

const ROOT_DECK_ID = 'english-cefr-vocabulary'
const ROOT_DECK_NAME = 'English Vocabulary (CEFR A1–B2)'

/** CEFR levels, easiest first — the order sub-decks are created in. */
const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
type Level = (typeof LEVELS)[number]

/** Per-level deck copy. B1/B2 are the exam-prep stretch; A1/A2 the foundation. */
const LEVEL_BLURB: Record<Level, string> = {
  A1: 'Foundation: the most frequent everyday words, phrasal basics and core function words.',
  A2: 'Elementary: everyday topics, routines, descriptions and common workplace language.',
  B1: 'Intermediate: familiar work, travel and study topics with everyday idiom.',
  B2: 'Upper-intermediate: nuanced argument, academic register and exam-prep lexis.',
}

const csvPath = (level: Level) =>
  path.resolve(process.cwd(), `docs/${level}_Vocabulary.csv`)

async function main() {
  console.log(`🌱 Seeding LexiLearn database with ${ROOT_DECK_NAME}...`)

  // 1. Wipe all existing data and progress completely
  console.log('  🧹 Cleaning all tables and progress...')
  const allMentorTables = [
    pronunciationAttempt, naturalnessAttempt, mentorWeeklyReport,
    mentorSkillMastery, mentorErrorCard, mentorFeedback, mentorAttempt,
    mentorNode, mentorBranch, mentorTurn, mentorKnowledge, mentorSession,
    practiceMaterial, errorLog, mentorProfile, mentorProject,
  ]
  for (const t of allMentorTables) await db.delete(t)
  await db.delete(reviewLog)
  await db.delete(quizSession)
  await db.delete(srsCard)
  await db.delete(wordCategory)
  await db.delete(category)
  await db.delete(word)
  await db.delete(deck)
  await db.delete(appStat)

  // 2. Read the CEFR-level CSVs from docs/
  for (const level of LEVELS) {
    const p = csvPath(level)
    if (!fs.existsSync(p)) throw new Error(`Missing CSV: ${p}`)
  }

  const wordsByLevel = LEVELS.map((level) => {
    const words = parseCsv(fs.readFileSync(csvPath(level), 'utf8'))
    // Guard against a silent column-shift: a shifted parse still "succeeds",
    // it just fills the wrong fields (see csv-parser's header detection).
    const bad = words.filter((w) => !w.word || !w.definition || !w.example || !w.cefr)
    if (bad.length) {
      throw new Error(
        `${level}: ${bad.length} row(s) missing word/definition/example/cefr — ` +
          `bad header mapping? e.g. "${bad[0]!.word}". ` +
          `Got keys: ${JSON.stringify(Object.keys(words[0] ?? {}))}`,
      )
    }
    const offLevel = words.filter((w) => w.cefr!.trim().toUpperCase() !== level)
    if (offLevel.length) {
      console.warn(`  ⚠️  ${level}: ${offLevel.length} row(s) tagged with another level; keeping their CSV tag.`)
    }
    return { level, words }
  })

  for (const { level, words } of wordsByLevel) {
    console.log(`  📄 Loaded CEFR ${level}: ${words.length} words`)
  }

  // 3. Create Parent Deck
  const totalWords = wordsByLevel.reduce((n, w) => n + w.words.length, 0)
  await db.insert(deck).values({
    id: ROOT_DECK_ID,
    name: ROOT_DECK_NAME,
    description:
      `Curated English vocabulary graded A1→B2 (${totalWords.toLocaleString('en-US')} words) with ` +
      `part of speech, definition, example sentence and synonyms. Ships with the app.`,
    isCustom: false,
    parentId: null,
  })
  console.log(`  🏛️  Created parent deck: "${ROOT_DECK_NAME}"`)

  // 4. Create one sub-deck per CEFR level
  const subDecks = wordsByLevel.map(({ level, words }) => ({
    id: `english-cefr-${level.toLowerCase()}`,
    name: `CEFR ${level} (${words.length.toLocaleString('en-US')} words)`,
    description: `${LEVEL_BLURB[level]} ${words.length.toLocaleString('en-US')} words, ranked easiest to hardest.`,
    isCustom: false,
    parentId: ROOT_DECK_ID,
    words,
  }))

  for (const sd of subDecks) {
    await db.insert(deck).values({
      id: sd.id,
      name: sd.name,
      description: sd.description,
      isCustom: sd.isCustom,
      parentId: sd.parentId,
    })
  }
  console.log(`  📂 Created sub-decks: ${subDecks.map((s) => s.name).join(', ')}`)

  // Helper to insert words inside a transaction
  const insertWords = (words: typeof wordsByLevel[number]['words'], deckId: string, label: string) => {
    const insertStmt = sqlite.prepare(`
      INSERT INTO Word (id, word, pos, ipa, cefr, definitions, examples, synonyms, antonyms, amharic, deckId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Word_word_deckId_unique makes a repeated headword inside one deck a hard
    // failure, so drop repeats here and report them instead of crashing halfway.
    const seen = new Set<string>()
    const unique = words.filter((w) => {
      const key = w.word.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    sqlite.transaction(() => {
      // One timestamp per row, in CSV rank order: deck pages walk
      // (createdAt, id), so a single shared `now` would shuffle the curated
      // ranking into random id order.
      const base = Date.now()
      for (const [i, w] of unique.entries()) {
        const splitList = (s?: string) =>
          s ? JSON.stringify(s.split(/[|,]/).map((x) => x.trim()).filter(Boolean)) : JSON.stringify([])
        const defs = w.definition ? JSON.stringify([{ pos: w.pos ?? 'n.', text: w.definition }]) : JSON.stringify([])
        const exs = w.example ? JSON.stringify([w.example]) : JSON.stringify([])

        insertStmt.run(
          createId(),
          w.word.trim(),
          w.pos ?? null,
          w.ipa ?? null,
          w.cefr?.trim().toUpperCase() ?? null,
          defs,
          exs,
          // The curated decks ship synonyms in a `Contextual_Meaning` column,
          // which the parser maps onto `synonyms`.
          splitList(w.synonyms),
          splitList(w.antonyms),
          w.amharic ?? null,
          deckId,
          base + i
        )
      }
    })()

    const dropped = words.length - unique.length
    console.log(
      `  ✓ Inserted ${unique.length} words into "${label}"` +
        (dropped ? ` (skipped ${dropped} duplicate headword${dropped === 1 ? '' : 's'})` : ''),
    )
  }

  for (const sd of subDecks) {
    insertWords(sd.words, sd.id, sd.name)
  }

  // 6. Initialize App Stats (fresh starting stats, zero progress)
  const initialStats: Record<string, string> = {
    streak: '0',
    longestStreak: '0',
    lastSessionDate: '',
    totalXp: '0',
    dailyGoal: '20',
    ttsVoice: '',
    ttsRate: '1',
    theme: 'system',
    totalReviews: '0',
    totalCorrect: '0',
    achievements: '[]',
    streakShieldUsedDate: '',
    challengeClaimedDate: '',
  }
  for (const [k, v] of Object.entries(initialStats)) {
    await db.insert(appStat).values({ key: k, value: v }).onConflictDoNothing()
  }

  console.log(`\n🎉 Seed completed successfully!`)
  console.log(`   Total words in database: ${totalWords.toLocaleString('en-US')}`)
  console.log(`   Root deck: "${ROOT_DECK_NAME}"`)
  console.log(`   Sub-decks: ${subDecks.map((s) => s.name).join(', ')}`)
  console.log(`   SRS cards / review logs: 0 (100% fresh start)`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => {
    sqlite.close()
  })
