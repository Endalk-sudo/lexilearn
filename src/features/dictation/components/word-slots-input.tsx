'use client'

import { cn } from '@/lib/utils'
import { typeFeelFromKey } from '@/lib/feel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  compareWordLetters,
  tokenize,
  wordStateOf,
  type WordState,
} from '@/features/dictation/lib/dictation'
import { slotFitClass } from '@/features/study/ui/study-scale'

export type WordSlotsInputProps = {
  target: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  autoFocus?: boolean
  onSubmit?: () => void
  guided?: boolean
  masked?: boolean
  className?: string
}

const CARET = 'animate-caret-blink'

export function WordSlotsInput({
  target,
  value,
  onChange,
  disabled,
  autoFocus,
  onSubmit,
  guided = false,
  masked = false,
  className,
}: WordSlotsInputProps) {
  // Memoised because `tokenize` returns a fresh array every call, which would
  // give the `typedWords` memo below a new identity on every render.
  const targetWords = useMemo(() => tokenize(target), [target])
  const slotCount = targetWords.length

  // Always a dense array of exactly `slotCount` entries. Keeping the indexes
  // aligned with the target slots is what makes click-any-word navigation safe:
  // writing into a far-off slot can't punch a hole in the array and collapse
  // every word between it and here.
  const typedWords = useMemo(() => {
    const parts = value.trim() ? value.split(/\s+/) : []
    return targetWords.map((_, i) => parts[i] ?? '')
  }, [targetWords, value])

  const [cursorPos, setCursorPos] = useState<number>(0)
  // The active slot is explicit state rather than derived from what's already
  // typed. Deriving it from "the first word still missing" looks tempting, but
  // it yanks focus to the next slot after every single keystroke and scatters
  // a word one letter per slot. Focus moves only on Space, arrows, or a click.
  const [slotIdx, setSlotIdx] = useState(0)
  const activeIdx = Math.min(Math.max(slotIdx, 0), Math.max(0, slotCount - 1))
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  // Reset slot selection when target changes — use a ref to track previous
  // target and avoid synchronous setState in effect (React 19 best practice).
  const prevTargetRef = useRef(target)
  useEffect(() => {
    if (prevTargetRef.current !== target) {
      prevTargetRef.current = target
      setSlotIdx(0)
      setCursorPos(0)
    }
  }, [target])

  useEffect(() => {
    if (autoFocus && !disabled) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
        setFocused(true)
      }, 80)
      return () => window.clearTimeout(id)
    }
  }, [autoFocus, disabled, target])

  const currentWord = typedWords[activeIdx] ?? ''
  // Box size follows the longest word so every slot stays readable, stepped
  // down a further tier for long sentences (see `slotFitClass`).
  const longestWordLen = targetWords.reduce((m, w) => Math.max(m, w.length), 0)
  const fit = slotFitClass(longestWordLen, slotCount)

  const doneCount = useMemo(
    () => typedWords.filter((w, i) => wordStateOf(targetWords[i] ?? '', w) === 'ok').length,
    [targetWords, typedWords]
  )

  // Clamped at read time rather than stored back into state: deriving it here
  // keeps a shrinking word from parking the caret past its own end, with no
  // effect and no cascading render to keep the two in sync.
  const caretPos = Math.min(cursorPos, currentWord.length)

  const focusSlot = useCallback(
    (idx: number, pos?: number) => {
      if (disabled) return
      setSlotIdx(idx)
      const targetWord = typedWords[idx] ?? ''
      const targetPos = typeof pos === 'number' ? Math.min(pos, targetWord.length) : targetWord.length
      setCursorPos(targetPos)
      if (inputRef.current) {
        try {
          inputRef.current.setSelectionRange(targetPos, targetPos)
        } catch {}
        inputRef.current.focus({ preventScroll: true })
      }
      setFocused(true)
    },
    [disabled, typedWords]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    typeFeelFromKey(e)
    const words = [...typedWords]

    if (e.key === 'ArrowLeft') {
      const start = inputRef.current?.selectionStart ?? caretPos
      if (start === 0 && activeIdx > 0) {
        e.preventDefault()
        focusSlot(activeIdx - 1)
        return
      }
    }

    if (e.key === 'ArrowRight') {
      const end = inputRef.current?.selectionEnd ?? caretPos
      if (end >= currentWord.length && activeIdx < slotCount - 1) {
        e.preventDefault()
        focusSlot(activeIdx + 1, 0)
        return
      }
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      // Space means "lock this word" — never "skip past a word I haven't
      // typed", so an empty slot swallows it instead of jumping the queue.
      if (!words[activeIdx]?.trim()) return
      if (activeIdx < slotCount - 1) {
        focusSlot(activeIdx + 1, 0)
      } else if (onSubmit && words.join(' ').trim()) {
        onSubmit()
      }
      return
    }

    if (e.key === 'Backspace' && !words[activeIdx] && activeIdx > 0) {
      e.preventDefault()
      focusSlot(activeIdx - 1, (words[activeIdx - 1] ?? '').length)
      return
    }

    if (e.key === 'Enter' && onSubmit && value.trim()) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    if (/\s/.test(rawVal)) {
      // A paste carrying spaces drops straight into the following slots.
      const pasted = rawVal.trim().split(/\s+/)
      const words = [...typedWords]
      words.splice(activeIdx, 1, ...pasted)
      onChange(words.slice(0, slotCount).join(' '))
      focusSlot(Math.min(activeIdx + pasted.length - 1, slotCount - 1))
      return
    }

    const raw = rawVal.replace(/\s+/g, '')
    const words = [...typedWords]
    words[activeIdx] = raw
    onChange(words.join(' '))
    setCursorPos(e.target.selectionStart ?? raw.length)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Words wrap as whole units and every line stays centred, so a long
          sentence reflows instead of running off the card. */}
      <div
        role="group"
        aria-label="Word slots"
        className={cn('spell-row spell-row-wrap spell-row-inner py-2 cursor-text', fit)}
      >
        {targetWords.map((tw, i) => {
          const typed = typedWords[i] ?? ''
          const state = wordStateOf(tw, typed)
          const isActive = i === activeIdx && focused && !disabled
          const slotPos = isActive ? caretPos : typed.length
          // Null unless this is the live slot — an inactive word must never
          // show a caret, or every finished word looks like it is being edited.
          const caret = isActive ? (
            <span className="spell-letter" key="caret" aria-hidden="true">
              <span className={`inline-block h-[1.15em] w-0.5 rounded-full bg-primary ${CARET}`} />
            </span>
          ) : null

          return (
            <div
              key={i}
              className="spell-word"
              role="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => focusSlot(i)}
              aria-label={`Word ${i + 1} of ${slotCount}${typed ? `: ${typed} — ${STATE_WORDS[state]}` : ''}`}
            >
              <div
                className={cn(
                  'spell-word-box relative rounded-xl border-2 px-2.5 py-2 font-mono font-semibold select-none cursor-pointer transition-colors duration-150',
                  slotBoxTone(state, isActive),
                  isActive && 'z-10 ring-[3px] ring-primary/20 shadow-md',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
                // Sized from the target word, not the typed one, so the slot
                // never reflows while a word is being written into it.
                style={{ minWidth: `calc(${Math.max(3, tw.length)}ch + 1.25rem)` }}
              >
                {typed ? (
                  <TypedWord typed={tw} raw={typed} state={state} slotPos={slotPos} caret={caret} masked={masked} />
                ) : isActive ? (
                  caret
                ) : guided ? (
                  <>
                    <span className="spell-letter text-muted-foreground/45">{tw[0] ?? ''}</span>
                    <span className="spell-letter tracking-wider text-muted-foreground/40">
                      {'·'.repeat(Math.max(0, Math.min(tw.length - 1, 8)))}
                    </span>
                  </>
                ) : (
                  <span className="spell-letter tracking-widest text-muted-foreground/30">···</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        id="dictation-input"
        value={typedWords[activeIdx] ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          if (typeof e.currentTarget.selectionStart === 'number') {
            setCursorPos(e.currentTarget.selectionStart)
          }
        }}
        onKeyUp={(e) => {
          if (typeof e.currentTarget.selectionStart === 'number') {
            setCursorPos(e.currentTarget.selectionStart)
          }
        }}
        onFocus={() => {
          setFocused(true)
          if (typeof inputRef.current?.selectionStart === 'number') {
            setCursorPos(inputRef.current.selectionStart)
          }
        }}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-testid="dictation-input"
        aria-label={`Type word ${activeIdx + 1} of ${slotCount}`}
        className="sr-only"
      />
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
        <span className="num">
          Word {Math.min(activeIdx + 1, slotCount)} of {slotCount}
        </span>
        <span aria-hidden="true">·</span>
        <span className={cn('num', doneCount === slotCount && 'text-success')}>
          {doneCount} correct
        </span>
        <span aria-hidden="true">·</span>
        <span>Space locks word · Enter checks · Click any word to jump</span>
      </div>
      {/* Announces word moves and completions only — the counter is derived from
          whole-word state, so it never fires mid-word on every keystroke. */}
      <p role="status" aria-live="polite" className="sr-only">
        {`Word ${Math.min(activeIdx + 1, slotCount)} of ${slotCount}. ${doneCount} of ${slotCount} correct.`}
      </p>
    </div>
  )
}

/**
 * The typed word split into one cell per letter, coloured against the target.
 * Wrong letters go red; letters past the end of the word go red and underlined,
 * because typing too many letters is a different mistake from misspelling one.
 * The caret is woven in at the true cursor position so it sits between letters
 * rather than after the word.
 */
function TypedWord({
  typed,
  raw,
  state,
  slotPos,
  caret,
  masked,
}: {
  typed: string
  raw: string
  state: WordState
  slotPos: number
  caret: React.ReactNode
  masked: boolean
}) {
  const cells = compareWordLetters(typed, raw)

  if (state === 'ok' && !masked) {
    // A finished word reads better as one word than as a row of letters, so it
    // skips the per-letter treatment entirely. The caret still has to be visible
    // while editing, sitting before the word at position 0 and after it otherwise.
    return (
      <>
        {slotPos === 0 ? caret : null}
        <span className="spell-letter tracking-tight">{raw}</span>
        {slotPos === 0 ? null : caret}
      </>
    )
  }

  // One pass over the word so the caret is inserted exactly once. Building it
  // in two loops (typed letters, then placeholders) duplicated the caret
  // whenever the cursor sat at the end of what had been typed.
  const width = Math.max(typed.length, cells.length)
  const out: React.ReactNode[] = []
  for (let i = 0; i < width; i++) {
    if (i === slotPos) out.push(caret)
    const cell = cells[i]
    out.push(
      cell ? (
        <span
          key={i}
          className={cn('spell-letter', `spell-letter-${cell.state}`, masked && 'opacity-70')}
        >
          {masked ? '•' : cell.char}
        </span>
      ) : (
        // Faint placeholders for letters still owed, so the eye can see how much
        // of the word is left without the answer being spelled out.
        <span key={`p${i}`} className="spell-letter text-muted-foreground/25">
          ·
        </span>
      )
    )
  }
  if (slotPos >= width) out.push(caret)

  return <>{out}</>
}

const STATE_WORDS: Record<WordState, string> = {
  empty: 'empty',
  partial: 'incomplete',
  ok: 'correct',
  wrong: 'has errors',
}

/** Box colour by word state; the active slot always wins over its state. */
function slotBoxTone(state: WordState, isActive: boolean): string {
  if (isActive) return 'border-primary bg-primary-soft'
  switch (state) {
    case 'ok':
      return 'border-success/60 bg-success-soft'
    case 'wrong':
      return 'border-destructive/60 bg-destructive-soft'
    case 'partial':
      return 'border-primary-line/50 bg-primary-soft/30'
    default:
      return 'border-dashed border-border bg-card'
  }
}