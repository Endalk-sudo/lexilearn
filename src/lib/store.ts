// LexiLearn client-side view router (since only `/` is user-visible in this env).
// We use Zustand to switch between Dashboard / Learn / Review / Quiz / Decks / Stats / Settings.

'use client'

import { create } from 'zustand'

export type ViewName =
  | 'dashboard'
  | 'learn'
  | 'review'
  | 'quiz'
  | 'decks'
  | 'deck-detail'
  | 'custom-deck'
  | 'stats'
  | 'settings'
  | 'search'
  | 'mentor'

type AppState = {
  view: ViewName
  activeDeckId: string | null
  quizMode: 'mc' | 'reverse_mc' | 'typing' | 'spelling_bee' | 'speed_round' | null
  searchQuery: string
  setView: (v: ViewName) => void
  setActiveDeckId: (id: string | null) => void
  setQuizMode: (m: AppState['quizMode']) => void
  setSearchQuery: (q: string) => void
  navigate: (v: ViewName, opts?: { deckId?: string; quizMode?: AppState['quizMode']; query?: string }) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'dashboard',
  activeDeckId: null,
  quizMode: null,
  searchQuery: '',
  setView: (view) => set({ view }),
  setActiveDeckId: (activeDeckId) => set({ activeDeckId }),
  setQuizMode: (quizMode) => set({ quizMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  navigate: (view, opts = {}) =>
    set({
      view,
      activeDeckId: opts.deckId ?? null,
      quizMode: opts.quizMode ?? null,
      searchQuery: opts.query ?? '',
    }),
}))
