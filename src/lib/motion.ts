'use client'

/**
 * One source of truth for motion across LexiLearn.
 *
 * Rule of the house: every interaction must visibly respond within 100ms,
 * so all press/animation feedback is CSS- or transform-only and never waits
 * on the network. Anything decorative is gated behind `prefers-reduced-motion`.
 */

import { useMemo } from 'react'
import { useReducedMotion, type Transition, type Variants } from 'framer-motion'

export const duration = {
  /** 90ms - press feedback. Must always feel instant. */
  instant: 0.09,
  fast: 0.14,
  base: 0.2,
  slow: 0.32,
  celebrate: 0.6,
} as const

/** ease-out-quint: fast start, soft landing. */
export const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const easeInOut: [number, number, number, number] = [0.65, 0, 0.35, 1]

export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const
export const springSoft = { type: 'spring', stiffness: 220, damping: 26 } as const
export const springBouncy = { type: 'spring', stiffness: 300, damping: 15 } as const

export const transition = {
  instant: { duration: duration.instant, ease: easeOut } as Transition,
  fast: { duration: duration.fast, ease: easeOut } as Transition,
  base: { duration: duration.base, ease: easeOut } as Transition,
  slow: { duration: duration.slow, ease: easeOut } as Transition,
  spring: spring as Transition,
  springSoft: springSoft as Transition,
}

/** Press feedback used by every tappable surface. */
export const press = { scale: 0.97, transition: { duration: duration.instant } }

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.fast },
  exit: { opacity: 0, transition: transition.instant },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: transition.base },
  exit: { opacity: 0, y: -6, transition: transition.fast },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1, transition: transition.fast },
  exit: { opacity: 0, scale: 0.98, transition: transition.instant },
}

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.86 },
  show: { opacity: 1, scale: 1, transition: springBouncy as Transition },
  exit: { opacity: 0, scale: 0.9, transition: transition.instant },
}

/** Children cascade in instead of mounting all at once. */
export function stagger(staggerChildren = 0.04, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  }
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: transition.base },
}

/** Reveal of an answer block: height + fade, never a layout jump. */
export const revealBlock: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: transition.base },
  exit: { opacity: 0, height: 0, transition: transition.fast },
}

/**
 * Cards leave with a weight that matches the grade, so the SRS choice
 * is physically communicated: a miss snaps away, an easy win flies out.
 */
export function gradeExit(grade: number): { exit: { opacity: number; x?: number; y?: number; transition: Transition } } {
  if (grade >= 5) return { exit: { opacity: 0, x: -64, transition: { duration: 0.24, ease: easeOut } } }
  if (grade >= 4) return { exit: { opacity: 0, x: -48, transition: { duration: 0.2, ease: easeOut } } }
  if (grade >= 3) return { exit: { opacity: 0, x: -32, transition: { duration: 0.22, ease: easeOut } } }
  return { exit: { opacity: 0, y: 14, transition: { duration: 0.16, ease: easeInOut } } }
}

export function gradeEnter(grade: number): { initial: { opacity: number; x?: number; y?: number }; animate: { opacity: number; x?: number; y?: number } } {
  return {
    initial: { opacity: 0, x: 32, y: 6 },
    animate: { opacity: 1, x: 0, y: 0 },
  }
}

/**
 * Reduced-motion guard. Use this instead of raw framer components so the
 * whole app honours the OS setting from one place.
 */
export function useMotionSafe() {
  const reduce = useReducedMotion()
  return useMemo(() => {
    const isReduced = !!reduce
    return {
      reduce: isReduced,
      t: (value: Transition = transition.base): Transition => (isReduced ? { duration: 0 } : value),
      v: (variants: Variants): Variants =>
        isReduced ? { hidden: { opacity: 1 }, show: { opacity: 1 }, exit: { opacity: 1 } } : variants,
    }
  }, [reduce])
}