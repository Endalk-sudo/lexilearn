// Client-side API client for LexiLearn.
// All calls go to /api/lexilearn?action=...

import type { Grade } from '@/lib/srs'

const BASE = '/api/lexilearn'

/**
 * Client request cache. Every tab switch used to fire 2-3 identical
 * getDashboardStats aggregations (sidebar counts + Today + Progress), each a
 * full server-side aggregation that slows as history grows.
 *
 * Two layers, both keyed by full URL:
 * - In-flight dedupe for every GET: concurrent identical requests share one
 *   fetch instead of stampeding the server.
 * - 10s TTL for slowly-changing reads (dashboard, decks, categories,
 *   settings). Review/search/deck pages are never TTL-cached — they must
 *   always be fresh. Mutations below call bustActions() so a write is never
 *   followed by a stale read.
 */
const inflight = new Map<string, Promise<unknown>>()
const ttlCache = new Map<string, { at: number; data: unknown }>()
const TTL_MS = 10_000
const TTL_ACTIONS = new Set(['dashboard', 'decks', 'categories', 'settings'])

function bustActions(...actions: string[]) {
  for (const key of [...ttlCache.keys()]) {
    if (actions.some((a) => key.includes(`action=${a}`))) ttlCache.delete(key)
  }
}

async function getJSON<T>(action: string, params: Record<string, string | number | null | undefined> = {}): Promise<T> {
  const url = new URL(BASE, window.location.origin)
  url.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }
  const key = url.toString()
  if (TTL_ACTIONS.has(action)) {
    const hit = ttlCache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T
  }
  const shared = inflight.get(key)
  if (shared) return shared as Promise<T>
  const p: Promise<T> = (async () => {
    const res = await fetch(key, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'request failed' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as T
    if (TTL_ACTIONS.has(action)) ttlCache.set(key, { at: Date.now(), data })
    return data
  })()
  inflight.set(key, p)
  try {
    return await p
  } finally {
    if (inflight.get(key) === p) inflight.delete(key)
  }
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
}

export type StudyTextScale = 'comfortable' | 'large' | 'largest'

export type Settings = {
  ttsVoice: string
  ttsRate: number
  dailyGoal: number
  theme: string
  autoSpeak: boolean
  studyText: StudyTextScale
  aiProvider?: 'auto' | 'ollama' | 'openrouter' | 'gemini'
  openRouterApiKey?: string
  hasOpenRouterKey?: boolean
  openRouterModel?: string
  geminiApiKey?: string
  hasGeminiKey?: boolean
  geminiModel?: string
  ollamaBaseUrl?: string
  ollamaModel?: string
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
  /** Every word in the deck, ignoring the current filter. */
  total: number
  /** Words matching the current filter — what the list is paging through. */
  filteredTotal: number
  masteredCount: number
  /** Opaque keyset cursor for the next page, or null when the list is exhausted. */
  nextCursor: string | null
}

export type DeckPageQuery = {
  cursor?: string | null
  limit?: number
  query?: string
  categoryId?: string | null
}

// ---------- API surface ----------
export const api = {
  getNewCards: (deckId: string | null, limit = 10, categoryId?: string | null) => getJSON<CardWithWord[]>('new', { deckId, limit, categoryId }),
  getReviewableCards: (deckId: string | null, limit = 50, categoryId?: string | null) => getJSON<CardWithWord[]>('reviewable', { deckId, limit, categoryId }),
  submitReview: (wordId: string, grade: Grade, mode: 'review' | 'learn' | 'dictation' | 'deck' = 'review') =>
    withRetry(() => postJSON<{ ok: boolean }>('review', { wordId, grade, mode })).then((r) => {
      // Every answer moves XP, streaks and counts — drop cached aggregates.
      bustActions('dashboard', 'analytics')
      return r
    }),
  getDecks: () => getJSON<DeckSummary[]>('decks'),
  getDeck: (deckId: string, page: DeckPageQuery = {}) => getJSON<DeckDetail>('deck', {
    deckId,
    cursor: page.cursor ?? undefined,
    limit: page.limit,
    query: page.query,
    categoryId: page.categoryId,
  }),
  createCustomDeck: (name: string, description: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categories?: string[] }[], parentId?: string | null) =>
    postJSON<{ id: string; count: number; skipped?: number }>('createDeck', { name, description, words, parentId }).then((r) => {
      bustActions('decks', 'dashboard', 'analytics', 'categories')
      return r
    }),
  setDeckParent: (deckId: string, parentId: string | null) => postJSON<{ ok: boolean }>('setDeckParent', { deckId, parentId }).then((r) => {
    bustActions('decks', 'dashboard', 'analytics')
    return r
  }),
  addWordsToDeck: (deckId: string, words: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categories?: string[] }[]) =>
    postJSON<{ count: number; skipped?: number; duplicates?: string[] }>('addWords', { deckId, words }).then((r) => {
      bustActions('decks', 'dashboard', 'analytics', 'categories')
      return r
    }),
  addWord: (deckId: string, fields: { word: string; pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categoryIds?: string[] }) =>
    postJSON<{ id: string }>('addWord', { deckId, ...fields }).then((r) => {
      bustActions('decks', 'dashboard', 'analytics', 'categories')
      return r
    }),
  updateWord: (wordId: string, fields: { pos?: string; ipa?: string; definition?: string; example?: string; cefr?: string; synonyms?: string; antonyms?: string; amharic?: string; categoryIds?: string[] }) =>
    postJSON<{ ok: boolean; word?: WordDTO }>('updateWord', { wordId, ...fields }).then((r) => {
      // Definitions feed deck search; categories feed counts.
      bustActions('categories')
      return r
    }),
  getCategories: () => getJSON<CategorySummary[]>('categories'),
  createCategory: (name: string, color?: string | null) => postJSON<{ id: string }>('createCategory', { name, color }).then((r) => {
    bustActions('categories')
    return r
  }),
  renameCategory: (categoryId: string, name: string) => postJSON<{ ok: boolean }>('renameCategory', { categoryId, name }).then((r) => {
    bustActions('categories')
    return r
  }),
  deleteCategory: (categoryId: string) => postJSON<{ ok: boolean }>('deleteCategory', { categoryId }).then((r) => {
    bustActions('categories')
    return r
  }),
  setWordCategories: (wordId: string, categoryIds: string[]) => postJSON<{ ok: boolean }>('setWordCategories', { wordId, categoryIds }).then((r) => {
    bustActions('categories')
    return r
  }),
  deleteWord: (wordId: string) => postJSON<{ ok: boolean }>('deleteWord', { wordId }).then((r) => {
    bustActions('decks', 'dashboard', 'analytics', 'categories')
    return r
  }),
  deleteDeck: (deckId: string) => postJSON<{ ok: boolean }>('deleteDeck', { deckId }).then((r) => {
    bustActions('decks', 'dashboard', 'analytics', 'categories')
    return r
  }),
  getDashboardStats: () => getJSON<DashboardStats>('dashboard'),
  getAnalytics: () => getJSON<Analytics>('analytics'),
  getSettings: () => getJSON<Settings>('settings'),
  updateSettings: (patch: Partial<Settings>) => postJSON<{ ok: boolean }>('updateSettings', patch).then((r) => {
    // dailyGoal is rendered on the dashboard.
    bustActions('settings', 'dashboard')
    return r
  }),
  resetProgress: () => postJSON<{ ok: boolean }>('reset', {}).then((r) => {
    bustActions('dashboard', 'analytics', 'decks', 'categories', 'settings')
    return r
  }),
  searchWords: (query: string) => getJSON<WordDTO[]>('search', { query }),
  repairStreak: () => postJSON<{ ok: boolean; streak: number }>('repairStreak', {}).then((r) => {
    bustActions('dashboard', 'analytics')
    return r
  }),
  claimChallenge: (key: string) => postJSON<{ ok: boolean; xpAwarded: number; alreadyClaimed?: boolean }>('claimChallenge', { key }).then((r) => {
    bustActions('dashboard', 'analytics')
    return r
  }),
  indexMentorKnowledge: () => postJSON<{ ok: boolean; indexed: number; total: number }>('mentorIndexKnowledge', {}),
  getOllamaStatus: () => getJSON<{ available: boolean; provider?: 'ollama' | 'openrouter' | 'gemini' | 'none'; model?: string; models: string[]; error?: string }>('ollamaStatus'),
  testAiConnection: (params: {
    provider: 'ollama' | 'openrouter' | 'gemini'
    apiKey?: string
    model?: string
    baseUrl?: string
  }) => postJSON<{ ok: boolean; message: string; model?: string }>('testAiConnection', params),
}
