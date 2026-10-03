'use client'

import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'streak'

const TONE_BG: Record<Tone, string> = {
  default: 'surface-inset shadow-neu-inset-sm text-muted-foreground border border-border/50',
  primary: 'surface shadow-neu-sm text-primary border border-white/60 dark:border-white/10 bg-primary-soft',
  success: 'surface shadow-neu-sm text-success border border-white/60 dark:border-white/10 bg-success-soft',
  warning: 'surface shadow-neu-sm text-warning border border-white/60 dark:border-white/10 bg-warning-soft',
  streak: 'surface shadow-neu-sm text-streak border border-white/60 dark:border-white/10 bg-streak-soft',
}

/**
 * Compact statistic. Numbers animate on change and always use tabular figures.
 * Renders as a tactile button when it navigates somewhere.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tone = 'default',
  onClick,
  className,
}: {
  icon?: React.ElementType
  label: string
  value: number | string
  suffix?: string
  hint?: string
  tone?: Tone
  onClick?: () => void
  className?: string
}) {
  const numeric = typeof value === 'number'
  const animated = useCountUp(numeric ? (value as number) : 0)
  const shown = numeric ? animated : value

  const body = (
    <>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg', TONE_BG[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
        <span className="label text-muted-foreground tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums leading-none tracking-tight num text-foreground">
        {shown}
        {suffix ? <span className="ml-1 text-sm font-semibold text-muted-foreground">{suffix}</span> : null}
      </div>
      {hint ? <div className="mt-1.5 text-xs leading-snug text-muted-foreground/80">{hint}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'surface lift min-h-12 w-full p-4 text-left group cursor-pointer rounded-2xl',
          'active:scale-[.97] active:shadow-neu-pressed transition-all duration-150',
          className
        )}
      >
        {body}
      </button>
    )
  }

  return <div className={cn('surface p-4 rounded-2xl', className)}>{body}</div>
}