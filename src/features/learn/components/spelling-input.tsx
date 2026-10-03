'use client'

import { cn } from '@/lib/utils'
import { typeFeelFromKey } from '@/lib/feel'
import { useCallback, useEffect, useRef, useState } from 'react'
import { spellFitClass, splitTargetWords } from '@/features/study/ui/study-scale'

export type SpellingInputProps = {
  value: string
  onChange: (v: string) => void
  target: string
  disabled?: boolean
  autoFocus?: boolean
  onSubmit?: () => void
  placeholder?: string
  guided?: boolean
  masked?: boolean
  className?: string
  size?: 'md' | 'lg' | 'xl'
  /** Test hook. The visible affordance is a row of letter boxes; the real
   *  input is `sr-only`. Rung 0 dictation renders this component and higher
   *  rungs render WordSlotsInput, so both expose the same id. */
  testId?: string
}

export function SpellingInput({
  value, onChange, target, disabled, autoFocus, onSubmit, placeholder,
  guided = false, masked = false, className, size = 'lg', testId,
}: SpellingInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cursorPos, setCursorPos] = useState<number>(() => value.length)
  const [isFocused, setIsFocused] = useState<boolean>(() => !!autoFocus && !disabled)
  const targetLower = target.toLowerCase()
  const valueLower = value.toLowerCase()
  // (`size` is kept in props for API compatibility — box sizing now comes
  // from the target-length fit tier in globals.css, shared with dictation.)
  void size
  // Word groups + auto-size: multi-word targets render as grouped runs with
  // a visible gutter, and the whole row scales down a tier per length band so
  // a 4-letter and a 16-letter answer both fit one centered line.
  const groups = splitTargetWords(targetLower)
  const letterCount = targetLower.replace(/\s/g, '').length
  const fit = spellFitClass(letterCount)
  const multiWord = groups.length > 1
  // Flat index of each group's first letter inside the target string, for
  // mapping the shared cursor position onto grouped boxes.
  const groupOffsets: number[] = []
  {
    let at = 0
    for (const g of groups) {
      groupOffsets.push(at)
      at += g.length + 1 // +1 for the space between words
    }
  }

  useEffect(() => {
    if (autoFocus && !disabled) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
        setIsFocused(true)
      }, 80)
      return () => window.clearTimeout(id)
    }
  }, [autoFocus, disabled, target])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deferred via setTimeout above

  // Clamp cursor position when value length changes — use a ref to avoid
  // synchronous setState in effect (React 19 best practice).
  const prevValueLenRef = useRef(value.length)
  useEffect(() => {
    if (prevValueLenRef.current !== value.length) {
      prevValueLenRef.current = value.length
      if (cursorPos > value.length) {
        const id = window.setTimeout(() => { setCursorPos(value.length) }, 0)
        return () => window.clearTimeout(id)
      }
    }
  }, [value, cursorPos])

  const focusInput = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus({ preventScroll: true })
      setIsFocused(true)
    }
  }, [disabled])

  const handleBoxClick = (i: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    const safe = Math.min(value.length, i)
    setCursorPos(safe)
    setIsFocused(true)
    if (inputRef.current) {
      try {
        inputRef.current.setSelectionRange(safe, safe)
      } catch {}
      inputRef.current.focus({ preventScroll: true })
    }
  }

  // One letter box. `flatIndex` is the position inside the whole target
  // (spaces included) so clicks, carets and correctness keep working across
  // word-group boundaries exactly as before.
  const renderBox = (ch: string, flatIndex: number, guideIndex: number) => {
    const typed = valueLower[flatIndex] ?? ''
    const isFilled = typed !== ''
    const isAtInsertion = isFocused && !disabled && cursorPos === flatIndex
    const isCorrect = isFilled && typed === ch
    const isWrong = isFilled && typed !== ch
    const showGuide = guided && !isFilled && !isAtInsertion

    return (
      <div
        key={flatIndex}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleBoxClick(flatIndex, e)}
        className={cn(
          'spell-box relative flex items-center justify-center rounded-2xl font-mono font-bold transition-all duration-150 cursor-pointer select-none',
          !isFilled && !isAtInsertion && 'bg-card/80 border border-border/70 text-muted-foreground/30 shadow-neu-sm hover:shadow-neu hover:border-primary-line/40',
          isAtInsertion && !isFilled && 'bg-primary-soft/50 border-2 border-primary shadow-neu-primary scale-105 z-10 ring-2 ring-primary/25',
          isAtInsertion && isFilled && 'border-2 border-primary shadow-neu-primary scale-105 z-10 ring-2 ring-primary/30',
          !isAtInsertion && isCorrect && 'border-2 border-success/60 bg-success-soft text-success shadow-neu-sm',
          !isAtInsertion && isWrong && 'border-2 border-destructive/60 bg-destructive-soft text-destructive shadow-neu-sm animate-shake',
          !isAtInsertion && isFilled && !isCorrect && !isWrong && 'border border-border/80 bg-card text-foreground shadow-neu-sm'
        )}
      >
        {masked && isFilled ? (
          <span className="opacity-70">•</span>
        ) : isAtInsertion && isFilled ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute -left-1 sm:-left-1.5 h-6 sm:h-7 w-0.5 rounded-full bg-primary animate-caret-blink shadow-xs" />
            <span className="text-foreground">{typed}</span>
            <span className="absolute -bottom-2 inset-x-0 h-1 rounded-full bg-primary shadow-xs" />
          </div>
        ) : isAtInsertion && !isFilled ? (
          <span className="inline-block h-6 sm:h-7 w-0.5 rounded-full bg-primary animate-caret-blink shadow-xs" />
        ) : isFilled ? (
          typed
        ) : showGuide && guideIndex === 0 ? (
          <span className="text-muted-foreground/50 font-semibold">{ch}</span>
        ) : showGuide ? (
          <span className="text-muted-foreground/35 text-base">·</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        role="group"
        aria-label="Spelling boxes"
        onClick={focusInput}
        className={cn('spell-row spell-row-inner py-2 select-none cursor-text', fit)}
      >
        {groups.map((letters, gi) => (
          <div key={gi} className="contents">
            {gi > 0 ? (
              <div className="spell-gap" aria-hidden="true" title="Word break" />
            ) : null}
            <div
              className="spell-group spell-row-inner"
              role="group"
              aria-label={multiWord ? `Word ${gi + 1} of ${groups.length}` : undefined}
            >
              {letters.map((ch, li) => renderBox(ch, groupOffsets[gi] + li, groupOffsets[gi] + li))}
            </div>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        id={testId}
        value={value}
        onChange={(e) => {
          const next = e.target.value.slice(0, target.length)
          onChange(next)
          setCursorPos(e.target.selectionStart ?? next.length)
        }}
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
          setIsFocused(true)
          if (typeof inputRef.current?.selectionStart === 'number') {
            setCursorPos(inputRef.current.selectionStart)
          }
        }}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        placeholder={placeholder ?? 'Type the word…'}
        className="sr-only"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-testid={testId}
        aria-label="Type the spelling"
        onKeyDown={(e) => {
          typeFeelFromKey(e)
          requestAnimationFrame(() => {
            if (inputRef.current && typeof inputRef.current.selectionStart === 'number') {
              setCursorPos(inputRef.current.selectionStart)
            }
          })
          if (e.key === 'Enter' && onSubmit && value.trim()) {
            e.preventDefault()
            onSubmit()
          }
        }}
      />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={focusInput}
          disabled={disabled}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline cursor-pointer"
        >
          {value
            ? `${value.length} / ${letterCount} letters${multiWord ? ` · ${groups.length} words` : ''} (click a letter to jump)`
            : multiWord
              ? `${groups.length} words · click boxes or start typing`
              : 'Click boxes or start typing'}
        </button>
      </div>
    </div>
  )
}
