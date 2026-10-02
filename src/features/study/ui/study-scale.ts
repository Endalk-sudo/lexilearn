'use client'

/**
 * Shared study-page UI helpers for Learn / Review / Quiz / Dictation.
 *
 * - `useStudyPrefs()` reads the global text-scale + focus-mode preferences
 *   (synced to `document.documentElement.dataset` by the store, so plain CSS
 *   in globals.css does the heavy lifting).
 * - `useFirstCardHints()` shows inline keyboard hints on the first card of a
 *   session only. The flag lives in sessionStorage so it resets naturally
 *   when the tab closes — first card teaches, the rest get out of the way.
 * - `spellFitClass()` picks the box-size tier for typing rows from the
 *   target's letter count, so a 4-letter and a 16-letter word both fit one
 *   centered line instead of wrapping mid-word or overflowing.
 */

import { useCallback, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export type { StudyTextScale } from '@/lib/api'

export function useStudyPrefs() {
  const studyText = useAppStore((s) => s.studyText)
  const focusMode = useAppStore((s) => s.focusMode)
  const setFocusMode = useAppStore((s) => s.setFocusMode)
  return { studyText, focusMode, setFocusMode }
}

const HINTS_KEY = 'lexilearn-hints-shown'

/** True until the first "got it" of this tab session. Persists across cards. */
export function useFirstCardHints(): [boolean, () => void] {
  const [show, setShow] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(HINTS_KEY) !== '1'
    } catch {
      return true
    }
  })
  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(HINTS_KEY, '1')
    } catch {}
    setShow(false)
  }, [])
  return [show, dismiss]
}

/**
 * Box-size tier for a spelling/typing row. Thresholds count non-space
 * letters: ≤8 fits the roomy tier, then three steps down. The CSS classes
 * live in globals.css (`.spell-fit-N`) so both input components share them.
 */
export function spellFitClass(letterCount: number): string {
  if (letterCount <= 8) return 'spell-fit-0'
  if (letterCount <= 12) return 'spell-fit-1'
  if (letterCount <= 16) return 'spell-fit-2'
  return 'spell-fit-3'
}

/**
 * Fit tier for the dictation word-slot row. Box size still follows the longest
 * word so every slot stays readable, but a long sentence steps down one extra
 * tier. The slot row wraps (see `.spell-row-wrap`), so compactness beats
 * generosity here: a 20-word sentence should look like a paragraph, not
 * swallow the whole card.
 */
export function slotFitClass(longestWord: number, wordCount: number): string {
  const step = Number.parseInt(spellFitClass(longestWord).replace('spell-fit-', ''), 10)
  const bump = wordCount >= 12 ? 1 : 0
  return `spell-fit-${Math.min(3, step + bump)}`
}

/** Split a target into word groups: letters stay together, spaces separate. */
export function splitTargetWords(target: string): string[][] {
  return target
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w.split(''))
}

/** `study-col study-head` etc. — one place for the class composition. */
export function studyColClassName(extra?: string): string {
  return cn('mx-auto study-col', extra)
}
