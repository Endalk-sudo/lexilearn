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
}

export type DeckSummary = {
  id: string
  name: string
  description: string | null
  isCustom: boolean
  wordCount: number
  createdAt: string
}

export type DeckDetail = {
  id: string
  name: string
  description: string | null
  isCustom: boolean
  words: (WordDTO & { srs: SrsCardDTO | null })[]
}

// ---------- API surface ----------
export const api = {
  getDueCards: (limit = 20) => getJSON<CardWithWord[]>('due', { limit }),
  getNewCards: (deckId: string | null, limit = 10) => getJSON<CardWithWord[]>('new', { deckId, limit }),
  getReviewableCards: (deckId: string | null, limit = 50) => getJSON<CardWithWord[]>('reviewable', { deckId, limit }),
  submitReview: (wordId: string, grade: Grade, mode: 'review' | 'learn' | 'quiz' = 'review') =>
    postJSON<{ ok: boolean }>('review', { wordId, grade, mode }),
  getDecks: () => getJSON<DeckSummary[]>('decks'),
  getDeck: (deckId: string) => getJSON<DeckDetail>('deck', { deckId }),
  createCustomDeck: (name: string, description: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string }[]) =>
    postJSON<{ id: string; count: number }>('createDeck', { name, description, words }),
  addWordsToDeck: (deckId: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string }[]) =>
    postJSON<{ count: number }>('addWords', { deckId, words }),
  addWord: (deckId: string, fields: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string }) =>
    postJSON<{ id: string }>('addWord', { deckId, ...fields }),
  updateWord: (wordId: string, fields: { pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string }) =>
    postJSON<{ ok: boolean }>('updateWord', { wordId, ...fields }),
  deleteWord: (wordId: string) => postJSON<{ ok: boolean }>('deleteWord', { wordId }),
  deleteDeck: (deckId: string) => postJSON<{ ok: boolean }>('deleteDeck', { deckId }),
  getDashboardStats: () => getJSON<DashboardStats>('dashboard'),
  getAnalytics: () => getJSON<Analytics>('analytics'),
  getSettings: () => getJSON<Settings>('settings'),
  updateSettings: (patch: Partial<Settings>) => postJSON<{ ok: boolean }>('updateSettings', patch),
  resetProgress: () => postJSON<{ ok: boolean }>('reset', {}),
  generateQuiz: (deckId: string | null, mode: QuizMode, count = 10) => getJSON<QuizQuestion[]>('quiz', { deckId, mode, count }),
  submitQuizSession: (mode: QuizMode, total: number, correct: number, xpEarned: number) =>
    postJSON<{ ok: boolean }>('quizSession', { mode, total, correct, xpEarned }),
  searchWords: (query: string) => getJSON<WordDTO[]>('search', { query }),
  repairStreak: () => postJSON<{ ok: boolean; streak: number }>('repairStreak', {}),
  claimChallenge: (key: string) => postJSON<{ ok: boolean; xpAwarded: number; alreadyClaimed?: boolean }>('claimChallenge', { key }),
}
