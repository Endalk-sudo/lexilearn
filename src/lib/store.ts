'use client'

import { create } from 'zustand'

/**
 * Canonical views. One flat level - no more alias views, no nested tab strips.
 * Five of these are bottom tabs; 'quiz', 'dictation' and 'library-deck' are drill-ins
 * reached from an action, never a tab of their own.
 */
export type ViewName =
  | 'today'
  | 'learn'
  | 'review'
  | 'quiz'
  | 'library'
  | 'library-deck'
  | 'dictation'
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

export type AccentTheme = {
  name: string
  hue: number
  color: string
}

export const ACCENT_THEMES: AccentTheme[] = [
  { name: 'Iris', hue: 259, color: 'oklch(0.65 0.18 259)' },
  { name: 'Sapphire', hue: 220, color: 'oklch(0.65 0.16 220)' },
  { name: 'Emerald', hue: 155, color: 'oklch(0.65 0.16 155)' },
  { name: 'Amber', hue: 50, color: 'oklch(0.72 0.16 50)' },
  { name: 'Rose', hue: 345, color: 'oklch(0.65 0.18 345)' },
]

export function syncAccentHue() {
  if (typeof window === 'undefined') return
  try {
    const saved = localStorage.getItem('lexilearn-accent-hue')
    if (saved) {
      const val = Number(saved)
      if (!Number.isNaN(val)) {
        document.documentElement.style.setProperty('--accent-hue', String(val))
        useAppStore.setState({ accentHue: val })
      }
    }
  } catch {}
}

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
  dictationDeckId: string | null
  searchQuery: string
  paletteOpen: boolean
  accentHue: number
  autoSpeak: boolean
  sidebarCollapsed: boolean
  navigate: (view: ViewName, opts?: NavigateOptions) => void
  applyRoute: (route: RouteState) => void
  setLibraryTab: (tab: LibraryTab) => void
  setProgressTab: (tab: ProgressTab) => void
  setCoachTab: (tab: CoachTab) => void
  setQuizMode: (mode: QuizMode | null) => void
  setDictationDeckId: (dictationDeckId: string | null) => void
  setSearchQuery: (query: string) => void
  setPaletteOpen: (open: boolean) => void
  setAccentHue: (hue: number) => void
  setAutoSpeak: (autoSpeak: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'today',
  deckId: null,
  libraryTab: 'decks',
  progressTab: 'overview',
  coachTab: 'coach',
  quizMode: null,
  dictationDeckId: null,
  searchQuery: '',
  paletteOpen: false,
  accentHue: 259,
  autoSpeak: typeof window !== 'undefined' ? localStorage.getItem('lexilearn-auto-speak') === 'true' : false,
  sidebarCollapsed: typeof window !== 'undefined' ? localStorage.getItem('lexilearn-sidebar-collapsed') === 'true' : false,

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
  setDictationDeckId: (dictationDeckId) => set({ dictationDeckId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setAccentHue: (accentHue) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lexilearn-accent-hue', String(accentHue))
      document.documentElement.style.setProperty('--accent-hue', String(accentHue))
    }
    set({ accentHue })
  },
  setAutoSpeak: (autoSpeak) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lexilearn-auto-speak', String(autoSpeak))
      window.dispatchEvent(new CustomEvent('lexilearn-settings-changed', { detail: { autoSpeak } }))
    }
    set({ autoSpeak })
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lexilearn-sidebar-collapsed', String(sidebarCollapsed))
    }
    set({ sidebarCollapsed })
  },
  toggleSidebar: () => {
    set((s) => {
      const next = !s.sidebarCollapsed
      if (typeof window !== 'undefined') {
        localStorage.setItem('lexilearn-sidebar-collapsed', String(next))
      }
      return { sidebarCollapsed: next }
    })
  },
}))

/** Views that correspond to a primary bottom tab, in order. */
export const TAB_VIEWS: ViewName[] = ['today', 'learn', 'review', 'library', 'progress']

export const VIEW_TITLES: Record<ViewName, string> = {
  today: 'Today',
  learn: 'Learn',
  review: 'Review',
  quiz: 'Quiz',
  dictation: 'Dictation',
  library: 'Library',
  'library-deck': 'Deck',
  progress: 'Progress',
  coach: 'AI Coach',
}
