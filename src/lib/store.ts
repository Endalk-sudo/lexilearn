'use client'

import { create } from 'zustand'

/**
 * Canonical views. One flat level - no more alias views, no nested tab strips.
 * Five of these are bottom tabs; 'quiz' and 'library-deck' are drill-ins
 * reached from an action, never a tab of their own.
 */
export type ViewName =
  | 'today'
  | 'learn'
  | 'review'
  | 'quiz'
  | 'library'
  | 'library-deck'
  | 'progress'
  | 'coach'

export type LibraryTab = 'decks' | 'dictionary'
export type ProgressTab = 'overview' | 'settings'
export type CoachTab = 'coach' | 'lab'
export type QuizMode =
  | 'mc'
  | 'reverse_mc'
  | 'typing'
  | 'spelling_bee'
  | 'speed_round'
  | 'match'

export type NavigateOptions = {
  deckId?: string | null
  quizMode?: QuizMode | null
  query?: string
  libraryTab?: LibraryTab
  progressTab?: ProgressTab
}

export type RouteState = {
  view: ViewName
  deckId: string | null
  libraryTab: LibraryTab
  progressTab: ProgressTab
}

type AppState = RouteState & {
  coachTab: CoachTab
  quizMode: QuizMode | null
  searchQuery: string
  paletteOpen: boolean
  navigate: (view: ViewName, opts?: NavigateOptions) => void
  applyRoute: (route: RouteState) => void
  setLibraryTab: (tab: LibraryTab) => void
  setProgressTab: (tab: ProgressTab) => void
  setCoachTab: (tab: CoachTab) => void
  setQuizMode: (mode: QuizMode | null) => void
  setSearchQuery: (query: string) => void
  setPaletteOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'today',
  deckId: null,
  libraryTab: 'decks',
  progressTab: 'overview',
  coachTab: 'coach',
  quizMode: null,
  searchQuery: '',
  paletteOpen: false,

  navigate: (view, opts = {}) =>
    set((s) => ({
      view,
      deckId: opts.deckId !== undefined ? opts.deckId : view === 'library-deck' ? s.deckId : null,
      quizMode: opts.quizMode !== undefined ? opts.quizMode : view === 'quiz' ? s.quizMode : null,
      searchQuery: opts.query !== undefined ? opts.query : s.searchQuery,
      libraryTab: opts.libraryTab ?? s.libraryTab,
      progressTab: opts.progressTab ?? (view === 'progress' ? 'overview' : s.progressTab),
    })),

  applyRoute: (route) => set(route),
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  setProgressTab: (progressTab) => set({ progressTab }),
  setCoachTab: (coachTab) => set({ coachTab }),
  setQuizMode: (quizMode) => set({ quizMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}))

/** Views that correspond to a primary bottom tab, in order. */
export const TAB_VIEWS: ViewName[] = ['today', 'learn', 'review', 'library', 'progress']

export const VIEW_TITLES: Record<ViewName, string> = {
  today: 'Today',
  learn: 'Learn',
  review: 'Review',
  quiz: 'Quiz',
  library: 'Library',
  'library-deck': 'Deck',
  progress: 'Progress',
  coach: 'AI Coach',
}
