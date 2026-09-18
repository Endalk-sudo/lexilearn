'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * "No dead ends" - every finished screen offers the next useful action.
 * Shared so the wording and weight stay identical everywhere.
 */
export function NextStep({
  title,
  hint,
  actionLabel,
  onAction,
  secondary,
  className,
}: {
  title: string
  hint: string
  actionLabel: string
  onAction: () => void
  secondary?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'surface flex flex-col gap-3 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {secondary}
        <Button onClick={onAction} className="shrink-0">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
