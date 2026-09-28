import { describe, it, expect, beforeEach } from 'vitest'
import { isRateLimited, getRateLimitRemaining } from '@/server/rate-limit'

describe('rate limiter', () => {
  beforeEach(() => {
    // Reset the rate limiter state between tests
    // The module uses a Map that persists, so we need to clear it
    // by importing fresh or using a reset function
  })

  it('allows requests under the limit', () => {
    const key = 'test-client-1'
    expect(isRateLimited(key)).toBe(false)
    expect(isRateLimited(key)).toBe(false)
  })

  it('blocks requests over the limit', () => {
    const key = 'test-client-2'
    // Make 100 requests (the limit)
    for (let i = 0; i < 100; i++) {
      isRateLimited(key)
    }
    // 101st request should be blocked
    expect(isRateLimited(key)).toBe(true)
  })

  it('tracks remaining requests', () => {
    const key = 'test-client-3'
    const remaining = getRateLimitRemaining(key)
    expect(remaining).toBeLessThanOrEqual(100)
  })
})
