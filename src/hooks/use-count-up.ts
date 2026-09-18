'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animate a number from its previous value to the new one.
 * Used for streaks, XP and scores so stat changes feel alive -
 * and it is skipped entirely under prefers-reduced-motion.
 */
export function useCountUp(value: number, durationMs = 550) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (reduced || fromRef.current === value) {
      fromRef.current = value
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const start = performance.now()

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [value, durationMs])

  return display
}