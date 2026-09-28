import { describe, it, expect } from 'vitest'
import { parseHash, routeToHash } from '@/lib/router'

describe('library hash routing', () => {
  it('round-trips the dictionary tab with a search query', () => {
    const route = parseHash('#/library?tab=dictionary&q=serendipity')
    expect(route.view).toBe('library')
    expect(route.libraryTab).toBe('dictionary')
    expect(route.searchQuery).toBe('serendipity')
    expect(routeToHash(route)).toBe('#/library?tab=dictionary&q=serendipity')
  })

  it('omits empty query params', () => {
    expect(routeToHash({ view: 'library', deckId: null, libraryTab: 'decks', progressTab: 'overview', searchQuery: '' })).toBe('#/library')
    expect(routeToHash({ view: 'library', deckId: null, libraryTab: 'dictionary', progressTab: 'overview', searchQuery: '' })).toBe('#/library?tab=dictionary')
  })

  it('keeps deck deep links working and drops the query there', () => {
    const route = parseHash('#/library/abc123')
    expect(route.view).toBe('library-deck')
    expect(route.deckId).toBe('abc123')
    expect(route.searchQuery).toBe('')
    expect(routeToHash(route)).toBe('#/library/abc123')
  })

  it('defaults unknown hashes to today', () => {
    expect(parseHash('').view).toBe('today')
    expect(parseHash('#/nope').view).toBe('today')
  })
})
