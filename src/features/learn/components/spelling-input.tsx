'use client'

import { cn } from '@/lib/utils'
import { typeFeelFromKey } from '@/lib/feel'
import { useCallback, useEffect, useRef } from 'react'

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
  const targetLower = target.toLowerCase()
  const valueLower = value.toLowerCase()
  const chars = targetLower.split('')
  const s = SIZE[size]

  useEffect(() => {
    if (autoFocus && !disabled) {
      const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80)
      return () => window.clearTimeout(id)
    }
  }, [autoFocus, disabled, target])

  const focusInput = useCallback(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true })
  }, [disabled])

  return (
    <div className={cn('space-y-4', className)}>
      <div role="group" aria-label="Spelling boxes" onClick={focusInput}
        className={cn('flex flex-wrap justify-center py-2 select-none cursor-text', s.gap)}>
        {chars.map((ch, i) => {
          const isSpace = ch === ' '
          const typed = valueLower[i] ?? ''
          const isCurrent = !isSpace && valueLower.length === i && !disabled
          const isFilled = !isSpace && typed !== ''
          const isCorrect = isFilled && typed === ch
          const isWrong = isFilled && typed !== ch
          const showGuide = guided && !isFilled && !isCurrent && !isSpace
          return (
            <div key={i} className={cn(
              'relative flex items-center justify-center rounded-xl border-2 font-mono font-bold transition-all duration-150 shadow-xs',
              s.box,
              isSpace && 'border-transparent bg-transparent w-4 sm:w-5 shadow-none',
              !isSpace && !isFilled && !isCurrent && 'bg-card border-border/80 text-muted-foreground/30',
              isCurrent && 'bg-primary-soft border-primary ring-[3px] ring-primary/25 scale-110 shadow-md z-10',
              isCorrect && 'border-success bg-success-soft text-success shadow-sm',
              isWrong && 'border-destructive bg-destructive-soft text-destructive animate-shake',
            )}>
              {isSpace ? '\u00A0' : masked && isFilled ? (
                <span className="opacity-70">•</span>
              ) : isFilled ? typed : showGuide && i === 0 ? (
                <span className="text-muted-foreground/50 font-semibold">{ch}</span>
              ) : showGuide ? (
                <span className="text-muted-foreground/35 text-base">·</span>
              ) : isCurrent ? (
                <span className="absolute inset-x-1 bottom-1.5 h-0.5 rounded-full bg-primary/60 animate-pulse" />
              ) : null}
            </div>
          )
        })}
      </div>
      <input ref={inputRef} type="text" value={value}
        onChange={(e) => onChange(e.target.value.slice(0, target.length))}
        disabled={disabled} placeholder={placeholder ?? 'Type the word…'} className="sr-only"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        data-testid={testId}
        aria-label="Type the spelling"
        onKeyDown={(e) => {
          typeFeelFromKey(e)
          if (e.key === 'Enter' && onSubmit && value.trim()) { e.preventDefault(); onSubmit() }
        }}
      />
      <div className="flex justify-center">
        <button type="button" onClick={focusInput} disabled={disabled}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
          {value ? `${value.length} / ${target.replace(/\s/g, '').length} letters` : 'Click boxes or start typing'}
        </button>
      </div>
    </div>
  )
}
