'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One page header for every top-level view: eyebrow -> title -> description -> actions.
 * Keeps hierarchy identical across the app so nothing feels like a different product.
 */
export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  icon?: React.ElementType
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="label flex items-center gap-1.5 text-primary">
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Consistent section heading used inside pages. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}