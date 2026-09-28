import { describe, it, expect } from 'vitest'
import { calculateSm2, getLevel, GRADE_XP, type SrsCard } from '@/lib/srs'

describe('calculateSm2', () => {
  const baseCard: SrsCard = {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    lastReviewed: null,
    totalReviews: 0,
    correctReviews: 0,
    status: 'new',
    nextReview: new Date(),
  }

  it('resets repetitions and sets interval to 1 when quality < 3', () => {
    const result = calculateSm2(baseCard, 0)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
    expect(result.status).toBe('learning')
  })

  it('sets interval to 1 on first success', () => {
    const result = calculateSm2(baseCard, 4)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
    expect(result.status).toBe('learning')
  })

  it('sets interval to 6 on second success', () => {
    const card = { ...baseCard, repetitions: 1, interval: 1 }
    const result = calculateSm2(card, 4)
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
    expect(result.status).toBe('reviewing')
  })

  it('multiplies interval by ease factor on third+ success', () => {
    const card = { ...baseCard, repetitions: 2, interval: 6, easeFactor: 2.5 }
    const result = calculateSm2(card, 4)
    expect(result.interval).toBe(15) // 6 * 2.5 = 15
    expect(result.repetitions).toBe(3)
  })

  it('marks as mastered when repetitions >= 5 and interval >= 21', () => {
    const card = { ...baseCard, repetitions: 4, interval: 21, easeFactor: 2.5 }
    const result = calculateSm2(card, 5)
    expect(result.status).toBe('mastered')
  })

  it('never lets ease factor drop below 1.3', () => {
    const card = { ...baseCard, easeFactor: 1.3 }
    const result = calculateSm2(card, 0)
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it('increments totalReviews and correctReviews', () => {
    const result = calculateSm2(baseCard, 4)
    expect(result.totalReviews).toBe(1)
    expect(result.correctReviews).toBe(1)
  })

  it('increments totalReviews but not correctReviews on failure', () => {
    const result = calculateSm2(baseCard, 0)
    expect(result.totalReviews).toBe(1)
    expect(result.correctReviews).toBe(0)
  })

  it('updates lastReviewed to now', () => {
    const before = new Date()
    const result = calculateSm2(baseCard, 4)
    expect(result.lastReviewed.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})

describe('getLevel', () => {
  it('returns Beginner for 0 XP', () => {
    const { level } = getLevel(0)
    expect(level.name).toBe('Beginner')
  })

  it('returns Novice for 100 XP', () => {
    const { level } = getLevel(100)
    expect(level.name).toBe('Novice')
  })

  it('returns Master for 3000+ XP', () => {
    const { level } = getLevel(3000)
    expect(level.name).toBe('Master')
  })

  it('returns null nextLevel at max level', () => {
    const { nextLevel } = getLevel(5000)
    expect(nextLevel).toBeNull()
  })

  it('calculates progress percentage', () => {
    const { pct } = getLevel(200) // 100 XP into Novice (100-300)
    expect(pct).toBe(50)
  })
})

describe('GRADE_XP', () => {
  it('has correct XP values', () => {
    expect(GRADE_XP[0]).toBe(1)
    expect(GRADE_XP[3]).toBe(3)
    expect(GRADE_XP[4]).toBe(5)
    expect(GRADE_XP[5]).toBe(8)
  })
})
