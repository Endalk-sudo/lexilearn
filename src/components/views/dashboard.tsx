'use client'

import { useEffect, useState } from 'react'
import { api, type DashboardStats } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame, Target, Trophy, BookOpen, BrainCircuit, Zap, TrendingUp, Calendar, ChevronRight, Sparkles, CircleCheck, Swords, ShieldCheck, Check, LockKeyhole } from 'lucide-react'
import { motion } from 'framer-motion'
import { ContributionCalendar } from '@/components/contribution-calendar'
import { QuickStartCard } from '@/components/quick-start-card'
import { TtsNotice } from '@/components/tts-notice'
import { getDailyChallenge } from '@/lib/gamification'
import { StreakBadge } from '@/components/reward-celebration'
import { toast } from 'sonner'

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useAppStore((s) => s.navigate)

  const refresh = async () => {
    try { setStats(await api.getDashboardStats()) } catch (e) { console.error(e) }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try { const s = await api.getDashboardStats(); if (mounted) setStats(s) }
      catch (e) { console.error(e) }
      finally { if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  if (loading || !stats) return <DashboardSkeleton />

  const todayPct = Math.min(100, Math.round((stats.learnedToday / Math.max(1, stats.dailyGoal)) * 100))
  const goalDone = stats.learnedToday >= stats.dailyGoal
  const challenge = getDailyChallenge(stats)
  const challengeDone = challenge.progress >= challenge.target
  const challengeClaimed = stats.challengeClaimedDate === new Date().toISOString().slice(0, 10)
  const missionType = stats.dueCount > 0 ? 'review' : stats.newCount > 0 ? 'learn' : 'quiz'
  const missionLabel = stats.dueCount > 0 ? `Clear ${stats.dueCount} review${stats.dueCount === 1 ? '' : 's'} today` : stats.newCount > 0 ? `Learn ${Math.min(stats.dailyGoal, stats.newCount)} new words` : 'Keep your streak alive with a quiz'

  const claimChallenge = async () => {
    try {
      const result = await api.claimChallenge(challenge.key)
      if (result.xpAwarded) toast.success(`+${result.xpAwarded} bonus XP! Challenge complete 🎉`)
      await refresh()
    } catch (e: any) { toast.error(e?.message ?? 'Finish the challenge first') }
  }

  const repair = async () => {
    try {
      const result = await api.repairStreak()
      toast.success(`Streak saved at ${result.streak} days 🔥`)
      await refresh()
    } catch (e: any) { toast.error(e?.message ?? 'Could not repair streak') }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Your next move</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Ready for a <span className="text-primary">quick win</span>?</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{missionLabel}. A focused 5–10 minute session is enough to move your vocabulary forward.</p>
        </div>
        <StreakBadge streak={stats.streak} />
      </motion.div>

      <TtsNotice />
      {stats.totalReviews === 0 && <QuickStartCard />}

      {stats.streakShieldAvailable && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="game-panel rounded-3xl border-primary/20 bg-primary/[.045]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3"><div className="rounded-2xl bg-primary/12 p-2.5 text-primary"><ShieldCheck className="h-5 w-5" /></div><div><div className="font-bold">Your {stats.streak}-day streak is waiting.</div><p className="mt-1 text-sm text-muted-foreground">You missed {Math.max(1, stats.streakGap - 1)} day{Math.max(1, stats.streakGap - 1) === 1 ? '' : 's'}. Use your streak shield once to keep your run alive.</p></div></div>
            <Button variant="outline" className="rounded-xl" onClick={repair}>Save my streak</Button>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.22fr_.78fr]">
        <motion.div whileHover={{ y: -2 }} className="game-panel game-hover rounded-3xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today&apos;s mission</div><h2 className="mt-2 text-2xl font-black tracking-tight">{goalDone ? 'Mission complete ✨' : 'Build today&apos;s momentum'}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{goalDone ? 'You hit the goal. Everything else is bonus XP.' : `${Math.max(0, stats.dailyGoal - stats.learnedToday)} more to hit your daily target.`}</p></div>
              <div className="rounded-2xl bg-primary/12 p-3 text-primary"><Target className="h-6 w-6" /></div>
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="text-4xl font-black tabular-nums">{stats.learnedToday}<span className="text-lg text-muted-foreground">/{stats.dailyGoal}</span></div><div className="mt-1 text-xs text-muted-foreground">words practiced today</div></div>
              <Button size="lg" className="rounded-xl pressable" onClick={() => navigate(missionType)}>{stats.dueCount > 0 ? 'Start review' : stats.newCount > 0 ? 'Learn new words' : 'Play a quiz'}<ChevronRight className="ml-1.5 h-4 w-4" /></Button>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${todayPct}%` }} transition={{ duration: .7 }} className="h-full rounded-full bg-primary" /></div>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="game-panel game-hover rounded-3xl border-primary/20">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wider text-primary">Daily challenge</div><h3 className="mt-1 text-xl font-black">{challenge.title}</h3></div><div className="rounded-2xl bg-primary/12 p-3 text-primary">{challenge.icon === 'brain' ? <BrainCircuit className="h-5 w-5" /> : challenge.icon === 'flame' ? <Flame className="h-5 w-5" /> : <Target className="h-5 w-5" />}</div></div>
            <p className="mt-2 text-sm text-muted-foreground">{challenge.description}</p>
            <div className="mt-5 flex items-end justify-between"><div className="text-2xl font-black">{challenge.progress}<span className="text-sm text-muted-foreground">/{challenge.target}</span></div><div className="text-sm font-bold text-primary">+{challenge.reward} XP</div></div>
            <Progress value={(challenge.progress / challenge.target) * 100} className="mt-3 h-2.5" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{challengeDone && !challengeClaimed ? <><div className="flex items-center gap-2 text-xs font-medium text-emerald-600"><Check className="h-4 w-4" /> Challenge ready to claim</div><Button size="sm" className="rounded-xl" onClick={claimChallenge}>Claim +{challenge.reward} XP</Button></> : challengeClaimed ? <div className="flex items-center gap-2 text-xs font-medium text-emerald-600"><Check className="h-4 w-4" /> Reward claimed today</div> : <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Zap className="h-4 w-4" /> Finish it today for the bonus</div>}</div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ActionCard icon={BrainCircuit} label="Due reviews" value={stats.dueCount} color="text-orange-500" onClick={() => navigate('review')} cta="Review" />
        <ActionCard icon={BookOpen} label="New words" value={stats.newCount} color="text-emerald-500" onClick={() => navigate('learn')} cta="Learn" />
        <ActionCard icon={Trophy} label="Total XP" value={stats.totalXp} color="text-amber-500" onClick={() => navigate('stats')} cta="Progress" />
        <ActionCard icon={Swords} label="Quiz accuracy" value={stats.accuracy ? `${stats.accuracy}%` : '—'} color="text-sky-500" onClick={() => navigate('quiz')} cta="Play" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="game-panel lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-500" /> Level {stats.level.name}</CardTitle><CardDescription>{stats.nextLevel ? `${stats.nextLevel.minXp - stats.totalXp} XP until ${stats.nextLevel.name}` : 'You have reached Master.'}</CardDescription></CardHeader><CardContent><Progress value={stats.levelPct} className="h-3" /><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{stats.totalXp} XP</span><span>{stats.levelPct}%</span></div></CardContent></Card>
        <Card className="game-panel"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleCheck className="h-4 w-4 text-emerald-500" /> Your library</CardTitle></CardHeader><CardContent><div className="text-3xl font-black">{stats.totalWords}</div><div className="mt-1 text-xs text-muted-foreground">words in your collection</div><Button variant="outline" className="mt-4 w-full rounded-xl" onClick={() => navigate('decks')}>Browse decks <ChevronRight className="ml-auto h-4 w-4" /></Button></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="game-panel lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-amber-500" /> Consistency</CardTitle><CardDescription>Every square is a day you showed up.</CardDescription></CardHeader><CardContent><ContributionCalendar data={stats.heatmap} /></CardContent></Card>
        <Card className="game-panel"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-primary" /> Your progress</CardTitle><CardDescription>Keep the loop simple: learn → review → test.</CardDescription></CardHeader><CardContent className="space-y-3"><StatusRow label="Mastered" count={stats.masteredCount} total={stats.totalWords} color="bg-emerald-500" /><StatusRow label="Reviewing" count={stats.reviewingCount} total={stats.totalWords} color="bg-sky-500" /><StatusRow label="Learning" count={stats.learningCount} total={stats.totalWords} color="bg-amber-500" /><StatusRow label="New" count={stats.newCount} total={stats.totalWords} color="bg-muted-foreground" /></CardContent></Card>
      </div>

      <Card className="game-panel"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-emerald-500" /> Coming up</CardTitle><CardDescription>Upcoming reviews over the next 7 days.</CardDescription></CardHeader><CardContent><div className="space-y-1.5">{stats.nextReviewForecast.map((f, i) => { const d = new Date(f.date + 'T00:00:00'); const max = Math.max(1, ...stats.nextReviewForecast.map((x) => x.count)); const w = (f.count / max) * 100; return <div key={i} className="flex items-center gap-2 text-xs"><div className="w-16 text-muted-foreground">{i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })}</div><div className="h-7 flex-1 overflow-hidden rounded-lg bg-muted"><div className="flex h-full items-center justify-end bg-primary/80 pr-2 text-[10px] font-semibold text-primary-foreground" style={{ width: `${Math.max(8, w)}%` }}>{f.count > 0 ? f.count : ''}</div></div></div> })}</div></CardContent></Card>
    </div>
  )
}

function DashboardSkeleton() { return <div className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div><div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64 w-full" /></div> }

function ActionCard({ icon: Icon, label, value, color, cta, onClick }: { icon: React.ElementType; label: string; value: number | string; color: string; cta: string; onClick: () => void }) {
  return <motion.button whileHover={{ y: -2 }} whileTap={{ scale: .98 }} onClick={onClick} className="game-panel rounded-2xl p-4 text-left transition-colors hover:border-primary/25"><div className="flex items-center justify-between"><Icon className={`h-5 w-5 ${color}`} /><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><div className="mt-4 text-2xl font-black tabular-nums">{value}</div><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-primary">{cta}</div></motion.button>
}

function StatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) { const pct = total ? Math.round((count / total) * 100) : 0; return <div><div className="mb-1 flex justify-between text-xs"><span className="font-medium">{label}</span><span className="text-muted-foreground">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div></div> }
