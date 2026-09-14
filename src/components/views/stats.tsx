'use client'

import { useEffect, useState } from 'react'
import { api, type Analytics } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Trophy, Flame, Target, Zap, TrendingUp, Brain, Award, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { ContributionCalendar } from '@/components/contribution-calendar'

const PIE_COLORS = ['oklch(0.72 0.16 86)', 'oklch(0.63 0.16 252)', 'oklch(0.68 0.15 150)', 'oklch(0.62 0.19 25)']
const GRADE_COLORS = ['oklch(0.58 0.24 28)', 'oklch(0.72 0.16 86)', 'oklch(0.68 0.15 150)', 'oklch(0.63 0.16 252)']
const GRADE_LABELS: Record<number, string> = { 0: 'Again', 3: 'Hard', 4: 'Good', 5: 'Easy' }

export function StatsView() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const a = await api.getAnalytics()
        if (mounted) {
          setData(a)
          setLoading(false)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const pieData = [
    { name: 'Mastered', value: data.masteredCount },
    { name: 'Reviewing', value: data.reviewingCount },
    { name: 'Learning', value: data.learningCount },
    { name: 'New', value: data.newCount },
  ].filter((d) => d.value > 0)

  const weeklyChart = data.weeklyActivity.map((w) => ({
    day: new Date(w.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
    correct: w.correct,
    incorrect: w.count - w.correct,
  }))

  const gradeChart = data.gradeDistribution.map((g) => ({
    name: GRADE_LABELS[g.grade] ?? `Grade ${g.grade}`,
    count: g.count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your learning journey at a glance.</p>
      </div>

      {/* Top KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Flame} label="Current Streak" value={`${data.streak} days`} color="text-rose-500" />
        <KpiCard icon={Trophy} label="Longest Streak" value={`${data.longestStreak} days`} color="text-amber-500" />
        <KpiCard icon={Target} label="Accuracy" value={`${data.accuracy}%`} color="text-emerald-500" />
        <KpiCard icon={Zap} label="Total XP" value={data.totalXp.toString()} color="text-yellow-500" />
      </div>

      {/* Full-year contribution calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            Review Activity — Last Year
          </CardTitle>
          <CardDescription>
            Each square is a day. Hover to see review count and accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionCalendar data={data.heatmap} />
        </CardContent>
      </Card>

      {/* Weekly activity chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Weekly Activity
          </CardTitle>
          <CardDescription>Reviews completed in the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="correct" stackId="a" fill="oklch(0.72 0.16 86)" name="Correct" />
                <Bar dataKey="incorrect" stackId="a" fill="oklch(0.58 0.24 28)" name="Incorrect" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card status pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-sky-500" />
              Card Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                      className="text-xs"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-500" />
              Grade Distribution
            </CardTitle>
            <CardDescription>How you&apos;ve rated your recalls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={70} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {gradeChart.map((_, i) => (
                      <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-deck table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Deck Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Deck</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 px-2 text-right">Mastered</th>
                  <th className="py-2 px-2 text-right">Learning</th>
                  <th className="py-2 px-2 text-right">New</th>
                  <th className="py-2 px-2 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {data.perDeck.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{d.name}</td>
                    <td className="py-2 px-2 text-right font-mono">{d.total}</td>
                    <td className="py-2 px-2 text-right font-mono text-emerald-600">{d.mastered}</td>
                    <td className="py-2 px-2 text-right font-mono text-amber-600">{d.learning + d.reviewing}</td>
                    <td className="py-2 px-2 text-right font-mono text-muted-foreground">{d.new}</td>
                    <td className="py-2 px-2 text-right font-mono">{d.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Reviews</CardTitle>
          <CardDescription>Last 100 review events</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No reviews yet. Start learning to see your history here.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1 pr-2 -mr-2">
              {data.recentLogs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${log.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-medium">{log.word}</span>
                    <Badge variant="outline" className="text-[9px] capitalize">{log.mode}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {GRADE_LABELS[log.grade] ?? `Grade ${log.grade}`} · {new Date(log.reviewedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
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
      </CardContent>
    </Card>
  )
}
