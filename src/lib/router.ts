'use client'

import { useEffect } from 'react'
import { useAppStore, type LibraryTab, type ProgressTab, type RouteState, type ViewName } from '@/lib/store'

/**
 * Tiny hash router. Keeps browser back/forward and deep links working
 * (#/review, #/dictation, #/library/decks/<id>, #/progress/settings) without turning the
 * local-first SPA into a multi-route app.
 */

const HASH_FOR_VIEW: Record<ViewName, string> = {
  today: 'today',
  learn: 'learn',
  review: 'review',
  quiz: 'quiz',
  dictation: 'dictation',
  library: 'library',
  'library-deck': 'library',
  progress: 'progress',
  coach: 'coach',
}

export function parseHash(hash: string): RouteState {
  const clean = hash.replace(/^#\/?/, '')
  const [path, query = ''] = clean.split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(query)
  const tab = params.get('tab')
  const q = params.get('q') ?? ''
  const head = parts[0] ?? 'today'

  const libraryTab: LibraryTab = tab === 'dictionary' ? 'dictionary' : 'decks'
  const progressTab: ProgressTab = parts[1] === 'settings' || tab === 'settings' ? 'settings' : 'overview'
  const searchQuery = q.slice(0, 200)

  switch (head) {
    case 'learn':
    case 'review':
    case 'quiz':
    case 'dictation':
    case 'coach':
      return { view: head, deckId: null, libraryTab, progressTab, searchQuery: '' }
    case 'library':
      return {
        view: parts[1] ? 'library-deck' : 'library',
        deckId: parts[1] ? decodeURIComponent(parts[1]) : null,
        libraryTab,
        progressTab,
        searchQuery: parts[1] ? '' : searchQuery,
      }
    case 'progress':
      return { view: 'progress', deckId: null, libraryTab, progressTab, searchQuery: '' }
    case 'today':
    default:
      return { view: 'today', deckId: null, libraryTab, progressTab, searchQuery: '' }
  }
}

export function routeToHash(route: RouteState): string {
  if (route.view === 'library-deck' && route.deckId) {
    return `#/library/${encodeURIComponent(route.deckId)}`
  }
  if (route.view === 'library') {
    const params = new URLSearchParams()
    if (route.libraryTab === 'dictionary') params.set('tab', 'dictionary')
    if (route.libraryTab === 'dictionary' && route.searchQuery.trim()) {
      params.set('q', route.searchQuery.trim().slice(0, 200))
    }
    const qs = params.toString()
    return qs ? `#/library?${qs}` : '#/library'
  }
  if (route.view === 'progress' && route.progressTab === 'settings') return '#/progress/settings'
  return `#/${HASH_FOR_VIEW[route.view]}`
}

let syncingFromUrl = false

/** Mount once, in the app shell. Keeps the URL and the store in step. */
export function useRouteSync() {
  useEffect(() => {
    const apply = (hash: string) => {
      syncingFromUrl = true
      useAppStore.getState().applyRoute(parseHash(hash))
      syncingFromUrl = false
    }

    apply(window.location.hash)

    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (
        state.view === prev.view &&
        state.deckId === prev.deckId &&
        state.libraryTab === prev.libraryTab &&
        state.progressTab === prev.progressTab &&
        state.searchQuery === prev.searchQuery
      ) {
        return
      }
      if (syncingFromUrl) return
      const hash = routeToHash({
        view: state.view,
        deckId: state.deckId,
        libraryTab: state.libraryTab,
        progressTab: state.progressTab,
        searchQuery: state.searchQuery,
      })
      if (window.location.hash !== hash) {
        // Query-only keystrokes replace history so typing doesn't spam
        // the back button with one entry per character.
        const routeOnly =
          state.view === prev.view &&
          state.deckId === prev.deckId &&
          state.libraryTab === prev.libraryTab &&
          state.progressTab === prev.progressTab
        if (routeOnly) {
          window.history.replaceState(null, '', hash)
        } else {
          window.location.hash = hash
        }
      }
    })

    const onUrlChange = () => apply(window.location.hash)
    window.addEventListener('popstate', onUrlChange)
    window.addEventListener('hashchange', onUrlChange)
    return () => {
      unsubscribe()
      window.removeEventListener('popstate', onUrlChange)
      window.removeEventListener('hashchange', onUrlChange)
    }
  }, [])
}
