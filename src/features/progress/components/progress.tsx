'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Activity, BellRing, Flame, Minus, Monitor, Moon, Plus, Save, Sparkles,
  Sun, Target, TrendingUp, Trash2, Trophy, Volume2, Zap,
} from 'lucide-react'
import { api, type Analytics, type Settings } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { PageHeader, SectionHeader } from '@/components/layout/page-header'
import { SegmentedControl } from '@/components/layout/segmented-control'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { StatTile } from '@/components/ui/stat-tile'
import { ContributionCalendar } from '@/features/progress/components/contribution-calendar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { useTheme } from 'next-themes'
import { getEnglishVoices, speak } from '@/lib/tts'
import {
  isHapticsEnabled, isSoundEnabled, playSound, setHapticsEnabled, setSoundEnabled,
} from '@/lib/feel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { listItem, stagger, useMotionSafe } from '@/lib/motion'

const GRADE_LABELS: Record<number, string> = { 0: 'Again', 3: 'Hard', 4: 'Good', 5: 'Easy' }
const PIE_TOKENS = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-5)']
const GRADE_TOKENS = ['var(--chart-4)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-1)']

export function ProgressView() {
  const progressTab = useAppStore((s) => s.progressTab)
  const setProgressTab = useAppStore((s) => s.setProgressTab)
  const { v, t } = useMotionSafe()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div variants={v(stagger(0.04))} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={v(listItem)} transition={t()}>
          <PageHeader
            eyebrow="Progress"
            icon={TrendingUp}
            title="What your memory has been doing"
            description="Numbers you can trust, because they come from your own reviews on this device."
          />
        </motion.div>
        <motion.div variants={v(listItem)} transition={t()}>
          <SegmentedControl
            ariaLabel="Progress sections"
            value={progressTab}
            onChange={setProgressTab}
            options={[
              { value: 'overview', label: 'Overview', icon: Activity },
              { value: 'settings', label: 'Settings', icon: BellRing },
            ]}
          />
        </motion.div>
        {progressTab === 'overview' ? <OverviewPanel /> : <SettingsPanel />}
      </motion.div>
    </div>
  )
}

function OverviewPanel() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const navigate = useAppStore((s) => s.navigate)
  const { v, t } = useMotionSafe()

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const analytics = await api.getAnalytics()
        if (live) setData(analytics)
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

  const pieData = useMemo(
    () =>
      data
        ? [
            { name: 'Mastered', value: data.masteredCount },
            { name: 'Reviewing', value: data.reviewingCount },
            { name: 'Learning', value: data.learningCount },
            { name: 'New', value: data.newCount },
          ].filter((d) => d.value > 0)
        : [],
    [data]
  )

  const weekly = useMemo(
    () =>
      data
        ? data.weeklyActivity.map((w) => ({
            day: new Date(w.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
            correct: w.correct,
            incorrect: Math.max(0, w.count - w.correct),
          }))
        : [],
    [data]
  )

  if (loading || !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  const masteredPct = data.totalWords ? Math.round((data.masteredCount / data.totalWords) * 100) : 0
  const gradeMax = Math.max(1, ...data.gradeDistribution.map((g) => g.count))
  const logs = showAllLogs ? data.recentLogs.slice(0, 50) : data.recentLogs.slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Flame} label="Current streak" value={data.streak} suffix="d" tone="streak" hint={`Best ever ${data.longestStreak} days`} />
        <StatTile icon={Target} label="Accuracy" value={data.accuracy} suffix="%" tone="success" hint={`${data.totalCorrect} of ${data.totalReviews} correct`} />
        <StatTile icon={Trophy} label="Mastered" value={data.masteredCount} hint={`${masteredPct}% of ${data.totalWords} words`} />
        <StatTile icon={Zap} label="Total XP" value={data.totalXp} tone="primary" hint={`${data.totalReviews} reviews logged`} />
      </div>

      {data.totalReviews === 0 ? (
        <NextStep
          title="Nothing to chart yet"
          hint="One session is enough to start seeing patterns here."
          actionLabel="Learn 5 words"
          onAction={() => navigate('learn')}
        />
      ) : null}

      <div className="surface p-5">
        <SectionHeader title="This week" description="Correct answers versus misses, per day." />
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: 12,
                  color: 'var(--popover-foreground)',
                }}
              />
              <Bar dataKey="correct" name="Correct" stackId="a" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="incorrect" name="Missed" stackId="a" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="surface p-5">
          <SectionHeader title="Word status" description="Where your vocabulary currently sits." />
          {pieData.length ? (
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={2} strokeWidth={0}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_TOKENS[i % PIE_TOKENS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.5rem',
                        fontSize: 12,
                        color: 'var(--popover-foreground)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2">
                {pieData.map((slice, i) => (
                  <li key={slice.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_TOKENS[i % PIE_TOKENS.length] }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                    <span className="font-medium num">{slice.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
          )}
        </div>

        <div className="surface p-5">
          <SectionHeader title="How you grade" description="Again through Easy, across all reviews." />
          {data.gradeDistribution.length ? (
            <ul className="mt-4 space-y-3">
              {data.gradeDistribution.map((grade, i) => (
                <li key={grade.grade}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-medium">{GRADE_LABELS[grade.grade] ?? `Grade ${grade.grade}`}</span>
                    <span className="text-muted-foreground num">{grade.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: GRADE_TOKENS[i % GRADE_TOKENS.length] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(grade.count / gradeMax) * 100}%` }}
                      transition={t({ duration: 0.5, ease: [0.16, 1, 0.3, 1] })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Grade a few reviews and this fills in.</p>
          )}
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader title="Consistency" description="Every square is a day you showed up." />
        <div className="mt-4">
          <ContributionCalendar data={data.heatmap} />
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader title="Per deck" description="How each deck is progressing." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Per-deck progress</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="label py-2 pr-4 text-muted-foreground">Deck</th>
                <th scope="col" className="label px-2 py-2 text-right text-muted-foreground">Total</th>
                <th scope="col" className="label px-2 py-2 text-right text-muted-foreground">Mastered</th>
                <th scope="col" className="label px-2 py-2 text-right text-muted-foreground">Active</th>
                <th scope="col" className="label px-2 py-2 text-right text-muted-foreground">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {data.perDeck.map((deck) => (
                <tr key={deck.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{deck.name}</td>
                  <td className="px-2 py-2.5 text-right num">{deck.total}</td>
                  <td className="px-2 py-2.5 text-right text-success num">{deck.mastered}</td>
                  <td className="px-2 py-2.5 text-right text-warning num">{deck.learning + deck.reviewing}</td>
                  <td className="px-2 py-2.5 text-right num">{deck.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader
          title="Recent activity"
          description={showAllLogs ? 'Latest 50 reviews' : 'Your last few answers'}
          actions={
            data.recentLogs.length > 8 ? (
              <Button variant="ghost" size="sm" onClick={() => setShowAllLogs((s) => !s)}>
                {showAllLogs ? 'Show less' : `Show all ${Math.min(50, data.recentLogs.length)}`}
              </Button>
            ) : null
          }
        />
        {data.recentLogs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No reviews yet — your first session will show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/60">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', log.isCorrect ? 'bg-success' : 'bg-destructive')}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">{log.word}</span>
                  <Badge variant="outline" className="shrink-0 capitalize">{log.mode}</Badge>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {GRADE_LABELS[log.grade] ?? log.grade}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState<Settings | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [saving, setSaving] = useState(false)
  const [sound, setSound] = useState(true)
  const [haptics, setHaptics] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const s = await api.getSettings()
        if (live) {
          setSettings(s)
          setSaved(s)
        }
      } catch {
        /* offline */
      }
    })()
    setSound(isSoundEnabled())
    setHaptics(isHapticsEnabled())
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setVoices(getEnglishVoices())
    const id = window.setTimeout(update, 100)
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = update
    return () => {
      window.clearTimeout(id)
      if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  const dirty = useMemo(
    () => !!settings && !!saved && JSON.stringify(settings) !== JSON.stringify(saved),
    [saved, settings]
  )

  const handleSave = useCallback(async () => {
    if (!settings) return
    setSaving(true)
    try {
      await api.updateSettings(settings)
      setSaved(settings)
      playSound('correct')
      toast.success('Preferences saved')
    } catch {
      toast.error('Could not save your preferences')
    } finally {
      setSaving(false)
    }
  }, [settings])

  if (!settings) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="surface p-5">
        <SectionHeader title="Voice" description="Pronunciation is generated by your device. Nothing is sent anywhere." />
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="tts-voice">Voice</Label>
            <Select
              value={settings.ttsVoice || 'default'}
              onValueChange={(value) => setSettings({ ...settings, ttsVoice: value === 'default' ? '' : value })}
            >
              <SelectTrigger id="tts-voice" className="mt-1.5 w-full">
                <SelectValue placeholder="System default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">System default</SelectItem>
                {voices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {voices.length === 0 ? (
              <p className="mt-1.5 text-xs text-warning">
                No English voices found. Your system may need them installed — try Firefox.
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="tts-rate">Speech rate — {settings.ttsRate.toFixed(1)}×</Label>
            <div className="mt-3 flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                aria-label="Slower"
                onClick={() => setSettings({ ...settings, ttsRate: Math.max(0.5, Number((settings.ttsRate - 0.1).toFixed(1))) })}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Slider
                id="tts-rate"
                min={0.5}
                max={2}
                step={0.1}
                value={[settings.ttsRate]}
                onValueChange={([value]) => setSettings({ ...settings, ttsRate: Number(value.toFixed(1)) })}
                className="flex-1"
                aria-label="Speech rate"
              />
              <Button
                size="icon"
                variant="outline"
                aria-label="Faster"
                onClick={() => setSettings({ ...settings, ttsRate: Math.min(2, Number((settings.ttsRate + 0.1).toFixed(1))) })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const ok = speak('A little practice every day beats a lot of practice once.', {
                voice: settings.ttsVoice,
                rate: settings.ttsRate,
              })
              if (!ok) toast.error('Pronunciation is unavailable in this browser.')
            }}
          >
            <Volume2 className="h-4 w-4" />
            Test this voice
          </Button>
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader title="Daily rhythm" description="Small and daily beats big and rare." />
        <div className="mt-4">
          <Label htmlFor="daily-goal">Words per day — {settings.dailyGoal}</Label>
          <Slider
            id="daily-goal"
            min={5}
            max={50}
            step={5}
            value={[settings.dailyGoal]}
            onValueChange={([value]) => setSettings({ ...settings, dailyGoal: value })}
            className="mt-3"
            aria-label="Daily goal"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>5 — light</span>
            <span>25 — steady</span>
            <span>50 — intense</span>
          </div>
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader title="Feel" description="Feedback you can switch off at any time." />
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3.5">
            <div className="min-w-0">
              <div className="text-sm font-medium">Sound</div>
              <div className="text-xs text-muted-foreground">A short chime when an answer is graded</div>
            </div>
            <Switch
              checked={sound}
              aria-label="Sound effects"
              onCheckedChange={(next) => {
                setSound(next)
                setSoundEnabled(next)
                if (next) playSound('correct')
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3.5">
            <div className="min-w-0">
              <div className="text-sm font-medium">Haptics</div>
              <div className="text-xs text-muted-foreground">Gentle vibration on tap (mobile only)</div>
            </div>
            <Switch
              checked={haptics}
              aria-label="Haptic feedback"
              onCheckedChange={(next) => {
                setHaptics(next)
                setHapticsEnabled(next)
              }}
            />
          </div>
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader title="Appearance" description="Match your system, or pick a mood." />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'system', label: 'System', icon: Monitor },
          ] as const).map((option) => {
            const Icon = option.icon
            const active = (theme ?? 'system') === option.value
            return (
              <Button
                key={option.value}
                variant={active ? 'soft' : 'outline'}
                aria-pressed={active}
                onClick={() => {
                  setTheme(option.value)
                  void api.updateSettings({ theme: option.value }).catch(() => {})
                }}
                className="h-auto flex-col gap-1.5 py-3.5"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-medium">{option.label}</span>
              </Button>
            )
          })}
        </div>
      </div>

      <div className="surface p-5">
        <SectionHeader title="Go deeper" description="Map your grammar and fluency with the coach." />
        <div className="mt-3">
          <GoToCoach />
        </div>
      </div>

      <div className="surface border-destructive/30 p-5">
        <SectionHeader title="Danger zone" description="These actions cannot be undone." />
        <div className="mt-4">
          <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="h-4 w-4" />
                Reset all progress
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This erases review history, XP, streaks and statistics. Your decks and words stay. Type
                  RESET to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
                aria-label="Type RESET to confirm"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText.trim().toUpperCase() !== 'RESET'}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  onClick={async () => {
                    try {
                      await api.resetProgress()
                      toast.success('Progress reset')
                      window.location.reload()
                    } catch {
                      toast.error('Reset failed')
                    }
                  }}
                >
                  Reset everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {dirty ? (
        <div className="sticky bottom-20 z-30 md:bottom-4">
          <div className="surface flex items-center justify-between gap-3 p-3 shadow-lg">
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => saved && setSettings(saved)} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GoToCoach() {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <Button variant="soft" onClick={() => navigate('coach')}>
      <Sparkles className="h-4 w-4" />
      Open the AI Coach
    </Button>
  )
}
