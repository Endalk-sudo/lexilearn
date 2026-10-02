'use client'

type ConfettiFn = (opts?: Record<string, unknown>) => void

let confettiPromise: Promise<ConfettiFn> | null = null

/**
 * canvas-confetti is fetched on first celebration, not on first paint — it
 * ships non-trivial code plus a fullscreen canvas for something most sessions
 * never trigger.
 */
function loadConfetti(): Promise<ConfettiFn> {
  if (!confettiPromise) {
    confettiPromise = import('canvas-confetti').then((m) => m.default as ConfettiFn)
  }
  return confettiPromise
}

export function celebrate(kind: 'xp' | 'levelup' | 'challenge' | 'streak' = 'xp') {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const base = { disableForReducedMotion: true }
  void loadConfetti().then((confetti) => {
  if (kind === 'levelup' || kind === 'challenge') {
    confetti({ ...base, particleCount: 130, spread: 75, origin: { y: 0.35 } })
    window.setTimeout(() => confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0 } }), 200)
    window.setTimeout(() => confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1 } }), 320)
  } else if (kind === 'streak') {
    confetti({ ...base, particleCount: 70, spread: 60, origin: { y: 0.3 }, colors: ['#fb923c', '#fbbf24', '#fde68a', '#fff7ed'] })
  } else {
    confetti({ ...base, particleCount: 36, spread: 55, startVelocity: 28, origin: { y: 0.4 } })
  }
  }).catch(() => {
    /* celebration is decorative — never fail a session over it */
  })
}
