'use client'

/**
 * "Resume where you left off" - stores the position inside a session, not just
 * that a session exists, so coming back drops the learner on the exact card.
 */
export type ResumeState = {
  view: 'learn' | 'review' | 'quiz'
  label: string
  detail: string
  deckId?: string | null
  index?: number
  total?: number
  at: number
}

const KEY = 'lexilearn-resume-v1'
const MAX_AGE = 1000 * 60 * 60 * 24 * 3

export function saveResume(r: Omit<ResumeState, 'at'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...r, at: Date.now() }))
  } catch {
    /* storage unavailable */
  }
}

export function getResume(): ResumeState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as ResumeState
    if (!value || typeof value.at !== 'number') return null
    if (Date.now() - value.at > MAX_AGE) return null
    return value
  } catch {
    return null
  }
}

export function clearResume() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

/** Index to restore for a given session type, clamped to a sane range. */
export function resumeIndexFor(view: ResumeState['view'], total: number): number {
  const resume = getResume()
  if (!resume || resume.view !== view || typeof resume.index !== 'number') return 0
  if (total <= 1) return 0
  return Math.max(0, Math.min(resume.index, total - 1))
}
