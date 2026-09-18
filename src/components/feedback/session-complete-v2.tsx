'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Flame, RotateCcw, Sparkles, Target, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { celebrate } from '@/components/feedback/confetti'
import { buzz, playSound } from '@/lib/feel'
import { cn } from '@/lib/utils'
import { listItem, popIn, stagger, useMotionSafe } from '@/lib/motion'
import { useCountUp } from '@/hooks/use-count-up'

export function SessionCompleteV2({
  title,
  subtitle,
  correct,
  total,
  xp,
  streak,
  levelUp,
  challenge,
  onAgain,
  onDone,
}: {
  title?: string
  subtitle?: string
  correct: number
  total: number
  xp: number
  streak: number
  levelUp?: boolean
  challenge?: boolean
  onAgain?: () => void
  onDone: () => void
}) {
  const acc = total ? Math.round((correct / total) * 100) : 0
  const shownXp = useCountUp(xp)
  const shownAcc = useCountUp(acc)
  const shownStreak = useCountUp(streak)
  const { v, t, reduce } = useMotionSafe()

  useEffect(() => {
    if (reduce) return
    if (levelUp || challenge) {
      celebrate('levelup')
      playSound('levelup')
      buzz('success')
    } else if (acc >= 70) {
      celebrate('xp')
      playSound('correct')
      buzz('success')
    } else {
      playSound('xp')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div variants={v(stagger(0.06))} initial="hidden" animate="show" transition={t()}>
      <div className="surface p-6 text-center sm:p-8">
        <motion.div
          variants={v(popIn)}
          className={cn(
            'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
            levelUp ? 'bg-streak-soft text-streak' : challenge ? 'bg-primary-soft text-primary' : acc >= 70 ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'
          )}
          aria-hidden="true"
        >
          {levelUp ? <Trophy className="h-7 w-7" /> : challenge ? <Target className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
        </motion.div>

        <motion.div variants={v(listItem)} transition={t()} className="mt-4">
          <p className="label text-primary">Session complete</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {title ?? 'Nice work'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {subtitle ??
              (acc >= 80
                ? 'Sharp recall — this is what compounding memory feels like.'
                : acc >= 50
                  ? 'Solid rep. The ones you missed will come back sooner, which is the whole point.'
                  : 'Every attempt counts. Short sessions beat cramming, so this was worth it.')}
          </p>
        </motion.div>

        <motion.dl variants={v(stagger(0.05))} className="mx-auto mt-6 grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Correct" value={`${correct}/${total}`} />
          <Stat label="Accuracy" value={`${shownAcc}%`} />
          <Stat label="XP earned" value={`+${shownXp}`} tone="primary" />
          <Stat label="Streak" value={`${shownStreak}d`} icon />
        </motion.dl>

        {challenge || levelUp ? (
          <motion.div variants={v(listItem)} transition={t()} className="mt-4 flex flex-wrap justify-center gap-2">
            {challenge ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
                <Target className="h-3.5 w-3.5" aria-hidden="true" /> Challenge complete
              </span>
            ) : null}
            {levelUp ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-streak-soft px-3 py-1.5 text-xs font-medium text-streak">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Level up
              </span>
            ) : null}
          </motion.div>
        ) : null}

        <motion.div variants={v(listItem)} transition={t()} className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {onAgain ? (
            <Button variant="outline" onClick={onAgain}>
              <RotateCcw className="h-4 w-4" />
              Go again
            </Button>
          ) : null}
          <Button onClick={onDone}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone?: 'primary'
  icon?: boolean
}) {
  return (
    <motion.div variants={listItem} className="rounded-lg border border-border bg-muted/30 p-3">
      <dd className={cn('text-lg font-semibold leading-none num', tone === 'primary' && 'text-primary')}>
        {value}
        {icon ? <Flame className="ml-1 inline h-4 w-4 text-streak" aria-hidden="true" /> : null}
      </dd>
      <dt className="label mt-1.5 text-muted-foreground">{label}</dt>
    </motion.div>
  )
}
