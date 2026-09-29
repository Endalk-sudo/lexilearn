// Client-side API client for LexiLearn.
// All calls go to /api/lexilearn?action=...

import type { Grade } from '@/lib/srs'

const BASE = '/api/lexilearn'

async function getJSON<T>(action: string, params: Record<string, string | number | null | undefined> = {}): Promise<T> {
  const url = new URL(BASE, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

async function postJSON<T>(action: string, body: any): Promise<T> {
  const url = new URL(BASE, window.location.origin)
  url.searchParams.set('action', action)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Retry a failed API call with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 500): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries <= 0) throw error
    await new Promise((resolve) => setTimeout(resolve, delay))
    return withRetry(fn, retries - 1, delay * 2)
  }
}

// ---------- Types ----------
export type CategoryDTO = {
  id: string
  name: string
  color: string | null
}

export type CategorySummary = CategoryDTO & {
  wordCount: number
  dueCount: number
  newCount: number
}

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
  categories: CategoryDTO[]
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

export type QuizMode =
  | 'mc'
  | 'reverse_mc'
  | 'typing'
  | 'spelling_bee'
  | 'speed_round'
  /** Client-side matching game; it requests mc questions underneath. */
  | 'match'

export type QuizQuestion = {
  id: string
  mode: QuizMode
  prompt: string
  promptWord?: WordDTO
  audioWord?: string
  definition?: string
  options?: string[]
  correctAnswer: string
  wordDTO: WordDTO
}

export type DashboardStats = {
  dueCount: number
  newCount: number
  learnedToday: number
  streak: number
  longestStreak: number
  lastSessionDate: string
  streakShieldAvailable: boolean
  streakGap: number
  streakShieldCooldownDays: number
  todayCorrect: number
  xpToday: number
  challengeClaimedDate: string
  totalXp: number
  totalReviews: number
  totalCorrect: number
  accuracy: number
  dailyGoal: number
  masteredCount: number
  learningCount: number
  reviewingCount: number
  totalWords: number
  level: { name: string; minXp: number }
  nextLevel: { name: string; minXp: number } | null
  levelPct: number
  nextReviewForecast: { date: string; count: number }[]
  heatmap: { date: string; count: number; correct: number }[]
}

export type Analytics = {
  totalReviews: number
  totalCorrect: number
  accuracy: number
  masteredCount: number
  learningCount: number
  reviewingCount: number
  newCount: number
  totalWords: number
  totalXp: number
  streak: number
  longestStreak: number
  recentLogs: { id: number; word: string; grade: number; mode: string; isCorrect: boolean; reviewedAt: string }[]
  perDeck: { id: string; name: string; total: number; mastered: number; learning: number; reviewing: number; new: number; accuracy: number }[]
  weeklyActivity: { date: string; count: number; correct: number }[]
  gradeDistribution: { grade: number; count: number }[]
  heatmap: { date: string; count: number; correct: number }[]
  quizSessions: { id: string; mode: string; total: number; correct: number; xpEarned: number; completedAt: string | null }[]
}

export type Settings = {
  ttsVoice: string
  ttsRate: number
  dailyGoal: number
  theme: string
  autoSpeak: boolean
}

export type DeckSummary = {
  id: string
  name: string
  description: string | null
  isCustom: boolean
  parentId: string | null
  wordCount: number
  directWordCount?: number
  subDeckCount?: number
  createdAt: string
}

export type SubDeckSummary = {
  id: string
  name: string
  wordCount: number
  isCustom?: boolean
}

export type DeckAncestor = {
  id: string
  name: string
}

export type DeckDetail = {
  id: string
  name: string
  description: string | null
  isCustom: boolean
  parentId: string | null
  parent?: { id: string; name: string } | null
  ancestors?: DeckAncestor[]
  subDecks: SubDeckSummary[]
  words: (WordDTO & { srs: SrsCardDTO | null })[]
}

// ---------- API surface ----------
export const api = {
  getNewCards: (deckId: string | null, limit = 10, categoryId?: string | null) => getJSON<CardWithWord[]>('new', { deckId, limit, categoryId }),
  getReviewableCards: (deckId: string | null, limit = 50, categoryId?: string | null) => getJSON<CardWithWord[]>('reviewable', { deckId, limit, categoryId }),
  submitReview: (wordId: string, grade: Grade, mode: 'review' | 'learn' | 'quiz' | 'dictation' | 'match' = 'review') =>
    withRetry(() => postJSON<{ ok: boolean }>('review', { wordId, grade, mode })),
  getDecks: () => getJSON<DeckSummary[]>('decks'),
  getDeck: (deckId: string) => getJSON<DeckDetail>('deck', { deckId }),
  createCustomDeck: (name: string, description: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categories?: string[] }[], parentId?: string | null) =>
    postJSON<{ id: string; count: number; skipped?: number }>('createDeck', { name, description, words, parentId }),
  setDeckParent: (deckId: string, parentId: string | null) => postJSON<{ ok: boolean }>('setDeckParent', { deckId, parentId }),
  addWordsToDeck: (deckId: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categories?: string[] }[]) =>
    postJSON<{ count: number; skipped?: number; duplicates?: string[] }>('addWords', { deckId, words }),
  addWord: (deckId: string, fields: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categoryIds?: string[] }) =>
    postJSON<{ id: string }>('addWord', { deckId, ...fields }),
  updateWord: (wordId: string, fields: { pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categoryIds?: string[] }) =>
    postJSON<{ ok: boolean }>('updateWord', { wordId, ...fields }),
  getCategories: () => getJSON<CategorySummary[]>('categories'),
  createCategory: (name: string, color?: string | null) => postJSON<{ id: string }>('createCategory', { name, color }),
  renameCategory: (categoryId: string, name: string) => postJSON<{ ok: boolean }>('renameCategory', { categoryId, name }),
  deleteCategory: (categoryId: string) => postJSON<{ ok: boolean }>('deleteCategory', { categoryId }),
  setWordCategories: (wordId: string, categoryIds: string[]) => postJSON<{ ok: boolean }>('setWordCategories', { wordId, categoryIds }),
  deleteWord: (wordId: string) => postJSON<{ ok: boolean }>('deleteWord', { wordId }),
  deleteDeck: (deckId: string) => postJSON<{ ok: boolean }>('deleteDeck', { deckId }),
  getDashboardStats: () => getJSON<DashboardStats>('dashboard'),
  getAnalytics: () => getJSON<Analytics>('analytics'),
  getSettings: () => getJSON<Settings>('settings'),
  updateSettings: (patch: Partial<Settings>) => postJSON<{ ok: boolean }>('updateSettings', patch),
  resetProgress: () => postJSON<{ ok: boolean }>('reset', {}),
  generateQuiz: (deckId: string | null, mode: QuizMode, count = 10, categoryId?: string | null) => getJSON<QuizQuestion[]>('quiz', { deckId, mode, count, categoryId }),
  submitQuizSession: (mode: QuizMode, total: number, correct: number, xpEarned: number) =>
    postJSON<{ ok: boolean }>('quizSession', { mode, total, correct, xpEarned }),
  searchWords: (query: string) => getJSON<WordDTO[]>('search', { query }),
  repairStreak: () => postJSON<{ ok: boolean; streak: number }>('repairStreak', {}),
  claimChallenge: (key: string) => postJSON<{ ok: boolean; xpAwarded: number; alreadyClaimed?: boolean }>('claimChallenge', { key }),
  indexMentorKnowledge: () => postJSON<{ ok: boolean; indexed: number; total: number }>('mentorIndexKnowledge', {}),
  getOllamaStatus: () => getJSON<{ available: boolean; models: string[]; error?: string }>('ollamaStatus'),
}
