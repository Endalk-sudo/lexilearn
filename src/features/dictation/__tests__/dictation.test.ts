import { describe, it, expect } from 'vitest'
import {
  compareWordLetters,
  stripWordNoise,
  wordStateOf,
} from '../lib/dictation'
import { slotFitClass } from '@/features/study/ui/study-scale'

describe('stripWordNoise', () => {
  it('keeps the letters a word is actually judged on', () => {
    expect(stripWordNoise('Hello')).toBe('hello')
    expect(stripWordNoise("don't")).toBe('dont')
    expect(stripWordNoise('well-known')).toBe('wellknown')
    expect(stripWordNoise('  spaced   out ')).toBe('spacedout')
  })

  it('strips punctuation the grader ignores', () => {
    expect(stripWordNoise('“Quoted,”')).toBe('quoted')
    expect(stripWordNoise('a,b;c')).toBe('abc')
  })
})

describe('compareWordLetters', () => {
  it('marks every letter correct for an exact match', () => {
    expect(compareWordLetters('cat', 'cat')).toEqual([
      { char: 'c', state: 'ok' },
      { char: 'a', state: 'ok' },
      { char: 't', state: 'ok' },
    ])
  })

  it('marks only the substituted letter wrong', () => {
    const cells = compareWordLetters('cat', 'cqt')
    expect(cells.map((c) => c.state)).toEqual(['ok', 'wrong', 'ok'])
  })

  it('flags letters past the end of the word as extra', () => {
    const cells = compareWordLetters('cat', 'cats')
    expect(cells.map((c) => c.state)).toEqual(['ok', 'ok', 'ok', 'extra'])
  })

  it('stops at the first untyped letter so empty slots are not painted', () => {
    expect(compareWordLetters('cat', 'c')).toEqual([{ char: 'c', state: 'ok' }])
    expect(compareWordLetters('cat', '')).toEqual([])
  })

  it('agrees with the grader about case and apostrophes', () => {
    // These normalise to identical tokens, so none of them may read as errors.
    expect(compareWordLetters("don't", 'dont').every((c) => c.state === 'ok')).toBe(true)
    expect(compareWordLetters('Well', 'well').every((c) => c.state === 'ok')).toBe(true)
  })
})

describe('wordStateOf', () => {
  it('reports empty for a blank slot', () => {
    expect(wordStateOf('quick', '')).toBe('empty')
    expect(wordStateOf('quick', '   ')).toBe('empty')
  })

  it('reports ok only for a complete, correct word', () => {
    expect(wordStateOf('quick', 'quick')).toBe('ok')
    expect(wordStateOf("don't", 'dont')).toBe('ok')
    expect(wordStateOf('quick', 'Quick')).toBe('ok')
  })

  it('reports partial for correct-but-unfinished typing', () => {
    expect(wordStateOf('quick', 'qui')).toBe('partial')
    expect(wordStateOf('quick', 'q')).toBe('partial')
  })

  it('reports wrong as soon as one letter is off', () => {
    expect(wordStateOf('quick', 'quicj')).toBe('wrong')
    expect(wordStateOf('quick', 'qxick')).toBe('wrong')
    expect(wordStateOf('quick', 'quicks')).toBe('wrong')
  })
})

describe('slotFitClass', () => {
  it('sizes by the longest word for short sentences', () => {
    expect(slotFitClass(4, 3)).toBe('spell-fit-0')
    expect(slotFitClass(6, 2)).toBe('spell-fit-0')
  })

  it('steps down for long words regardless of count', () => {
    expect(slotFitClass(14, 2)).toBe('spell-fit-2')
  })

  it('steps down one extra tier for long sentences so the row stays compact', () => {
    expect(slotFitClass(6, 12)).toBe('spell-fit-1')
    expect(slotFitClass(6, 11)).toBe('spell-fit-0')
  })

  it('never exceeds the smallest tier', () => {
    expect(slotFitClass(30, 20)).toBe('spell-fit-3')
    expect(slotFitClass(14, 20)).toBe('spell-fit-3')
  })
})