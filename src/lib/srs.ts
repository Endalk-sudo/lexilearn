// SM-2 Spaced Repetition Algorithm
// Adapted from SuperMemo 2 — ported to TypeScript for LexiLearn

export type SrsCard = {
  easeFactor: number
  interval: number
  repetitions: number
  lastReviewed: Date | null
  totalReviews: number
  correctReviews: number
  status: string // new | learning | reviewing | mastered
  nextReview: Date
}

export type Grade = 0 | 3 | 4 | 5 // 0=Again, 3=Hard, 4=Good, 5=Easy

export const GRADE_LABELS: Record<Grade, string> = {
  0: 'Again',
  3: 'Hard',
  4: 'Good',
  5: 'Easy',
}

export const GRADE_XP: Record<Grade, number> = {
  0: 1,  // Again — small XP for trying
  3: 3,  // Hard
  4: 5,  // Good
  5: 8,  // Easy
}

export function calculateSm2(card: SrsCard, quality: Grade): SrsCard {
  const updatedCard: SrsCard = { ...card, lastReviewed: new Date() }

  if (quality < 3) {
    // Forgot the word — reset
    updatedCard.repetitions = 0
    updatedCard.interval = 1
    updatedCard.status = 'learning'
  } else {
    // Remembered — advance
    if (updatedCard.repetitions === 0) {
      updatedCard.interval = 1
    } else if (updatedCard.repetitions === 1) {
      updatedCard.interval = 6
    } else {
      updatedCard.interval = Math.max(1, Math.round(updatedCard.interval * updatedCard.easeFactor))
    }
    updatedCard.repetitions += 1

    if (updatedCard.repetitions >= 5 && updatedCard.interval >= 21) {
      updatedCard.status = 'mastered'
    } else if (updatedCard.repetitions >= 1) {
      updatedCard.status = 'reviewing'
    }
  }

  // Update Ease Factor (SM-2 formula)
  const q = quality
  const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  updatedCard.easeFactor = Math.max(1.3, updatedCard.easeFactor + efDelta)

  // Update Stats
  updatedCard.totalReviews += 1
  if (quality >= 3) {
    updatedCard.correctReviews += 1
  }

  // Schedule next review
  const next = new Date()
  next.setDate(next.getDate() + updatedCard.interval)
  updatedCard.nextReview = next

  return updatedCard
}

// Helper: counts how many days a streak has been alive
export function computeStreak(lastSession: string, currentStreak: number): number {
  if (!lastSession) return 0
  const last = new Date(lastSession)
  const today = new Date()
  // Normalize to midnight
  last.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86_400_000)
  if (diffDays === 0) return currentStreak
  if (diffDays === 1) return currentStreak // streak continues when today's session happens
  return 0 // streak broken
}

// Levels & XP curve (used by gamification)
export const LEVELS = [
  { name: 'Beginner', minXp: 0 },
  { name: 'Novice', minXp: 100 },
  { name: 'Intermediate', minXp: 300 },
  { name: 'Advanced', minXp: 700 },
  { name: 'Expert', minXp: 1500 },
  { name: 'Master', minXp: 3000 },
] as const

export function getLevel(xp: number) {
  let level: typeof LEVELS[number] = LEVELS[0]
  let nextLevel: typeof LEVELS[number] | null = null
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) {
      level = LEVELS[i]
      nextLevel = LEVELS[i + 1] ?? null
    }
  }
  const progressIntoLevel = xp - level.minXp
  const span = nextLevel ? nextLevel.minXp - level.minXp : 0
  const pct = nextLevel ? Math.min(100, Math.round((progressIntoLevel / span) * 100)) : 100
  return { level, nextLevel, progressIntoLevel, span, pct, xp }
}
