'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, BrainCircuit, ChevronRight, CircleCheck, Compass, Ear, Flame,
  Play, ShieldCheck, Sparkles, Target, Trophy, Zap,
} from 'lucide-react'
import { api, type DashboardStats } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from '@/components/ui/stat-tile'
import { ProgressRing } from '@/components/feedback/progress-ring'
import { Pressable } from '@/components/feedback/pressable'
import { EmptyState } from '@/components/feedback/empty-state'
import { TtsNotice } from '@/features/today/components/tts-notice'
import { getDailyChallenge } from '@/features/today/lib/gamification'
import { clearResume, getResume, type ResumeState } from '@/lib/resume'
import { buzz, playSound } from '@/lib/feel'
import { celebrate } from '@/components/feedback/confetti'
import { toast } from 'sonner'
import { listItem, stagger, useMotionSafe } from '@/lib/motion'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function TodayView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resume, setResume] = useState<ResumeState | null>(null)
  const navigate = useAppStore((s) => s.navigate)
  const setDictationDeckId = useAppStore((s) => s.setDictationDeckId)
  const { v, t } = useMotionSafe()

  const load = useCallback(async () => {
    try {
      setStats(await api.getDashboardStats())
    } catch {
      /* offline - keep the last known numbers */
    }
  }, [])

  useEffect(() => {
    let live = true
    setResume(getResume())
    ;(async () => {
      try {
        const s = await api.getDashboardStats()
        if (live) setStats(s)
      } catch {
        /* offline */
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  if (loading || !stats) return <TodaySkeleton />

  const goal = Math.max(1, stats.dailyGoal)
  const goalPct = Math.min(100, Math.round((stats.learnedToday / goal) * 100))
  const goalDone = stats.learnedToday >= goal
  const challenge = getDailyChallenge(stats)
  const challengeDone = challenge.progress >= challenge.target
  const challengeClaimed = stats.challengeClaimedDate === new Date().toISOString().slice(0, 10)
  const levelPct = stats.nextLevel ? Math.round(stats.levelPct) : 100

  const mission =
    stats.dueCount > 0
      ? {
          view: 'review' as const,
          label: `Clear ${stats.dueCount} due card${stats.dueCount === 1 ? '' : 's'}`,
          cta: `Review ${stats.dueCount}`,
          hint: 'These are on the edge of forgetting. Clearing them is the highest-value five minutes you have.',
        }
      : stats.newCount > 0
        ? {
            view: 'learn' as const,
            label: `Learn ${Math.min(goal, stats.newCount)} new words`,
            cta: 'Learn new words',
            hint: 'Short daily loops beat weekend cramming. This one takes about five minutes.',
          }
        : {
            view: 'quiz' as const,
            label: 'Nothing is due',
            cta: 'Play a quiz',
            hint: 'Your queue is empty. A quick quiz keeps the streak and the memory warm.',
          }

  const claimChallenge = async () => {
    try {
      const result = await api.claimChallenge(challenge.key)
      if (result.xpAwarded) {
        toast.success(`+${result.xpAwarded} bonus XP — challenge complete`)
        playSound('levelup')
        buzz('success')
        celebrate('challenge')
      }
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Finish the challenge first')
    }
  }

  const repairStreak = async () => {
    try {
      const result = await api.repairStreak()
      toast.success(`Streak saved at ${result.streak} days`)
      playSound('correct')
      celebrate('streak')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the streak')
    }
  }

  const startMission = () => {
    playSound('tap')
    buzz('light')
    if (resume && resume.view !== mission.view) clearResume()
    navigate(mission.view)
  }

  const goResume = () => {
    if (!resume) return
    playSound('tap')
    navigate(resume.view)
  }

  return (
    <motion.div
      variants={v(stagger(0.05))}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl space-y-6"
    >
      <motion.div variants={v(listItem)} transition={t()}>
        <PageHeader
          eyebrow="Today"
          icon={Compass}
          title={`${greeting()} — ${mission.label.toLowerCase()}`}
          description={mission.hint}
        />
      </motion.div>

      <TtsNotice />

      {/* 1. The single primary action for this screen */}
      <motion.section variants={v(listItem)} transition={t()} className="surface overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <ProgressRing
            value={goalPct}
            label={goalDone ? 'Daily goal reached' : `${stats.learnedToday} of ${goal} words today`}
            sublabel={
              goalDone
                ? 'Anything else today is pure bonus.'
                : `${Math.max(0, goal - stats.learnedToday)} to go — about a minute each.`
            }
          />
          <Button size="lg" onClick={startMission} className="w-full shrink-0 sm:w-auto">
            {mission.cta}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border bg-muted/30 p-3">
          <StatTile icon={BrainCircuit} label="Due" value={stats.dueCount} tone="primary" onClick={() => navigate('review')} className="border-0 bg-transparent shadow-none" />
          <StatTile icon={BookOpen} label="New" value={stats.newCount} onClick={() => navigate('learn')} className="border-0 bg-transparent shadow-none" />
          <StatTile icon={Flame} label="Streak" value={stats.streak} suffix="d" tone="streak" onClick={() => navigate('progress')} className="border-0 bg-transparent shadow-none" />
        </div>
      </motion.section>

      {/* 2. Resume - only when there is something to resume */}
      {resume ? (
        <motion.div variants={v(listItem)} transition={t()}>
          <Pressable onTap={goResume} className="surface lift w-full p-4" ariaLabel={`Resume ${resume.label}`}>
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-hidden="true">
                <Play className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label block text-primary">Pick up where you left off</span>
                <span className="mt-0.5 block truncate text-sm font-medium">
                  {resume.label} · {resume.detail}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </span>
          </Pressable>
        </motion.div>
      ) : null}

      {/* 3. Momentum: level + challenge in one card */}
      <motion.section variants={v(listItem)} transition={t()} className="surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate text-sm font-semibold">{stats.level.name}</span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground num">{stats.totalXp} XP</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Level progress" aria-valuenow={levelPct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${levelPct}%` }}
            transition={t({ duration: 0.6, ease: [0.16, 1, 0.3, 1] })}
          />
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {stats.nextLevel ? `${stats.nextLevel.minXp - stats.totalXp} XP to ${stats.nextLevel.name}` : 'Top level reached — impressive.'}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{challenge.title}</div>
                <p className="text-xs leading-relaxed text-muted-foreground">{challenge.description} · +{challenge.reward} XP</p>
              </div>
            </div>
            {challengeDone ? <CircleCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : null}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Challenge progress" aria-valuenow={challenge.progress} aria-valuemin={0} aria-valuemax={challenge.target}>
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
              transition={t({ duration: 0.6, ease: [0.16, 1, 0.3, 1] })}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground num">
              {challenge.progress}/{challenge.target}
            </span>
            <Button
              size="sm"
              variant={challengeDone && !challengeClaimed ? 'default' : 'outline'}
              disabled={!challengeDone || challengeClaimed}
              onClick={claimChallenge}
            >
              {challengeClaimed ? 'Claimed today' : challengeDone ? `Claim +${challenge.reward} XP` : 'In progress'}
            </Button>
          </div>
        </div>

        {stats.streakShieldAvailable ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-primary-line bg-primary-soft p-3">
            <div className="flex min-w-0 items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Streak shield available</div>
                <p className="text-xs text-muted-foreground">Use it once to protect your {stats.streak}-day run.</p>
              </div>
            </div>
            <Button size="sm" variant="soft" onClick={repairStreak} className="shrink-0">
              Use shield
            </Button>
          </div>
        ) : null}
      </motion.section>

      {/* 4. Secondary routes - quiet, never competing with the mission */}
      {stats.totalReviews === 0 ? (
        <motion.div variants={v(listItem)} transition={t()}>
          <EmptyState
            icon={Sparkles}
            title="Your first lesson takes five minutes"
            hint="Pick five words, recall them, spell them. Come back tomorrow and they will still be here."
            actionLabel="Learn 5 words"
            onAction={() => navigate('learn')}
          />
        </motion.div>
      ) : (
        <motion.section variants={v(listItem)} transition={t()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuietLink icon={Sparkles} label="Quick quiz" hint="Five modes, 60-second rush" onClick={() => navigate('quiz')} />
          <QuietLink icon={Ear} label="Dictation" hint="Hear it, type it" onClick={() => { setDictationDeckId(null); navigate('dictation') }} />
          <QuietLink icon={BookOpen} label="Dictionary" hint="Look up any word" onClick={() => navigate('library', { libraryTab: 'dictionary' })} />
          <QuietLink icon={Trophy} label="Progress" hint={`${stats.masteredCount} words mastered`} onClick={() => navigate('progress')} />
        </motion.section>
      )}
    </motion.div>
  )
}

function QuietLink({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ElementType
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface flex min-h-11 items-center gap-3 p-3.5 text-left transition-colors duration-150 hover:border-primary-line"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

function TodaySkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading today">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  )
}
