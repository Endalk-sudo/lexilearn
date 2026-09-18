'use client'

import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'streak'

const TONE: Record<Tone, string> = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  streak: 'text-streak',
}

/**
 * Compact statistic. Numbers animate on change and always use tabular figures.
 * Renders as a button when it navigates somewhere. Minimum 44px tap target.
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
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className={cn('h-3.5 w-3.5', TONE[tone])} aria-hidden="true" /> : null}
        <span className="label text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-semibold tabular-nums leading-none tracking-tight num">
        {shown}
        {suffix ? <span className="ml-0.5 text-sm font-medium text-muted-foreground">{suffix}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'surface lift min-h-11 w-full p-3.5 text-left',
          'active:scale-[.99] transition-transform duration-150',
          className
        )}
      >
        {body}
      </button>
    )
  }

  return <div className={cn('surface p-3.5', className)}>{body}</div>
}