import { describe, it, expect } from 'vitest'
import { posKey } from '@/features/library/lib/pos'

describe('posKey', () => {
  it('normalizes full names and abbreviations', () => {
    expect(posKey('noun')).toBe('noun')
    expect(posKey('Noun')).toBe('noun')
    expect(posKey('n.')).toBe('noun')
    expect(posKey('verb')).toBe('verb')
    expect(posKey('v.')).toBe('verb')
    expect(posKey('adjective')).toBe('adj')
    expect(posKey('adj.')).toBe('adj')
    expect(posKey('adverb')).toBe('adv')
    expect(posKey('adv.')).toBe('adv')
  })

  it('returns null for missing or unknown values', () => {
    expect(posKey(null)).toBeNull()
    expect(posKey('')).toBeNull()
    expect(posKey('interjection')).toBeNull()
  })
})
