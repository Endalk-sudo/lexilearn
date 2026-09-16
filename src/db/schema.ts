// LexiLearn Drizzle schema — mirrors the previous Prisma schema 1:1.
// Table/column names and SQLite storage formats are byte-compatible with the
// existing db/custom.db, so the current database file works unchanged.
import { sqliteTable, integer, text, real, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { createId } from './id'

// ---------- Helpers ----------
const nowMs = () => new Date()
const cuid = () => createId()

/** Prisma-style `@id @default(cuid())` text primary key. */
const idPk = () => text('id').primaryKey().$defaultFn(cuid)
/** Prisma-style `@default(now())` timestamp column. */
const createdAt = () => integer('createdAt', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowMs)
/** Prisma-style `@updatedAt` timestamp column. */
const updatedAt = () => integer('updatedAt', { mode: 'timestamp_ms' }).notNull().$onUpdate(nowMs)

// ---------- Core vocabulary / SRS ----------
export const deck = sqliteTable('Deck', {
  id: idPk(),
  name: text('name').notNull(),
  description: text('description'),
  isCustom: integer('isCustom', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
})

export const word = sqliteTable('Word', {
  id: idPk(),
  word: text('word').notNull(),
  pos: text('pos'),
  ipa: text('ipa'),
  syllables: text('syllables'),
  cefr: text('cefr'),
  definitions: text('definitions'),
  examples: text('examples'),
  synonyms: text('synonyms'),
  antonyms: text('antonyms'),
  etymology: text('etymology'),
  amharic: text('amharic'),
  deckId: text('deckId').notNull().references(() => deck.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [
  index('Word_deckId_idx').on(t.deckId),
  index('Word_word_idx').on(t.word),
])

export const srsCard = sqliteTable('SrsCard', {
  wordId: text('wordId').primaryKey().references(() => word.id, { onDelete: 'cascade' }),
  easeFactor: real('easeFactor').notNull().default(2.5),
  interval: integer('interval').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  nextReview: integer('nextReview', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowMs),
  lastReviewed: integer('lastReviewed', { mode: 'timestamp_ms' }),
  status: text('status').notNull().default('new'),
  totalReviews: integer('totalReviews').notNull().default(0),
  correctReviews: integer('correctReviews').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('SrsCard_nextReview_idx').on(t.nextReview),
  index('SrsCard_status_idx').on(t.status),
])

export const reviewLog = sqliteTable('ReviewLog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wordId: text('wordId').notNull(),
  word: text('word').notNull(),
  deckId: text('deckId'),
  grade: integer('grade').notNull(),
  mode: text('mode').notNull(),
  isCorrect: integer('isCorrect', { mode: 'boolean' }).notNull(),
  reviewedAt: integer('reviewedAt', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowMs),
}, (t) => [
  index('ReviewLog_reviewedAt_idx').on(t.reviewedAt),
  index('ReviewLog_wordId_idx').on(t.wordId),
])

export const quizSession = sqliteTable('QuizSession', {
  id: idPk(),
  mode: text('mode').notNull(),
  total: integer('total').notNull(),
  correct: integer('correct').notNull(),
  xpEarned: integer('xpEarned').notNull().default(0),
  startedAt: integer('startedAt', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowMs),
  completedAt: integer('completedAt', { mode: 'timestamp_ms' }),
})

export const appStat = sqliteTable('AppStat', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

// ---------- AI Mentor history / logs ----------
export const mentorSession = sqliteTable('MentorSession', {
  id: idPk(),
  mode: text('mode').notNull(),
  title: text('title'),
  prompt: text('prompt'),
  response: text('response'),
  metadata: text('metadata'),
  createdAt: createdAt(),
}, (t) => [
  index('MentorSession_mode_idx').on(t.mode),
  index('MentorSession_createdAt_idx').on(t.createdAt),
])

export const errorLog = sqliteTable('ErrorLog', {
  id: idPk(),
  type: text('type').notNull(),
  original: text('original').notNull(),
  corrected: text('corrected'),
  explanation: text('explanation'),
  wordId: text('wordId'),
  source: text('source'),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  index('ErrorLog_type_idx').on(t.type),
  index('ErrorLog_resolved_idx').on(t.resolved),
  index('ErrorLog_createdAt_idx').on(t.createdAt),
])

export const practiceMaterial = sqliteTable('PracticeMaterial', {
  id: idPk(),
  type: text('type').notNull(),
  title: text('title'),
  content: text('content').notNull(),
  wordIds: text('wordIds'),
  deckId: text('deckId'),
  difficulty: text('difficulty'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
}, (t) => [
  index('PracticeMaterial_type_idx').on(t.type),
  index('PracticeMaterial_createdAt_idx').on(t.createdAt),
])


// ---------- Branching AI Mentor domain model ----------
export const mentorAttempt = sqliteTable('MentorAttempt', {
  id: idPk(),
  nodeId: text('nodeId').notNull().references(() => mentorNode.id, { onDelete: 'cascade' }),
  branchId: text('branchId').notNull().references(() => mentorBranch.id, { onDelete: 'cascade' }),
  answer: text('answer').notNull(),
  confidence: integer('confidence'),
  timeMs: integer('timeMs'),
  keystrokes: integer('keystrokes'),
  hintLevel: integer('hintLevel').notNull().default(0),
  selfCorrect: text('selfCorrect'),
  createdAt: createdAt(),
}, (t) => [
  index('MentorAttempt_nodeId_idx').on(t.nodeId),
  index('MentorAttempt_branchId_idx').on(t.branchId),
  index('MentorAttempt_createdAt_idx').on(t.createdAt),
])

export const mentorProject = sqliteTable('MentorProject', {
  id: idPk(),
  name: text('name').notNull(),
  goal: text('goal'),
  createdAt: createdAt(),
})

export const mentorBranch = sqliteTable('MentorBranch', {
  id: idPk(),
  projectId: text('projectId').notNull().references(() => mentorProject.id, { onDelete: 'cascade' }),
  parentBranchId: text('parentBranchId').references((): AnySQLiteColumn => mentorBranch.id, { onDelete: 'set null' }),
  parentNodeId: text('parentNodeId'),
  title: text('title').notNull(),
  focusTag: text('focusTag').notNull(),
  mode: text('mode').notNull(),
  difficultyCeiling: integer('difficultyCeiling').notNull().default(3),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
}, (t) => [
  index('MentorBranch_projectId_idx').on(t.projectId),
  index('MentorBranch_parentBranchId_idx').on(t.parentBranchId),
])

export const mentorNode = sqliteTable('MentorNode', {
  id: idPk(),
  branchId: text('branchId').notNull().references(() => mentorBranch.id, { onDelete: 'cascade' }),
  parentNodeId: text('parentNodeId'),
  kind: text('kind').notNull().default('question'),
  prompt: text('prompt').notNull(),
  expectedPatterns: text('expectedPatterns').notNull(),
  hints: text('hints').notNull(),
  targetTags: text('targetTags').notNull(),
  difficulty: integer('difficulty').notNull().default(1),
  createdAt: createdAt(),
}, (t) => [
  index('MentorNode_branchId_idx').on(t.branchId),
  index('MentorNode_parentNodeId_idx').on(t.parentNodeId),
])


export const mentorFeedback = sqliteTable('MentorFeedback', {
  id: idPk(),
  attemptId: text('attemptId').notNull().unique().references(() => mentorAttempt.id, { onDelete: 'cascade' }),
  scores: text('scores').notNull(),
  corrections: text('corrections').notNull(),
  explanation: text('explanation').notNull(),
  nativeVersion: text('nativeVersion').notNull(),
  followUp: text('followUp').notNull(),
  diff: text('diff').notNull(),
  masteryDelta: text('masteryDelta').notNull(),
  diagnosis: text('diagnosis'),
  rawJson: text('rawJson'),
})

export const mentorErrorCard = sqliteTable('MentorErrorCard', {
  id: idPk(),
  tag: text('tag').notNull(),
  errorType: text('errorType').notNull(),
  wrong: text('wrong').notNull(),
  right: text('right').notNull(),
  context: text('context').notNull(),
  ease: real('ease').notNull().default(2.5),
  intervalDays: integer('intervalDays').notNull().default(1),
  dueAt: integer('dueAt', { mode: 'timestamp_ms' }).notNull().$defaultFn(nowMs),
  lapses: integer('lapses').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('MentorErrorCard_dueAt_idx').on(t.dueAt),
  index('MentorErrorCard_tag_idx').on(t.tag),
])

export const mentorSkillMastery = sqliteTable('MentorSkillMastery', {
  tag: text('tag').primaryKey(),
  mastery: real('mastery').notNull().default(0.5),
  attempts: integer('attempts').notNull().default(0),
  correct: integer('correct').notNull().default(0),
  lastSeen: integer('lastSeen', { mode: 'timestamp_ms' }),
  nextReview: integer('nextReview', { mode: 'timestamp_ms' }),
})

export const mentorProfile = sqliteTable('MentorProfile', {
  id: integer('id').primaryKey().$defaultFn(() => 1),
  goals: text('goals'),
  preferences: text('preferences'),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const mentorTurn = sqliteTable('MentorTurn', {
  id: idPk(),
  branchId: text('branchId').notNull(),
  nodeId: text('nodeId'),
  role: text('role').notNull(),
  content: text('content').notNull(),
  meta: text('meta'),
  createdAt: createdAt(),
}, (t) => [
  index('MentorTurn_branchId_idx').on(t.branchId),
  index('MentorTurn_createdAt_idx').on(t.createdAt),
])


export const mentorKnowledge = sqliteTable('MentorKnowledge', {
  id: idPk(),
  title: text('title').notNull(),
  tag: text('tag').notNull(),
  content: text('content').notNull(),
  embedding: text('embedding'),
  source: text('source'),
  createdAt: createdAt(),
}, (t) => [
  index('MentorKnowledge_tag_idx').on(t.tag),
])

export const mentorWeeklyReport = sqliteTable('MentorWeeklyReport', {
  id: idPk(),
  weekKey: text('weekKey').notNull().unique(),
  summary: text('summary').notNull(),
  strengths: text('strengths').notNull(),
  weaknesses: text('weaknesses').notNull(),
  topErrors: text('topErrors').notNull(),
  confidence: text('confidence').notNull(),
  nextFocus: text('nextFocus').notNull(),
  actionPlan: text('actionPlan').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const pronunciationAttempt = sqliteTable('PronunciationAttempt', {
  id: idPk(),
  target: text('target').notNull(),
  transcript: text('transcript').notNull(),
  accuracy: real('accuracy').notNull(),
  missingWords: text('missingWords').notNull(),
  extraWords: text('extraWords').notNull(),
  feedback: text('feedback').notNull(),
  createdAt: createdAt(),
}, (t) => [
  index('PronunciationAttempt_createdAt_idx').on(t.createdAt),
])

export const naturalnessAttempt = sqliteTable('NaturalnessAttempt', {
  id: idPk(),
  input: text('input').notNull(),
  score: real('score').notNull(),
  verdict: text('verdict').notNull(),
  native: text('native').notNull(),
  alternatives: text('alternatives').notNull(),
  explanation: text('explanation').notNull(),
  createdAt: createdAt(),
})

// ---------- Relations (Prisma `include` equivalents for RQB `with`) ----------
export const deckRelations = relations(deck, ({ many, one }) => ({
  words: many(word),
}))

export const wordRelations = relations(word, ({ one }) => ({
  deck: one(deck, { fields: [word.deckId], references: [deck.id] }),
  srsCard: one(srsCard, { fields: [word.id], references: [srsCard.wordId] }),
}))

export const srsCardRelations = relations(srsCard, ({ one }) => ({
  word: one(word, { fields: [srsCard.wordId], references: [word.id] }),
}))

export const mentorProjectRelations = relations(mentorProject, ({ many }) => ({
  branches: many(mentorBranch),
}))

export const mentorBranchRelations = relations(mentorBranch, ({ one, many }) => ({
  project: one(mentorProject, { fields: [mentorBranch.projectId], references: [mentorProject.id] }),
  parent: one(mentorBranch, { relationName: 'MentorBranchToParent', fields: [mentorBranch.parentBranchId], references: [mentorBranch.id] }),
  children: many(mentorBranch, { relationName: 'MentorBranchToParent' }),
  nodes: many(mentorNode),
  attempts: many(mentorAttempt),
}))

export const mentorNodeRelations = relations(mentorNode, ({ one, many }) => ({
  branch: one(mentorBranch, { fields: [mentorNode.branchId], references: [mentorBranch.id] }),
  parent: one(mentorNode, { relationName: 'MentorNodeToParent', fields: [mentorNode.parentNodeId], references: [mentorNode.id] }),
  children: many(mentorNode, { relationName: 'MentorNodeToParent' }),
  attempts: many(mentorAttempt),
}))

export const mentorAttemptRelations = relations(mentorAttempt, ({ one }) => ({
  node: one(mentorNode, { fields: [mentorAttempt.nodeId], references: [mentorNode.id] }),
  branch: one(mentorBranch, { fields: [mentorAttempt.branchId], references: [mentorBranch.id] }),
  feedback: one(mentorFeedback, { fields: [mentorAttempt.id], references: [mentorFeedback.attemptId] }),
}))

export const mentorFeedbackRelations = relations(mentorFeedback, ({ one }) => ({
  attempt: one(mentorAttempt, { fields: [mentorFeedback.attemptId], references: [mentorAttempt.id] }),
}))

// ---------- Types ----------
export type Deck = typeof deck.$inferSelect
export type Word = typeof word.$inferSelect
export type SrsCard = typeof srsCard.$inferSelect
export type ReviewLog = typeof reviewLog.$inferSelect
export type QuizSession = typeof quizSession.$inferSelect
export type AppStat = typeof appStat.$inferSelect
export type MentorSession = typeof mentorSession.$inferSelect
export type ErrorLog = typeof errorLog.$inferSelect
export type PracticeMaterial = typeof practiceMaterial.$inferSelect
export type MentorProject = typeof mentorProject.$inferSelect
export type MentorBranch = typeof mentorBranch.$inferSelect
export type MentorNode = typeof mentorNode.$inferSelect
export type MentorAttempt = typeof mentorAttempt.$inferSelect
export type MentorFeedback = typeof mentorFeedback.$inferSelect
export type MentorErrorCard = typeof mentorErrorCard.$inferSelect
export type MentorSkillMastery = typeof mentorSkillMastery.$inferSelect
export type MentorProfile = typeof mentorProfile.$inferSelect
export type MentorTurn = typeof mentorTurn.$inferSelect
export type MentorKnowledge = typeof mentorKnowledge.$inferSelect
export type MentorWeeklyReport = typeof mentorWeeklyReport.$inferSelect
export type PronunciationAttempt = typeof pronunciationAttempt.$inferSelect
export type NaturalnessAttempt = typeof naturalnessAttempt.$inferSelect

