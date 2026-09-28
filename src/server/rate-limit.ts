// Simple in-memory rate limiter for the API.
// LexiLearn is local-only, so a per-IP sliding window is sufficient.
// For production multi-instance deployments, replace with Redis.

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 100 // per window

/** Clean up expired buckets to prevent memory leaks. */
function cleanup() {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}

export function isRateLimited(key: string): boolean {
  const now = Date.now()
  cleanup()

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  bucket.count++
  return bucket.count > MAX_REQUESTS
}

export function getRateLimitRemaining(key: string): number {
  const bucket = buckets.get(key)
  if (!bucket) return MAX_REQUESTS
  return Math.max(0, MAX_REQUESTS - bucket.count)
}
