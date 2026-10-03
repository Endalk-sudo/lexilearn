'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { transition, useMotionSafe } from '@/lib/motion'

export type SegmentOption<T extends string> = {
  value: T
  label: string
  icon?: React.ElementType
  badge?: number | string
}

/**
 * The only sub-navigation pattern in the app. Replaces the old nested tab bars
 * so there is never more than one navigation decision on screen.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const id = useId()
  const { t, reduce } = useMotionSafe()

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'surface-inset flex w-full gap-1.5 rounded-2xl p-1.5 shadow-neu-inset border border-border/50',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 cursor-pointer select-none',
              size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {active ? (
              <motion.span
                layoutId={reduce ? undefined : `segment-${id}`}
                className="absolute inset-0 rounded-xl bg-card border border-white/60 dark:border-white/10 shadow-neu-sm"
                transition={t(transition.fast)}
                aria-hidden="true"
              />
            ) : null}
            {Icon ? <Icon className="relative h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            <span className="relative truncate">{option.label}</span>
            {option.badge !== undefined && option.badge !== 0 && option.badge !== null ? (
              <span
                className={cn(
                  'relative flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold num shadow-2xs',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted/80 text-muted-foreground'
                )}
              >
                {option.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}