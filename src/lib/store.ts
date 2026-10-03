'use client'

import { create } from 'zustand'

/**
 * Canonical views. One flat level - no more alias views, no nested tab strips.
 * Five of these are bottom tabs; 'dictation' and 'library-deck' are drill-ins
 * reached from an action, never a tab of their own.
 */
export type ViewName =
  | 'today'
  | 'learn'
  | 'review'
  | 'library'
  | 'library-deck'
  | 'dictation'
  | 'deck'
  | 'progress'
  | 'coach'

export type LibraryTab = 'decks' | 'dictionary'
export type ProgressTab = 'overview' | 'settings'
export type CoachTab = 'coach' | 'lab'
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

/**
 * Apply persisted study preferences (text scale + focus mode) before first
 * paint-dependent renders. Called once from the app shell; mirrors the
 * accentHue sync above. Server values (from getSettings) win when they
 * arrive — see the boot effect in app/page.tsx.
 */
export function syncStudyPrefs() {
  if (typeof window === 'undefined') return
  try {
    const studyText = localStorage.getItem('lexilearn-study-text')
    if (studyText === 'large' || studyText === 'largest') {
      document.documentElement.dataset.studyText = studyText
      useAppStore.setState({ studyText })
    } else {
      document.documentElement.dataset.studyText = 'comfortable'
    }
    const focusMode = localStorage.getItem('lexilearn-focus-mode') === 'true'
    document.documentElement.dataset.focusMode = focusMode ? 'on' : 'off'
    if (focusMode) useAppStore.setState({ focusMode })
    const sidebarCollapsed = localStorage.getItem('lexilearn-sidebar-collapsed') === 'true'
    if (sidebarCollapsed) useAppStore.setState({ sidebarCollapsed })
    const autoSpeak = localStorage.getItem('lexilearn-auto-speak') === 'true'
    if (autoSpeak) useAppStore.setState({ autoSpeak })
  } catch {}
}

export type NavigateOptions = {
  deckId?: string | null
  query?: string
  libraryTab?: LibraryTab
  progressTab?: ProgressTab
}

export type RouteState = {
  view: ViewName
  deckId: string | null
  libraryTab: LibraryTab
  progressTab: ProgressTab
  searchQuery: string
}

export type StudyCategory = { id: string; name: string } | null

type AppState = RouteState & {
  coachTab: CoachTab
  dictationDeckId: string | null
  /** One-shot: the deck the user tapped "Study" on — DeckDetailView enters study mode from it. */
  studyDeckId: string | null
  /** Category-scoped studying: Learn/Review filter to these words. */
  studyCategory: StudyCategory
  searchQuery: string
  paletteOpen: boolean
  shortcutsOpen: boolean
  accentHue: number
  autoSpeak: boolean
  /** Study text scale — global preference applied to Learn/Review/Dictation. */
  studyText: 'comfortable' | 'large' | 'largest'
  /** Focus mode: dims surrounding chrome and widens the study column. */
  focusMode: boolean
  sidebarCollapsed: boolean
  navigate: (view: ViewName, opts?: NavigateOptions) => void
  applyRoute: (route: RouteState) => void
  setLibraryTab: (tab: LibraryTab) => void
  setProgressTab: (tab: ProgressTab) => void
  setCoachTab: (tab: CoachTab) => void
  setDictationDeckId: (dictationDeckId: string | null) => void
  setStudyDeckId: (studyDeckId: string | null) => void
  setStudyCategory: (studyCategory: StudyCategory) => void
  setSearchQuery: (query: string) => void
  setPaletteOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setAccentHue: (hue: number) => void
  setAutoSpeak: (autoSpeak: boolean) => void
  setStudyText: (studyText: 'comfortable' | 'large' | 'largest') => void
  setFocusMode: (focusMode: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'today',
  deckId: null,
  libraryTab: 'decks',
  progressTab: 'overview',
  coachTab: 'coach',
  dictationDeckId: null,
  studyDeckId: null,
  studyCategory: null,
  searchQuery: '',
  paletteOpen: false,
  shortcutsOpen: false,
  accentHue: 259,
  autoSpeak: false,
  studyText: 'comfortable',
  focusMode: false,
  sidebarCollapsed: false,

  navigate: (view, opts = {}) =>
    set((s) => ({
      view,
      deckId: opts.deckId !== undefined ? opts.deckId : null,
      searchQuery: opts.query !== undefined ? opts.query : s.searchQuery,
      libraryTab: opts.libraryTab ?? s.libraryTab,
      progressTab: opts.progressTab ?? (view === 'progress' ? 'overview' : s.progressTab),
      // Drill-in scopes are one-shot: entering the route never carries a stale
      // deck scope from a different entry point, and leaving the route drops it.
      dictationDeckId: view === 'dictation' ? s.dictationDeckId : null,
      studyDeckId: view === 'library-deck' ? s.studyDeckId : null,
    })),

  applyRoute: (route) => set(route),
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  setProgressTab: (progressTab) => set({ progressTab }),
  setCoachTab: (coachTab) => set({ coachTab }),
  setDictationDeckId: (dictationDeckId) => set({ dictationDeckId }),
  setStudyDeckId: (studyDeckId) => set({ studyDeckId }),
  setStudyCategory: (studyCategory) => set({ studyCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
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
  setStudyText: (studyText) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lexilearn-study-text', studyText)
      document.documentElement.dataset.studyText = studyText
    }
    set({ studyText })
  },
  setFocusMode: (focusMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lexilearn-focus-mode', String(focusMode))
      document.documentElement.dataset.focusMode = focusMode ? 'on' : 'off'
    }
    set({ focusMode })
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
  dictation: 'Dictation',
  deck: 'Deck',
  library: 'Library',
  'library-deck': 'Deck',
  progress: 'Progress',
  coach: 'AI Coach',
}
