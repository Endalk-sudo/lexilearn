'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { typeFeelFromKey } from '@/lib/feel'
import { useEffect, useRef } from 'react'

export type SpellingInputProps = {
  value: string
  onChange: (v: string) => void
  target: string
  disabled?: boolean
  autoFocus?: boolean
  onSubmit?: () => void
  placeholder?: string
}

export function SpellingInput({
  value,
  onChange,
  target,
  disabled,
  autoFocus,
  onSubmit,
  placeholder,
}: SpellingInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const targetLower = target.toLowerCase()
  const valueLower = value.toLowerCase()

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus()
  }, [autoFocus, disabled])

  return (
    <div className="space-y-3">
      {/* Visual character grid */}
      <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center py-1">
        {targetLower.split('').map((ch, i) => {
          const typed = valueLower[i] ?? ''
          const isSpace = ch === ' '
          const isCurrent = !isSpace && valueLower.length === i
          const isCorrect = !isSpace && typed !== '' && typed === ch
          const isWrong = !isSpace && typed !== '' && typed !== ch
          return (
            <div
              key={i}
              className={cn(
                'h-12 w-9 sm:h-14 sm:w-11 flex items-center justify-center rounded-lg border-2 font-mono text-xl font-bold transition-all duration-150 select-none shadow-xs',
                isSpace && 'border-transparent bg-transparent w-3',
                !isSpace && !typed && !isCurrent && 'bg-card border-border text-muted-foreground/40',
                isCurrent && 'bg-primary-soft/50 border-primary ring-2 ring-primary/20 scale-105',
                isCorrect && 'border-success bg-success-soft text-success shadow-xs',
                isWrong && 'border-destructive bg-destructive-soft text-destructive animate-shake',
              )}
            >
              {typed || (isSpace ? '\u00A0' : '')}
            </div>
          )
        })}
      </div>
      {/* Hidden input for typing */}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? 'Type the word…'}
        className="text-center font-mono text-lg"
        onKeyDown={(e) => {
          typeFeelFromKey(e)
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault()
            onSubmit()
          }
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  )
}
