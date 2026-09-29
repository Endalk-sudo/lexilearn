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

  // 2. Read CSVs from docs/
  const p1Path = path.resolve(process.cwd(), 'docs/headwords_sixth_thousand_part1.csv')
  const p2Path = path.resolve(process.cwd(), 'docs/headwords_sixth_thousand_part2.csv')

  if (!fs.existsSync(p1Path) || !fs.existsSync(p2Path)) {
    throw new Error('docs/ CSV files not found!')
  }

  const p1Words = parseCsv(fs.readFileSync(p1Path, 'utf8'))
  const p2Words = parseCsv(fs.readFileSync(p2Path, 'utf8'))

  console.log(`  📄 Loaded Part 1: ${p1Words.length} words`)
  console.log(`  📄 Loaded Part 2: ${p2Words.length} words`)

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

  // 4. Create Sub-deck 1: Part 1
  const subDeck1Id = 'headwords-part-1'
  await db.insert(deck).values({
    id: subDeck1Id,
    name: 'Part 1 (Words 1–500)',
    description: 'Headwords Sixth Thousand: Part 1 (abduct – involuntary).',
    isCustom: false,
    parentId: parentDeckId,
  })

  // 5. Create Sub-deck 2: Part 2
  const subDeck2Id = 'headwords-part-2'
  await db.insert(deck).values({
    id: subDeck2Id,
    name: 'Part 2 (Words 501–1000)',
    description: 'Headwords Sixth Thousand: Part 2 (ironed – zoom).',
    isCustom: false,
    parentId: parentDeckId,
  })
  console.log('  📂 Created sub-decks: "Part 1 (Words 1–500)" and "Part 2 (Words 501–1000)"')

  // Helper to insert words inside a transaction
  const insertWords = (words: typeof p1Words, deckId: string, label: string) => {
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

  insertWords(p1Words, subDeck1Id, 'Part 1 (Words 1–500)')
  insertWords(p2Words, subDeck2Id, 'Part 2 (Words 501–1000)')

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
  console.log(`   Total words in database: ${p1Words.length + p2Words.length}`)
  console.log(`   Root deck: "Headwords Sixth Thousand"`)
  console.log(`   Sub-decks: "Part 1 (Words 1–500)" & "Part 2 (Words 501–1000)"`)
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
