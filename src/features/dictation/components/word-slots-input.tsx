'use client'

import { cn } from '@/lib/utils'
import { typeFeelFromKey } from '@/lib/feel'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const targetWords = tokenize(target)
  const typedWords = value.length ? value.split(/\s+/) : ['']
  while (typedWords.length < 1) typedWords.push('')

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [cursorPos, setCursorPos] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  // Clamp activeIdx safely
  const defaultIdx = Math.min(typedWords.length - 1, Math.max(0, targetWords.length - 1))
  const activeIdx =
    selectedSlot !== null && selectedSlot >= 0 && selectedSlot < targetWords.length
      ? selectedSlot
      : defaultIdx

  // Reset slot selection when target changes — use a ref to track previous target
  // and avoid synchronous setState in effect (React 19 best practice).
  const prevTargetRef = useRef(target)
  useEffect(() => {
    if (prevTargetRef.current !== target) {
      prevTargetRef.current = target
      setSelectedSlot(null)
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

  // Clamp cursor position when word length changes — use a ref to avoid
  // synchronous setState in effect (React 19 best practice).
  const prevWordLenRef = useRef(currentWord.length)
  useEffect(() => {
    if (prevWordLenRef.current !== currentWord.length) {
      prevWordLenRef.current = currentWord.length
      if (cursorPos > currentWord.length) {
        setCursorPos(currentWord.length)
      }
    }
  }, [currentWord, cursorPos])

  const focusSlot = useCallback(
    (idx: number, pos?: number) => {
      if (disabled) return
      setSelectedSlot(idx)
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
      const start = inputRef.current?.selectionStart ?? cursorPos
      if (start === 0 && activeIdx > 0) {
        e.preventDefault()
        focusSlot(activeIdx - 1)
        return
      }
    }

    if (e.key === 'ArrowRight') {
      const end = inputRef.current?.selectionEnd ?? cursorPos
      if (end >= currentWord.length && activeIdx < typedWords.length - 1) {
        e.preventDefault()
        focusSlot(activeIdx + 1, 0)
        return
      }
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      if (!words[activeIdx]?.trim()) return
      if (activeIdx < targetWords.length - 1) {
        if (activeIdx === typedWords.length - 1) {
          words.push('')
          onChange(words.join(' '))
        }
        focusSlot(activeIdx + 1, 0)
      } else if (onSubmit && words.join(' ').trim()) {
        onSubmit()
      }
      return
    }

    if (e.key === 'Backspace' && !words[activeIdx] && activeIdx > 0) {
      e.preventDefault()
      if (activeIdx === words.length - 1) {
        words.pop()
        onChange(words.join(' '))
      }
      const prevIdx = activeIdx - 1
      focusSlot(prevIdx, (words[prevIdx] ?? '').length)
      return
    }

    if (e.key === 'Enter' && onSubmit && value.trim()) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    if (rawVal.includes(' ')) {
      const pasted = rawVal.trim().split(/\s+/)
      const words = [...typedWords]
      words.splice(activeIdx, 1, ...pasted)
      const newWords = words.slice(0, targetWords.length)
      onChange(newWords.join(' '))
      const newActive = Math.min(activeIdx + pasted.length - 1, targetWords.length - 1)
      focusSlot(newActive)
      return
    }

    const raw = rawVal.replace(/\s+/g, '')
    const words = [...typedWords]
    words[activeIdx] = raw
    onChange(words.join(' '))
    setCursorPos(e.target.selectionStart ?? raw.length)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div
        role="group"
        aria-label="Word slots"
        className="flex flex-wrap justify-center gap-2 sm:gap-2.5 py-1 cursor-text"
      >
        {targetWords.map((tw, i) => {
          const typed = typedWords[i] ?? ''
          const isActive = i === activeIdx && focused && !disabled
          const isPast = i < activeIdx
          const showGuide = guided && !typed && !isActive
          const slotPos = isActive ? cursorPos : typed.length
          const maxClickable = Math.min(typedWords.filter(Boolean).length, targetWords.length - 1)

          return (
            <div
              key={i}
              role="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => focusSlot(Math.min(i, maxClickable))}
              aria-label={`Word slot ${i + 1}${typed ? `: ${typed}` : ''}`}
              className={cn(
                'relative min-w-[4.5rem] sm:min-w-[5.5rem] rounded-xl border-2 px-3 py-2.5 font-mono text-base sm:text-lg font-semibold transition-all duration-150 text-center select-none cursor-pointer',
                isActive && 'border-primary bg-primary-soft ring-[3px] ring-primary/20 scale-[1.03] shadow-md z-10',
                isPast && typed && 'border-success/60 bg-success-soft/40 text-foreground',
                !isActive && !isPast && 'border-border bg-card text-muted-foreground/50 hover:border-border/80',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              {typed ? (
                masked ? (
                  isActive ? (
                    <span className="tracking-widest inline-flex items-center justify-center">
                      <span>{'•'.repeat(Math.min(slotPos, 12))}</span>
                      <span className="inline-block w-0.5 h-5 bg-primary rounded-full animate-caret-blink mx-0.5" />
                      <span>{'•'.repeat(Math.max(0, Math.min(typed.length - slotPos, 12)))}</span>
                    </span>
                  ) : (
                    <span className="tracking-widest">{'•'.repeat(Math.min(typed.length, 12))}</span>
                  )
                ) : isActive ? (
                  <span className="text-foreground inline-flex items-center justify-center">
                    <span>{typed.slice(0, slotPos)}</span>
                    <span className="inline-block w-0.5 h-5 bg-primary rounded-full animate-caret-blink -mx-px" />
                    <span>{typed.slice(slotPos)}</span>
                  </span>
                ) : (
                  <span className="text-foreground">{typed}</span>
                )
              ) : showGuide ? (
                <span className="text-muted-foreground/45 tracking-wider">
                  {tw[0]}
                  {'·'.repeat(Math.max(0, Math.min(tw.length - 1, 8)))}
                </span>
              ) : (
                <span className="text-muted-foreground/25">
                  {isActive ? (
                    <span className="inline-block w-0.5 h-5 bg-primary rounded-full animate-caret-blink align-middle" />
                  ) : (
                    '···'
                  )}
                </span>
              )}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 num">
                {i + 1}
              </span>
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
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
        aria-label={`Type word ${activeIdx + 1} of ${targetWords.length}`}
        className="sr-only"
      />
      <p className="text-center text-xs text-muted-foreground">
        Space locks word · Backspace or arrows navigate · Click slot to jump · Enter checks
      </p>
    </div>
  )
}
