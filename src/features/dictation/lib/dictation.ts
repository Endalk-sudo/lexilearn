/**
 * Dictation engine — pure functions, no browser APIs.
 *
 * Normalisation, word-level diff, accuracy → SRS grade mapping, the length
 * ladder and rung persistence all live here so they are trivially testable
 * in plain node.
 */

import type { WordDTO } from '@/lib/api'
import { GRADE_XP } from '@/lib/srs'

export type DictationKind = 'word' | 'phrase' | 'sentence'
export type DictationGrade = 0 | 3 | 4 | 5

export interface DictationItem {
  kind: DictationKind
  /** The exact text that is dictated and checked against. */
  text: string
  wordId: string
  word: string
  ipa: string | null
  /** Shown after checking — the word's first definition. */
  meaning: string
}

/**
 * Make comparison about the language, not the typing: case, punctuation
 * (typing commas is not the skill), apostrophes and extra spaces are
 * ignored. Both sides are normalised identically, so matching stays
 * consistent.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’‚`´]/g, "'")
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(input: string): string[] {
  const normalised = normalizeText(input)
  return normalised ? normalised.split(' ') : []
}

export type DiffStatus = 'ok' | 'missing' | 'extra'

export interface DiffToken {
  text: string
  status: DiffStatus
}

/** Align typed words against target words with a longest-common-subsequence pass. */
export function diffWords(target: string, typed: string): DiffToken[] {
  const t = tokenize(target)
  const y = tokenize(typed)
  const m = t.length
  const n = y.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = t[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (t[i] === y[j]) {
      out.push({ text: t[i], status: 'ok' })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ text: t[i], status: 'missing' })
      i++
    } else {
      out.push({ text: y[j], status: 'extra' })
      j++
    }
  }
  while (i < m) {
    out.push({ text: t[i], status: 'missing' })
    i++
  }
  while (j < n) {
    out.push({ text: y[j], status: 'extra' })
    j++
  }
  return out
}

export type DiffSegment =
  | { kind: 'ok'; expected: string; typed: string | null }
  | { kind: 'skip'; expected: string; typed: string | null }
  | { kind: 'wrong'; expected: string; typed: string | null }

/**
 * Fold the raw token stream for display: adjacent missing+extra runs pair up
 * as substitutions ("you wrote X, it was Y"), leftovers become skips.
 */
export function groupDiff(tokens: DiffToken[]): DiffSegment[] {
  const segments: DiffSegment[] = []
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (token.status === 'ok') {
      segments.push({ kind: 'ok', expected: token.text, typed: token.text })
      i++
      continue
    }
    const missing: string[] = []
    while (i < tokens.length && tokens[i].status === 'missing') {
      missing.push(tokens[i].text)
      i++
    }
    const extra: string[] = []
    while (i < tokens.length && tokens[i].status === 'extra') {
      extra.push(tokens[i].text)
      i++
    }
    const pairs = Math.min(missing.length, extra.length)
    for (let k = 0; k < pairs; k++) {
      segments.push({ kind: 'wrong', expected: missing[k], typed: extra[k] })
    }
    for (let k = pairs; k < missing.length; k++) {
      segments.push({ kind: 'skip', expected: missing[k], typed: null })
    }
    for (let k = pairs; k < extra.length; k++) {
      segments.push({ kind: 'wrong', expected: '', typed: extra[k] })
    }
  }
  return segments
}

/** 0–100. Skipped words cost a full mark, stray words cost half. */
export function accuracyOf(tokens: DiffToken[], targetWordCount: number): number {
  if (targetWordCount <= 0) return tokens.length === 0 ? 100 : 0
  const ok = tokens.filter((tok) => tok.status === 'ok').length
  const extra = tokens.filter((tok) => tok.status === 'extra').length
  const score = ((ok - extra * 0.5) / targetWordCount) * 100
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function gradeFor(accuracy: number, attempts: number, revealed: boolean): DictationGrade {
  if (revealed) return 0
  if (accuracy === 100) return attempts === 0 ? 5 : 4
  if (accuracy >= 85) return 4
  if (accuracy >= 60) return 3
  return 0
}

/**
 * XP per dictation grade — re-exports the canonical GRADE_XP table so the
 * numbers shown here always match what the server credits (W1).
 */
export const DICTATION_XP: Record<DictationGrade, number> = GRADE_XP

export type Rung = 0 | 1 | 2

export const RUNG_LABELS = ['Foundation', 'Building', 'Fluent'] as const

/** Every template is 8 items; higher rungs shift weight toward sentences. */
export const RUNG_TEMPLATES: Record<Rung, { words: number; phrases: number; sentences: number }> = {
  0: { words: 5, phrases: 2, sentences: 1 },
  1: { words: 3, phrases: 3, sentences: 2 },
  2: { words: 2, phrases: 2, sentences: 4 },
}

const RUNG_KEY = 'lexilearn-dictation-rung'

export function loadRung(): Rung {
  try {
    if (typeof window === 'undefined') return 0
    const raw = window.localStorage.getItem(RUNG_KEY)
    const value = raw === null ? 0 : Number.parseInt(raw, 10)
    if (value === 1 || value === 2) return value
    return 0
  } catch {
    return 0
  }
}

export function saveRung(rung: Rung): void {
  try {
    window.localStorage.setItem(RUNG_KEY, String(rung))
  } catch {
    /* storage unavailable — the ladder just restarts at Foundation */
  }
}

/** Hold the rung on a middling session, climb on a strong one, drop on a weak one. */
export function nextRung(current: Rung, avgAccuracy: number): Rung {
  if (avgAccuracy >= 80) return Math.min(2, current + 1) as Rung
  if (avgAccuracy >= 55) return current
  return Math.max(0, current - 1) as Rung
}

/** Prefer a short, natural example; refuse anything unwieldy to dictate. */
export function pickSentence(examples: string[]): string | null {
  const cleaned = examples.map((e) => e.trim()).filter(Boolean)
  if (cleaned.length === 0) return null
  const short = cleaned
    .map((text) => ({ text, words: tokenize(text).length }))
    .filter((e) => e.words > 0 && e.words <= 20)
    .sort((a, b) => a.words - b.words)
  if (short.length > 0) return short[0].text
  const medium = cleaned.find((text) => tokenize(text).length <= 30)
  return medium ?? null
}

/** A definition is already phrase-length; prefer the shorter ones. */
export function pickPhrase(definitions: { pos: string; text: string }[]): string | null {
  const cleaned = definitions.map((d) => d.text.trim()).filter(Boolean)
  if (cleaned.length === 0) return null
  const short = cleaned.find((text) => {
    const words = tokenize(text).length
    return words >= 2 && words <= 20
  })
  if (short) return short
  const medium = cleaned.find((text) => tokenize(text).length <= 40)
  return medium ?? null
}

export function buildItems(
  words: WordDTO[],
  rung: Rung
): { items: DictationItem[]; requestedTotal: number } {
  const template = RUNG_TEMPLATES[rung]
  const requestedTotal = template.words + template.phrases + template.sentences
  const remaining = [...words]
  const items: DictationItem[] = []

  const firstMeaning = (word: WordDTO) => word.definitions[0]?.text.trim() || word.word

  const pull = (count: number, textFor: (word: WordDTO) => string | null, kind: DictationKind): void => {
    for (let k = 0; k < count; k++) {
      const index = remaining.findIndex((word) => textFor(word) !== null)
      if (index === -1) return
      const [word] = remaining.splice(index, 1)
      const text = textFor(word) as string
      items.push({
        kind,
        text,
        wordId: word.id,
        word: word.word,
        ipa: word.ipa ?? null,
        meaning: firstMeaning(word),
      })
    }
  }

  const wordText = (word: WordDTO) => (word.word?.trim() ? word.word.trim() : null)

  pull(template.words, wordText, 'word')
  pull(template.phrases, (word) => pickPhrase(word.definitions), 'phrase')
  pull(template.sentences, (word) => pickSentence(word.examples), 'sentence')

  // Top up shortfalls with plain words so the ladder never dead-ends on a
  // thin deck — a word drill is always better than an empty session slot.
  while (items.length < requestedTotal) {
    const index = remaining.findIndex((word) => wordText(word) !== null)
    if (index === -1) break
    const [word] = remaining.splice(index, 1)
    items.push({
      kind: 'word',
      text: word.word.trim(),
      wordId: word.id,
      word: word.word,
      ipa: word.ipa ?? null,
      meaning: firstMeaning(word),
    })
  }

  return { items, requestedTotal }
}

/** Minimum viable session — below this we ask for more words instead of drilling thin air. */
export const MIN_SESSION_ITEMS = 5
