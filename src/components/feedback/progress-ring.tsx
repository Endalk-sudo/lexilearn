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
        <svg width={size} height={size} className="-rotate-90 drop-shadow-xs" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted/60" fill="none" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            className={cn(
              pct >= 100 ? 'stroke-success' : 'stroke-primary',
              'transition-colors duration-300'
            )}
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (pct / 100) * c }}
            transition={t({ type: 'spring', stiffness: 90, damping: 20 })}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums leading-none num tracking-tight">
            {shown}%
          </span>
          {pct >= 100 ? (
            <span className="text-[10px] font-semibold text-success uppercase tracking-wider mt-0.5">Done</span>
          ) : null}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold leading-tight tracking-tight flex items-center gap-1.5">
          {label}
          {pct >= 100 ? <span className="inline-block text-xs">✨</span> : null}
        </div>
        {sublabel ? (
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{sublabel}</div>
        ) : null}
      </div>
    </div>
  )
}
