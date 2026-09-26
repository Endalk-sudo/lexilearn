'use client'

import { cn } from '@/lib/utils'
import { typeFeelFromKey } from '@/lib/feel'
import { useEffect, useRef, useState } from 'react'
import { tokenize } from '@/features/dictation/lib/dictation'

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

export function WordSlotsInput({
  target, value, onChange, disabled, autoFocus, onSubmit,
  guided = false, masked = false, className,
}: WordSlotsInputProps) {
  const targetWords = tokenize(target)
  const typedWords = value.length ? value.split(/\s+/) : ['']
  while (typedWords.length < 1) typedWords.push('')
  const activeIdx = Math.min(typedWords.length - 1, Math.max(0, targetWords.length - 1))
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (autoFocus && !disabled) {
      const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80)
      return () => window.clearTimeout(id)
    }
  }, [autoFocus, disabled, target])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    typeFeelFromKey(e)
    const words = [...typedWords]
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      if (!words[activeIdx]?.trim()) return
      if (activeIdx < targetWords.length - 1) { words.push(''); onChange(words.join(' ')) }
      else if (onSubmit && words.join(' ').trim()) onSubmit()
      return
    }
    if (e.key === 'Backspace' && !words[activeIdx] && activeIdx > 0) {
      e.preventDefault(); words.pop(); onChange(words.join(' ')); return
    }
    if (e.key === 'Enter' && onSubmit && value.trim()) { e.preventDefault(); onSubmit() }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s+/g, '')
    const words = [...typedWords]
    words[activeIdx] = raw
    onChange(words.join(' '))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div role="group" aria-label="Word slots" onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap justify-center gap-2 sm:gap-2.5 py-1 cursor-text">
        {targetWords.map((tw, i) => {
          const typed = typedWords[i] ?? ''
          const isActive = i === activeIdx && focused && !disabled
          const isPast = i < activeIdx
          const showGuide = guided && !typed && !isActive
          return (
            <div key={i} className={cn(
              'relative min-w-[4.5rem] sm:min-w-[5.5rem] rounded-xl border-2 px-3 py-2.5 font-mono text-base sm:text-lg font-semibold transition-all duration-150 text-center',
              isActive && 'border-primary bg-primary-soft ring-[3px] ring-primary/20 scale-[1.03] shadow-md z-10',
              isPast && typed && 'border-success/60 bg-success-soft/40 text-foreground',
              !isActive && !isPast && 'border-border bg-card text-muted-foreground/50',
              disabled && 'opacity-60',
            )}>
              {typed ? (masked ? <span className="tracking-widest">{'•'.repeat(Math.min(typed.length, 12))}</span> : <span className="text-foreground">{typed}</span>)
                : showGuide ? <span className="text-muted-foreground/45 tracking-wider">{tw[0]}{'·'.repeat(Math.max(0, Math.min(tw.length - 1, 8)))}</span>
                : <span className="text-muted-foreground/25">{isActive ? <span className="inline-block w-0.5 h-5 bg-primary animate-pulse align-middle" /> : '···'}</span>}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 num">{i + 1}</span>
            </div>
          )
        })}
      </div>
      <input ref={inputRef} type="text" value={typedWords[activeIdx] ?? ''} onChange={handleChange}
        onKeyDown={handleKeyDown} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        disabled={disabled} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        data-testid="dictation-input"
        aria-label={`Type word ${activeIdx + 1} of ${targetWords.length}`} className="sr-only" />
      <p className="text-center text-xs text-muted-foreground">Space locks word · Backspace goes back · Enter checks</p>
    </div>
  )
}
