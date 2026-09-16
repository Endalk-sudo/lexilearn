'use client'

import { motion } from 'framer-motion'
import { Flame, Sparkles, Trophy, Target, ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function XpBurst({ amount }: { amount: number }) {
  if (!amount) return null
  return (
    <motion.div
      key={`${amount}-${Date.now()}`}
      initial={{ opacity: 0, y: 10, scale: .85 }}
      animate={{ opacity: 1, y: -8, scale: 1 }}
      transition={{ duration: .35 }}
      className="pointer-events-none fixed right-5 top-5 z-[70] rounded-full border bg-card px-4 py-2 text-sm font-black text-primary shadow-lg"
      aria-live="polite"
    >
      +{amount} XP
    </motion.div>
  )
}

export function SessionComplete({
  title = 'Session complete!',
  subtitle,
  correct,
  total,
  xp,
  streak,
  challengeComplete = false,
  levelUp = false,
  onAgain,
  onDone,
}: {
  title?: string
  subtitle?: string
  correct: number
  total: number
  xp: number
  streak: number
  challengeComplete?: boolean
  levelUp?: boolean
  onAgain?: () => void
  onDone: () => void
}) {
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  return (
    <motion.div initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .3 }}>
      <Card className="game-panel overflow-hidden rounded-[2rem]">
        <CardContent className="p-7 sm:p-10 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/12">
            {levelUp ? <Trophy className="h-10 w-10 text-primary" /> : challengeComplete ? <Target className="h-10 w-10 text-primary" /> : <Sparkles className="h-10 w-10 text-primary" />}
          </motion.div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Nice work</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle ?? 'A little practice today makes tomorrow easier.'}</p>

          <div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="Correct" value={`${correct}/${total}`} />
            <ResultStat label="Accuracy" value={`${accuracy}%`} />
            <ResultStat label="XP earned" value={`+${xp}`} emphasis />
            <ResultStat label="Streak" value={`${streak} 🔥`} />
          </div>

          {(challengeComplete || levelUp) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {challengeComplete && <BadgePill icon={Target} text="Daily challenge complete" />}
              {levelUp && <BadgePill icon={Trophy} text="Level up!" />}
            </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            {onAgain && <Button variant="outline" className="rounded-xl" onClick={onAgain}><RotateCcw className="mr-2 h-4 w-4" /> Again</Button>}
            <Button className="rounded-xl" onClick={onDone}>Back to dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ResultStat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="rounded-2xl border bg-background/70 p-3"><div className={cn('text-xl font-black tabular-nums', emphasis && 'text-primary')}>{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div></div>
}

function BadgePill({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return <div className="inline-flex items-center gap-2 rounded-full border bg-primary/8 px-3 py-1.5 text-xs font-semibold"><Icon className="h-3.5 w-3.5 text-primary" />{text}</div>
}

export function StreakBadge({ streak }: { streak: number }) {
  return <div className="inline-flex items-center gap-2 rounded-2xl border bg-card/80 px-3 py-2 shadow-sm"><Flame className="h-5 w-5 text-orange-500" /><div><div className="text-lg font-black leading-none">{streak}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">day streak</div></div></div>
}
