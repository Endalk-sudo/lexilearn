import { describe, it, expect } from 'vitest'
import { clampLimit, decodeCursor, encodeCursor } from '../paging'

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a cursor', () => {
    const c = { createdAt: 1700000000000, id: 'w_abc123' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  it('keeps colons inside the id intact', () => {
    const c = { createdAt: 1, id: 'weird:id:with:colons' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  it('handles createdAt 0', () => {
    expect(decodeCursor(encodeCursor({ createdAt: 0, id: 'a' }))).toEqual({ createdAt: 0, id: 'a' })
  })

  it('returns null for missing or malformed input', () => {
    for (const bad of [null, undefined, '', 'garbage', ':abc', '123:', '1.5:abc', '-1:abc', 'NaN:abc', 'abc:123']) {
      expect(decodeCursor(bad as string | null | undefined)).toBeNull()
    }
  })
})

describe('clampLimit', () => {
  it('falls back when absent or unparseable', () => {
    expect(clampLimit(null, 30, 100)).toBe(30)
    expect(clampLimit(undefined, 30, 100)).toBe(30)
    expect(clampLimit('', 30, 100)).toBe(30)
    expect(clampLimit('abc', 30, 100)).toBe(30)
    expect(clampLimit('0', 30, 100)).toBe(30)
    expect(clampLimit('-5', 30, 100)).toBe(30)
    expect(clampLimit('2.5', 30, 100)).toBe(30)
  })

  it('clamps to the maximum', () => {
    expect(clampLimit('5000', 30, 100)).toBe(100)
    expect(clampLimit('100', 30, 100)).toBe(100)
    expect(clampLimit('50', 30, 100)).toBe(50)
  })
})