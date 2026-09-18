'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
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
      <div className="flex gap-1 sm:gap-1.5 flex-wrap justify-center">
        {targetLower.split('').map((ch, i) => {
          const typed = valueLower[i] ?? ''
          const isSpace = ch === ' '
          const isCorrect = !isSpace && typed !== '' && typed === ch
          const isWrong = !isSpace && typed !== '' && typed !== ch
          return (
            <div
              key={i}
              className={cn(
                'h-11 w-8 sm:h-12 sm:w-10 flex items-center justify-center rounded-md border-2 font-mono text-lg font-medium transition-colors',
                isSpace && 'border-transparent bg-transparent w-2',
                !isSpace && !typed && 'bg-muted/40 border-input',
                isCorrect && 'border-success bg-success-soft text-success',
                isWrong && 'border-destructive bg-destructive-soft text-destructive',
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
