'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export type ContributionDay = {
  date: string // YYYY-MM-DD
  count: number
  correct: number
}

type Props = {
  data: ContributionDay[]
  /** Number of weeks to display. Defaults to 53 (full year). */
  weeks?: number
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * GitHub-style contribution calendar.
 * - Columns = weeks (oldest → newest, left → right)
 * - Rows = days of week (Sun at top)
 * - Month labels above the grid, only on the first week of a new month
 * - Weekday labels on the left (Mon/Wed/Fri only, to match GitHub)
 * - Hover any cell to see date + count + accuracy
 */
export function ContributionCalendar({ data, weeks = 53 }: Props) {
  const [hovered, setHovered] = useState<ContributionDay | null>(null)

  // Pad/truncate to exactly `weeks * 7` entries, aligned Sunday-first.
  const { grid, monthLabels, totalReviews, totalDays, longestStreak, currentStreak } = useMemo(() => {
    const padded: ContributionDay[] = [...data]
    while (padded.length < weeks * 7) {
      padded.unshift({ date: '', count: 0, correct: 0 })
    }

    // Group into weeks (columns)
    const cols: ContributionDay[][] = []
    for (let w = 0; w < weeks; w++) {
      cols.push(padded.slice(w * 7, (w + 1) * 7))
    }

    // Month labels: for each week column, check if its first non-empty day starts a new month
    const monthLabels: (string | null)[] = cols.map((week, w) => {
      const firstDay = week.find((d) => d.date)
      if (!firstDay) return null
      const d = new Date(firstDay.date + 'T00:00:00')
      const month = d.getMonth()
      // Show label if this is the first column, or the previous column's first day is in a different month
      if (w === 0) return MONTH_LABELS[month]
      const prevWeek = cols[w - 1]
      const prevFirst = prevWeek.find((d) => d.date)
      if (!prevFirst) return MONTH_LABELS[month]
      const prevD = new Date(prevFirst.date + 'T00:00:00')
      return prevD.getMonth() !== month ? MONTH_LABELS[month] : null
    })

    // Aggregate stats
    const real = padded.filter((d) => d.date)
    const totalReviews = real.reduce((s, d) => s + d.count, 0)
    const totalDays = real.filter((d) => d.count > 0).length

    // Compute streaks (consecutive days with count > 0, ending today or yesterday)
    let longest = 0
    let current = 0
    let run = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    let lastActiveWasYesterdayOrToday = false
    for (let i = real.length - 1; i >= 0; i--) {
      const d = real[i]
      if (d.count > 0) {
        run += 1
        if (d.date === todayStr || d.date === yesterdayStr) {
          lastActiveWasYesterdayOrToday = true
        }
      } else {
        if (run > longest) longest = run
        run = 0
      }
    }
    if (run > longest) longest = run
    // Current streak = run ending today or yesterday
    if (lastActiveWasYesterdayOrToday) {
      current = run
    }

    return {
      grid: cols,
      monthLabels,
      totalReviews,
      totalDays,
      longestStreak: longest,
      currentStreak: current,
    }
  }, [data, weeks])

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">
          {totalReviews.toLocaleString()} reviews
        </span>
        <span className="text-muted-foreground">
          in the last year
        </span>
        {currentStreak > 0 && (
          <span className="text-muted-foreground">
            · <span className="font-medium text-foreground">{currentStreak}-day</span> current streak
          </span>
        )}
        {longestStreak > 0 && (
          <span className="text-muted-foreground">
            · <span className="font-medium text-foreground">{longestStreak}-day</span> longest
          </span>
        )}
      </div>

      {/* Calendar grid (scrollable on small screens) */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* Month labels row */}
          <div className="flex gap-[3px] pl-8 text-xs text-muted-foreground">
            {monthLabels.map((m, i) => (
              <div key={i} className="w-[11px] sm:w-[13px] text-left" style={{ minWidth: m ? '28px' : '11px' }}>
                {m}
              </div>
            ))}
          </div>

          {/* Main grid: weekday labels + week columns */}
          <div className="flex gap-[3px]">
            {/* Weekday labels (Mon, Wed, Fri) */}
            <div className="flex flex-col gap-[3px] w-7 text-xs text-muted-foreground pr-1">
              {WEEKDAY_LABELS.map((wd, i) => (
                <div key={wd} className="h-[11px] sm:h-[13px] leading-[11px] sm:leading-[13px]">
                  {i === 1 || i === 3 || i === 5 ? wd : ''}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => {
                  const isFuture = day.date ? new Date(day.date + 'T00:00:00') > new Date(new Date().setHours(0, 0, 0, 0)) : false
                  const isHovered = hovered?.date === day.date && day.date !== ''
                  return (
                    <div
                      key={di}
                      className={cn(
                        'h-[11px] w-[11px] sm:h-[13px] sm:w-[13px] rounded-[2px] transition-all',
                        day.date === '' && 'opacity-0',
                        isFuture && 'opacity-30',
                        !isFuture && day.count === 0 && day.date !== '' && 'bg-muted',
                        !isHovered && 'hover:ring-1 hover:ring-foreground/30',
                        isHovered && 'ring-2 ring-foreground/60 scale-125 z-10',
                      )}
                      style={
                        day.count > 0 && !isFuture
                          ? { background: levelColor(day.count) }
                          : undefined
                      }
                      onMouseEnter={() => day.date && setHovered(day)}
                      onMouseLeave={() => setHovered(null)}
                      title={
                        day.date
                          ? `${formatDate(day.date)}: ${day.count} review${day.count === 1 ? '' : 's'}${
                              day.count > 0 ? ` · ${day.correct}/${day.count} correct` : ''
                            }`
                          : ''
                      }
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <div
            key={lvl}
            className="h-[11px] w-[11px] sm:h-[13px] sm:w-[13px] rounded-[2px]"
            style={{
              background: lvl === 0 ? 'var(--muted)' : levelColor([4, 10, 18, 30][lvl - 1]),
            }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Hover detail popover */}
      {hovered && hovered.date && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatDate(hovered.date)}</span>
          {': '}
          {hovered.count === 0 ? (
            'No reviews'
          ) : (
            <>
              <span className="font-medium text-foreground">{hovered.count}</span> review{hovered.count === 1 ? '' : 's'}
              {' · '}
              <span className="font-medium text-foreground">
                {Math.round((hovered.correct / hovered.count) * 100)}%
              </span>{' '}
              accuracy
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** 4 activity levels derived from the accent token, so themes re-skin for free. */
function levelColor(count: number): string {
  if (count <= 0) return 'var(--muted)'
  if (count < 4) return 'color-mix(in oklab, var(--primary) 25%, var(--muted))'
  if (count < 10) return 'color-mix(in oklab, var(--primary) 45%, var(--muted))'
  if (count < 20) return 'color-mix(in oklab, var(--primary) 70%, var(--muted))'
  return 'var(--primary)'
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
