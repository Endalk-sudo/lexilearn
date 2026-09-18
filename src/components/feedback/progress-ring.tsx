'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMotionSafe } from '@/lib/motion'
import { useCountUp } from '@/hooks/use-count-up'

/** Progress ring that fills to its value, with a counting label. */
export function ProgressRing({
  value,
  size = 88,
  stroke = 8,
  label,
  sublabel,
  className,
}: {
  value: number // 0-100
  size?: number
  stroke?: number
  label: string
  sublabel?: string
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const shown = useCountUp(Math.round(pct))
  const { t } = useMotionSafe()

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted" fill="none" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (pct / 100) * c }}
            transition={t({ type: 'spring', stiffness: 90, damping: 20 })}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums leading-none num">{shown}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{label}</div>
        {sublabel ? (
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{sublabel}</div>
        ) : null}
      </div>
    </div>
  )
}
