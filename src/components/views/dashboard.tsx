'use client'

import { useEffect, useState } from 'react'
import { api, type DashboardStats } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame, Target, Trophy, BookOpen, BrainCircuit, Zap, TrendingUp, Calendar, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { ContributionCalendar } from '@/components/contribution-calendar'
import { QuickStartCard } from '@/components/quick-start-card'
import { TtsNotice } from '@/components/tts-notice'

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const s = await api.getDashboardStats()
        if (mounted) {
          setStats(s)
          setLoading(false)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const todayPct = Math.min(100, Math.round((stats.learnedToday / Math.max(1, stats.dailyGoal)) * 100))

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Welcome back, <span className="text-primary">{stats.level.name}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {stats.dueCount > 0
            ? `You have ${stats.dueCount} card${stats.dueCount === 1 ? '' : 's'} due for review.`
            : stats.totalWords === 0
              ? 'Start by browsing the pre-built decks to learn your first words!'
              : 'No cards due right now — learn something new or take a quiz!'}
        </p>
      </motion.div>

      {/* TTS availability notice */}
      <TtsNotice />

      {/* Quick start for new users */}
      {stats.totalReviews === 0 && <QuickStartCard />}

      {/* Hero actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          icon={BrainCircuit}
          label="Due reviews"
          value={stats.dueCount}
          color="text-orange-500"
          onClick={() => navigate('review')}
          cta="Start review"
          disabled={stats.dueCount === 0}
        />
        <ActionCard
          icon={BookOpen}
          label="New words"
          value={stats.newCount}
          color="text-emerald-500"
          onClick={() => navigate('learn')}
          cta="Learn new"
          disabled={stats.newCount === 0}
        />
        <ActionCard
          icon={Target}
          label="Daily goal"
          value={`${stats.learnedToday}/${stats.dailyGoal}`}
          color="text-purple-500"
          onClick={() => navigate('learn')}
          cta="Continue"
        />
        <ActionCard
          icon={Flame}
          label="Day streak"
          value={stats.streak}
          color="text-rose-500"
          onClick={() => navigate('stats')}
          cta="View stats"
        />
      </div>

      {/* Daily progress bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-500" />
            Today&apos;s Goal Progress
          </CardTitle>
          <CardDescription>
            {stats.learnedToday >= stats.dailyGoal
              ? 'Daily goal reached — excellent work!'
              : `${stats.dailyGoal - stats.learnedToday} more review${stats.dailyGoal - stats.learnedToday === 1 ? '' : 's'} to hit your daily goal.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={todayPct} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{stats.learnedToday} done</span>
            <span>{todayPct}%</span>
          </div>
        </CardContent>
      </Card>

      {/* XP / Level */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Level · {stats.level.name}
            </CardTitle>
            <CardDescription>
              {stats.nextLevel
                ? `${stats.nextLevel.minXp - stats.totalXp} XP until ${stats.nextLevel.name}`
                : 'You have reached the highest level — Master!'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={stats.levelPct} className="h-3" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.totalXp} XP total</span>
              <span>{stats.levelPct}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate('quiz')}>
              Take a quiz <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate('decks')}>
              Browse decks <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate('settings')}>
              Settings <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contribution Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            Review Activity
          </CardTitle>
          <CardDescription>
            Each cell is one day. Hover to see review count and accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionCalendar data={stats.heatmap} />
        </CardContent>
      </Card>

      {/* Status overview + Forecast */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Card Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Mastered" count={stats.masteredCount} total={stats.totalWords} color="bg-emerald-500" />
            <StatusRow label="Reviewing" count={stats.reviewingCount} total={stats.totalWords} color="bg-sky-500" />
            <StatusRow label="Learning" count={stats.learningCount} total={stats.totalWords} color="bg-amber-500" />
            <StatusRow label="New" count={stats.newCount} total={stats.totalWords} color="bg-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Upcoming Reviews (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {stats.nextReviewForecast.map((f, i) => {
                const d = new Date(f.date + 'T00:00:00')
                const max = Math.max(1, ...stats.nextReviewForecast.map((x) => x.count))
                const w = (f.count / max) * 100
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-20 text-muted-foreground">
                      {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary/80 flex items-center justify-end pr-2 text-primary-foreground text-[10px] font-semibold"
                        style={{ width: `${Math.max(8, w)}%` }}
                      >
                        {f.count > 0 ? f.count : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ActionCard({
  icon: Icon,
  label,
  value,
  color,
  cta,
  onClick,
  disabled,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
  cta: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
          <div className={`rounded-lg bg-muted p-2 ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={onClick}
          disabled={disabled}
        >
          {cta}
        </Button>
      </CardContent>
    </Card>
  )
}

function StatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{count} / {total}</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
