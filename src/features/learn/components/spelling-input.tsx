'use client'

import { cn } from '@/lib/utils'
import { typeFeelFromKey } from '@/lib/feel'
import { useCallback, useEffect, useRef, useState } from 'react'

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

const SIZE = {
  md: { box: 'h-11 w-9 sm:h-12 sm:w-10 text-lg', gap: 'gap-1.5' },
  lg: { box: 'h-14 w-11 sm:h-16 sm:w-12 text-2xl', gap: 'gap-2' },
  xl: { box: 'h-16 w-12 sm:h-20 sm:w-14 text-3xl', gap: 'gap-2.5' },
} as const

export function SpellingInput({
  value, onChange, target, disabled, autoFocus, onSubmit, placeholder,
  guided = false, masked = false, className, size = 'lg', testId,
}: SpellingInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [cursorPos, setCursorPos] = useState<number>(() => value.length)
  const [isFocused, setIsFocused] = useState<boolean>(() => !!autoFocus && !disabled)
  const targetLower = target.toLowerCase()
  const valueLower = value.toLowerCase()
  const chars = targetLower.split('')
  const s = SIZE[size]

  useEffect(() => {
    if (autoFocus && !disabled) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
        setIsFocused(true)
      }, 80)
      return () => window.clearTimeout(id)
    }
  }, [autoFocus, disabled, target])

  // Clamp cursor position when value length changes — use a ref to avoid
  // synchronous setState in effect (React 19 best practice).
  const prevValueLenRef = useRef(value.length)
  useEffect(() => {
    if (prevValueLenRef.current !== value.length) {
      prevValueLenRef.current = value.length
      if (cursorPos > value.length) {
        setCursorPos(value.length)
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

  return (
    <div className={cn('space-y-4', className)}>
      <div
        role="group"
        aria-label="Spelling boxes"
        onClick={focusInput}
        className={cn('flex flex-wrap justify-center py-2 select-none cursor-text', s.gap)}
      >
        {chars.map((ch, i) => {
          const isSpace = ch === ' '
          const typed = valueLower[i] ?? ''
          const isFilled = !isSpace && typed !== ''
          const isAtInsertion = !isSpace && isFocused && !disabled && cursorPos === i
          const isCorrect = isFilled && typed === ch
          const isWrong = isFilled && typed !== ch
          const showGuide = guided && !isFilled && !isAtInsertion && !isSpace

          return (
            <div
              key={i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => handleBoxClick(i, e)}
              className={cn(
                'relative flex items-center justify-center rounded-xl border-2 font-mono font-bold transition-all duration-150 shadow-xs cursor-pointer select-none',
                s.box,
                isSpace && 'border-transparent bg-transparent w-4 sm:w-5 shadow-none cursor-default',
                !isSpace && !isFilled && !isAtInsertion && 'bg-card border-border/80 text-muted-foreground/30 hover:border-border',
                isAtInsertion && !isFilled && 'bg-primary-soft border-primary ring-[3px] ring-primary/25 scale-105 shadow-md z-10',
                isAtInsertion && isFilled && 'border-primary ring-[3px] ring-primary/30 scale-105 shadow-md z-10',
                !isAtInsertion && isCorrect && 'border-success bg-success-soft text-success shadow-sm',
                !isAtInsertion && isWrong && 'border-destructive bg-destructive-soft text-destructive animate-shake',
                !isAtInsertion && isFilled && !isCorrect && !isWrong && 'border-border/90 bg-card text-foreground'
              )}
            >
              {isSpace ? (
                '\u00A0'
              ) : masked && isFilled ? (
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
              ) : showGuide && i === 0 ? (
                <span className="text-muted-foreground/50 font-semibold">{ch}</span>
              ) : showGuide ? (
                <span className="text-muted-foreground/35 text-base">·</span>
              ) : null}
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
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
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline cursor-pointer"
        >
          {value ? `${value.length} / ${target.replace(/\s/g, '').length} letters (click letter to jump)` : 'Click boxes or start typing'}
        </button>
      </div>
    </div>
  )
}
