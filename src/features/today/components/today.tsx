'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, BrainCircuit, ChevronRight, CircleCheck, Compass, Ear, Flame, Layers,
  MessageCircle, Play, ShieldCheck, Sparkles, Target, Trophy, Zap,
} from 'lucide-react'
import { api, type DashboardStats } from '@/lib/api'
import { dayKey } from '@/lib/date'
import { useAppStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'
import { isTypingTarget } from '@/hooks/use-shortcuts'

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
  const [loadFailed, setLoadFailed] = useState(false)
  const [resume] = useState<ResumeState | null>(() => getResume())
  const navigate = useAppStore((s) => s.navigate)
  const setDictationDeckId = useAppStore((s) => s.setDictationDeckId)
  const { v, t } = useMotionSafe()

  const load = useCallback(async () => {
    try {
      setStats(await api.getDashboardStats())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const s = await api.getDashboardStats()
        if (live) setStats(s)
      } catch {
        if (live) setLoadFailed(true)
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const goal = stats ? Math.max(1, stats.dailyGoal) : 1
  const goalPct = stats ? Math.min(100, Math.round((stats.learnedToday / goal) * 100)) : 0
  const goalDone = stats ? stats.learnedToday >= goal : false
  const challenge = stats ? getDailyChallenge(stats) : null
  const challengeDone = challenge ? challenge.progress >= challenge.target : false
  const challengeClaimed = stats ? stats.challengeClaimedDate === dayKey(new Date()) : false
  const levelPct = stats ? (stats.nextLevel ? Math.round(stats.levelPct) : 100) : 100

  const mission =
    stats && stats.dueCount > 0
      ? {
          view: 'review' as const,
          label: `Clear ${stats.dueCount} due card${stats.dueCount === 1 ? '' : 's'}`,
          cta: `Review ${stats.dueCount}`,
          hint: 'These are on the edge of forgetting. Clearing them is the highest-value five minutes you have.',
        }
      : stats && stats.newCount > 0
        ? {
            view: 'learn' as const,
            label: `Learn ${Math.min(goal, stats.newCount)} new words`,
            cta: 'Learn new words',
            hint: 'Short daily loops beat weekend cramming. This one takes about five minutes.',
          }
        : {
            view: 'dictation' as const,
            label: 'Nothing is due',
            cta: 'Practice dictation',
            hint: 'Your queue is empty. A quick dictation session keeps the streak and the memory warm.',
          }

  const claimChallenge = async () => {
    if (!challenge) return
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

  const startMission = useCallback(() => {
    playSound('tap')
    buzz('light')
    if (resume && resume.view !== mission.view) clearResume()
    navigate(mission.view)
  }, [mission.view, navigate, resume])

  const goResume = useCallback(() => {
    if (!resume) return
    playSound('tap')
    navigate(resume.view)
  }, [navigate, resume])

  useEffect(() => {
    if (loading || !stats) return

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        startMission()
        return
      }

      if (e.key.toLowerCase() === 'r' && resume) {
        e.preventDefault()
        goResume()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goResume, loading, resume, startMission, stats])

  if (loading) return <TodaySkeleton />
  if (!stats || loadFailed)
    return (
      <EmptyState
        icon={Sparkles}
        title="Couldn't load your dashboard"
        hint="Check your connection, then try again."
        actionLabel="Retry"
        onAction={() => {
          setLoading(true)
          void load().finally(() => setLoading(false))
        }}
      />
    )
  if (!challenge) return <TodaySkeleton />

  return (
    <motion.div
      variants={v(stagger(0.05))}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl space-y-6"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Primary Mission + Resume + Secondary routes */}
        <div className="space-y-5 lg:col-span-7">
          {/* 1. The single primary action for this screen */}
          <motion.section variants={v(listItem)} transition={t()} className="surface rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
            <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <ProgressRing
                value={goalPct}
                label={goalDone ? 'Daily goal reached' : `${stats.learnedToday} of ${goal} words today`}
                sublabel={
                  goalDone
                    ? 'Anything else today is pure bonus.'
                    : `${Math.max(0, goal - stats.learnedToday)} to go — about a minute each.`
                }
              />
              <Button
                size="lg"
                onClick={startMission}
                className="w-full shrink-0 sm:w-auto shadow-neu-primary active:shadow-neu-pressed font-medium cursor-pointer gap-2 rounded-xl"
              >
                <span>{mission.cta}</span>
                <kbd className="hidden sm:inline-flex rounded-md border border-primary-foreground/30 bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground">
                  Space
                </kbd>
                <ChevronRight className="h-4 w-4 ml-0.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border/60 bg-muted/20 p-3 surface-inset">
              <StatTile
                icon={BrainCircuit}
                label="Due"
                value={stats.dueCount}
                tone="primary"
                hint={stats.dueCount > 0 ? 'Ready for SRS' : 'Queue clear'}
                onClick={() => navigate('review')}
                className="border-0 bg-transparent shadow-none"
              />
              <StatTile
                icon={BookOpen}
                label="New"
                value={stats.newCount}
                hint={stats.newCount > 0 ? 'Waiting to learn' : 'All introduced'}
                onClick={() => navigate('learn')}
                className="border-0 bg-transparent shadow-none"
              />
              <StatTile
                icon={Flame}
                label="Streak"
                value={stats.streak}
                suffix="d"
                tone="streak"
                hint={stats.streak > 0 ? 'Habit burning' : 'Start today'}
                onClick={() => navigate('progress')}
                className="border-0 bg-transparent shadow-none"
              />
            </div>
          </motion.section>

          {/* 2. Resume - only when there is something to resume */}
          {resume ? (
            <motion.div variants={v(listItem)} transition={t()}>
              <Pressable onTap={goResume} className="surface lift w-full p-4 rounded-2xl" ariaLabel={`Resume ${resume.label}`}>
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-neu-primary" aria-hidden="true">
                    <Play className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="label block text-primary">Pick up where you left off</span>
                    <span className="mt-0.5 block truncate text-sm font-medium">
                      {resume.label} · {resume.detail}
                    </span>
                  </span>
                  <kbd className="hidden sm:inline-flex rounded-lg border border-border bg-card shadow-neu-sm px-2 py-0.5 font-mono text-[10px] text-muted-foreground mr-1">
                    R
                  </kbd>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </span>
              </Pressable>
            </motion.div>
          ) : null}

          {/* Quick Practice Docks */}
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
            <motion.section variants={v(listItem)} transition={t()} className="grid gap-2.5 sm:grid-cols-2">
              <QuietLink icon={Ear} label="Dictation" hint="Hear it, type it" onClick={() => { setDictationDeckId(null); navigate('dictation') }} />
              <QuietLink icon={Layers} label="Study deck" hint="Recall → listen → spell, by deck" onClick={() => navigate('deck')} />
              <QuietLink icon={BookOpen} label="Dictionary" hint="Search & explore words" onClick={() => navigate('library', { libraryTab: 'dictionary' })} />
              <QuietLink icon={Trophy} label="Progress" hint={`${stats.masteredCount} words mastered`} onClick={() => navigate('progress')} />
              <QuietLink icon={MessageCircle} label="AI Coach" hint="Fix mistakes, speak" onClick={() => navigate('coach')} />
            </motion.section>
          )}
        </div>

        {/* Right Column: Level Momentum + Daily Challenge + Streak Shield */}
        <div className="space-y-5 lg:col-span-5">
          {/* 3. Momentum: level + challenge */}
          <motion.section variants={v(listItem)} transition={t()} className="surface rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-card shadow-neu-sm text-primary">
                  <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                </span>
                <div>
                  <span className="truncate text-sm font-semibold block leading-none">{stats.level.name}</span>
                  <span className="text-[11px] text-muted-foreground mt-1 block">Rank & Milestone</span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-primary num bg-card shadow-neu-sm px-3 py-1 rounded-full">
                {stats.totalXp} XP
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full surface-inset shadow-neu-inset-sm p-0.5" role="progressbar" aria-label="Level progress" aria-valuenow={levelPct} aria-valuemin={0} aria-valuemax={100}>
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${levelPct}%` }}
                transition={t({ duration: 0.6, ease: [0.16, 1, 0.3, 1] })}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{stats.nextLevel ? `${stats.nextLevel.minXp - stats.totalXp} XP to ${stats.nextLevel.name}` : 'Top level reached — impressive.'}</span>
              <span className="num font-medium">{levelPct}%</span>
            </div>

            <div className="mt-6 border-t border-border/60 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-card shadow-neu-sm text-amber-600 dark:text-amber-400">
                    <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold">{challenge.title}</div>
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full shadow-neu-sm border-amber-500/30 text-amber-600 dark:text-amber-400">
                        +{challenge.reward} XP
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{challenge.description}</p>
                  </div>
                </div>
                {challengeDone ? <CircleCheck className="h-5 w-5 shrink-0 text-success animate-in zoom-in-50 duration-200" aria-hidden="true" /> : null}
              </div>
              <div className="mt-3.5 h-3 overflow-hidden rounded-full surface-inset shadow-neu-inset-sm p-0.5" role="progressbar" aria-label="Challenge progress" aria-valuenow={challenge.progress} aria-valuemin={0} aria-valuemax={challenge.target}>
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-colors',
                    challengeDone ? 'bg-success' : 'bg-primary'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                  transition={t({ duration: 0.6, ease: [0.16, 1, 0.3, 1] })}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground font-medium num">
                  {challenge.progress} / {challenge.target} completed
                </span>
                <Button
                  size="sm"
                  variant={challengeDone && !challengeClaimed ? 'default' : 'outline'}
                  disabled={!challengeDone || challengeClaimed}
                  onClick={claimChallenge}
                  className={cn(
                    'cursor-pointer transition-all rounded-xl',
                    challengeDone && !challengeClaimed && 'shadow-neu-primary active:shadow-neu-pressed'
                  )}
                >
                  {challengeClaimed ? 'Claimed today' : challengeDone ? `Claim +${challenge.reward} XP` : 'In progress'}
                </Button>
              </div>
            </div>

            {stats.streakShieldAvailable ? (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl surface-inset p-4 border-none">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Streak shield available</div>
                    <p className="text-xs text-muted-foreground">Protect your {stats.streak}-day streak.</p>
                  </div>
                </div>
                <Button size="sm" variant="soft" onClick={repairStreak} className="shrink-0 rounded-xl shadow-neu-sm active:shadow-neu-pressed">
                  Use shield
                </Button>
              </div>
            ) : null}
          </motion.section>
        </div>
      </div>
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
      className="surface lift flex min-h-12 items-center gap-3.5 p-4 rounded-2xl text-left transition-all duration-150 group cursor-pointer active:shadow-neu-pressed"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card shadow-neu-sm text-muted-foreground group-hover:text-primary transition-all">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
