'use client'

import { motion } from 'framer-motion'
import type { ElementType, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fadeUp, useMotionSafe } from '@/lib/motion'

/**
 * Empty state that always guides: one mark, one sentence, one next action.
 * Never a dead end.
 */
export function EmptyState({
  icon: Icon,
  emoji,
  title,
  hint,
  actionLabel,
  onAction,
  secondary,
  className,
}: {
  icon?: ElementType
  emoji?: string
  title: string
  hint: string
  actionLabel?: string
  onAction?: () => void
  secondary?: ReactNode
  className?: string
}) {
  const { v, t } = useMotionSafe()
  return (
    <motion.div
      variants={v(fadeUp)}
      initial="hidden"
      animate="show"
      transition={t()}
      className={cn('surface border-dashed bg-card/60 p-7 text-center sm:p-9', className)}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden="true"
      >
        {Icon ? <Icon className="h-5 w-5" /> : <span className="text-xl">{emoji}</span>}
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{hint}</p>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="lg" className="mt-5">
          {actionLabel}
        </Button>
      ) : null}
      {secondary ? <div className="mt-3">{secondary}</div> : null}
    </motion.div>
  )
}

export function Guide({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs text-muted-foreground">{children}</p>
}
