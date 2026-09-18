'use client'

import confetti from 'canvas-confetti'

export function celebrate(kind: 'xp' | 'levelup' | 'challenge' | 'streak' = 'xp') {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const base = { disableForReducedMotion: true }
  if (kind === 'levelup' || kind === 'challenge') {
    confetti({ ...base, particleCount: 130, spread: 75, origin: { y: 0.35 } })
    window.setTimeout(() => confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0 } }), 200)
    window.setTimeout(() => confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1 } }), 320)
  } else if (kind === 'streak') {
    confetti({ ...base, particleCount: 70, spread: 60, origin: { y: 0.3 }, colors: ['#fb923c', '#fbbf24', '#fde68a', '#fff7ed'] })
  } else {
    confetti({ ...base, particleCount: 36, spread: 55, startVelocity: 28, origin: { y: 0.4 } })
  }
}
