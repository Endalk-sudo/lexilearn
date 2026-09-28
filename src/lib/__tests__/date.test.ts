import { describe, it, expect } from 'vitest'
import { dayKey, startOfDay, addDays } from '@/lib/date'

describe('dayKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(dayKey(new Date('2024-01-15T10:30:00'))).toBe('2024-01-15')
  })

  it('handles midnight correctly', () => {
    expect(dayKey(new Date('2024-01-15T00:00:00'))).toBe('2024-01-15')
  })

  it('handles end of day correctly', () => {
    expect(dayKey(new Date('2024-01-15T23:59:59'))).toBe('2024-01-15')
  })
})

describe('startOfDay', () => {
  it('returns midnight of the same day', () => {
    const result = startOfDay(new Date('2024-01-15T10:30:00'))
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})

describe('addDays', () => {
  it('adds days correctly', () => {
    const result = addDays(new Date('2024-01-15'), 5)
    expect(dayKey(result)).toBe('2024-01-20')
  })

  it('subtracts days with negative value', () => {
    const result = addDays(new Date('2024-01-15'), -5)
    expect(dayKey(result)).toBe('2024-01-10')
  })

  it('handles month boundaries', () => {
    const result = addDays(new Date('2024-01-31'), 1)
    expect(dayKey(result)).toBe('2024-02-01')
  })

  it('handles year boundaries', () => {
    const result = addDays(new Date('2024-12-31'), 1)
    expect(dayKey(result)).toBe('2025-01-01')
  })
})
