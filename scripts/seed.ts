// LexiLearn seed script — populates "Headwords Sixth Thousand" hierarchical deck
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

async function main() {
  console.log('🌱 Seeding LexiLearn database with Headwords Sixth Thousand...')

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

  // 2. Read CEFR-level CSVs from docs/
  const levels = ['b1', 'b2', 'c1', 'c2'] as const
  const csvPaths = levels.map((lvl) => path.resolve(process.cwd(), `docs/headwords_sixth_thousand_${lvl}.csv`))

  for (const p of csvPaths) {
    if (!fs.existsSync(p)) throw new Error(`Missing CSV: ${p}`)
  }

  const wordsByLevel = levels.map((lvl, i) => ({
    level: lvl.toUpperCase(),
    words: parseCsv(fs.readFileSync(csvPaths[i], 'utf8')),
  }))

  for (const { level, words } of wordsByLevel) {
    console.log(`  📄 Loaded CEFR ${level}: ${words.length} words`)
  }

  // 3. Create Parent Deck
  const parentDeckId = 'headwords-sixth-thousand'
  await db.insert(deck).values({
    id: parentDeckId,
    name: 'Headwords Sixth Thousand',
    description: 'Comprehensive advanced English vocabulary (B1–C2) with definitions, phonetics (IPA), examples, synonyms, antonyms, and Amharic translations.',
    isCustom: false,
    parentId: null,
  })
  console.log('  🏛️  Created parent deck: "Headwords Sixth Thousand"')

  // 4. Create one sub-deck per CEFR level
  const subDecks = wordsByLevel.map(({ level, words }) => ({
    id: `headwords-${level.toLowerCase()}`,
    name: `CEFR ${level} (${words.length} words)`,
    description: `Headwords Sixth Thousand: CEFR ${level} words (${words[0]?.word ?? '?'} – ${words[words.length - 1]?.word ?? '?'}).`,
    isCustom: false,
    parentId: parentDeckId,
    level,
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

    sqlite.transaction(() => {
      const now = Date.now()
      for (const w of words) {
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
          splitList(w.synonyms),
          splitList(w.antonyms),
          w.amharic ?? null,
          deckId,
          now
        )
      }
    })()
    console.log(`  ✓ Inserted ${words.length} words into "${label}"`)
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

  const totalWords = wordsByLevel.reduce((n, w) => n + w.words.length, 0)
  console.log(`\n🎉 Seed completed successfully!`)
  console.log(`   Total words in database: ${totalWords}`)
  console.log(`   Root deck: "Headwords Sixth Thousand"`)
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
