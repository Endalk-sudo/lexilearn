import { describe, it, expect } from 'vitest'
import { spellFitClass, splitTargetWords } from '../ui/study-scale'

describe('splitTargetWords', () => {
  it('splits on spaces into per-word letter arrays', () => {
    expect(splitTargetWords('two words')).toEqual([['t', 'w', 'o'], ['w', 'o', 'r', 'd', 's']])
  })

  it('returns a single group for one word', () => {
    expect(splitTargetWords('abduct')).toEqual([['a', 'b', 'd', 'u', 'c', 't']])
  })

  it('collapses extra whitespace and drops empties', () => {
    expect(splitTargetWords('  a   b  ')).toEqual([['a'], ['b']])
  })

  it('handles empty input', () => {
    expect(splitTargetWords('')).toEqual([])
    expect(splitTargetWords('   ')).toEqual([])
  })
})

describe('spellFitClass', () => {
  it('uses the roomiest tier for short words', () => {
    expect(spellFitClass(6)).toBe('spell-fit-0')
    expect(spellFitClass(8)).toBe('spell-fit-0')
  })

  it('steps down as words get longer', () => {
    expect(spellFitClass(10)).toBe('spell-fit-1')
    expect(spellFitClass(14)).toBe('spell-fit-2')
    expect(spellFitClass(20)).toBe('spell-fit-3')
    expect(spellFitClass(34)).toBe('spell-fit-3')
  })

  it('is deterministic across boundaries', () => {
    expect(spellFitClass(9)).toBe('spell-fit-1')
    expect(spellFitClass(12)).toBe('spell-fit-1')
    expect(spellFitClass(13)).toBe('spell-fit-2')
    expect(spellFitClass(16)).toBe('spell-fit-2')
    expect(spellFitClass(17)).toBe('spell-fit-3')
  })
})
