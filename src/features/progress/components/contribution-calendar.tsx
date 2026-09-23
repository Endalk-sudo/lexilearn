'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { addDays, dayKey, parseDayKey, startOfDay } from '@/lib/date'

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

  // Rebuild the grid from dates, so the payload can be sparse (only active
  // days) without the layout depending on array position.
  const { grid, monthLabels, totalReviews, totalDays, longestStreak, currentStreak } = useMemo(() => {
    const byDate = new Map<string, ContributionDay>()
    for (const d of data) if (d.date) byDate.set(d.date, d)

    const today = startOfDay(new Date())
    const endOfGrid = addDays(today, 6 - today.getDay()) // upcoming Saturday
    const startOfGrid = addDays(endOfGrid, -(weeks * 7 - 1))
    const windowStart = dayKey(startOfGrid)
    const windowEnd = dayKey(endOfGrid)

    const padded: ContributionDay[] = []
    for (let i = 0; i < weeks * 7; i++) {
      const key = dayKey(addDays(startOfGrid, i))
      padded.push(byDate.get(key) ?? { date: key, count: 0, correct: 0 })
    }

    // Group into weeks (columns)
    const cols: ContributionDay[][] = []
    for (let w = 0; w < weeks; w++) {
      cols.push(padded.slice(w * 7, (w + 1) * 7))
    }

    // Month labels: a column gets a label when its first day starts a new month
    const monthLabels: (string | null)[] = cols.map((week, w) => {
      const month = parseDayKey(week[0].date).getMonth()
      if (w === 0) return MONTH_LABELS[month]
      return parseDayKey(cols[w - 1][0].date).getMonth() !== month ? MONTH_LABELS[month] : null
    })

    // Aggregate stats over days inside the visible window only.
    const inWindow = data.filter((d) => d.date && d.date >= windowStart && d.date <= windowEnd)
    const totalReviews = inWindow.reduce((s, d) => s + d.count, 0)
    const totalDays = inWindow.reduce((s, d) => s + (d.count > 0 ? 1 : 0), 0)

    // Streaks walk the calendar, so a quiet day always breaks the run even when
    // the payload only contains active days.
    const active = new Set(inWindow.filter((d) => d.count > 0).map((d) => d.date))
    let longest = 0
    for (const key of active) {
      if (active.has(dayKey(addDays(parseDayKey(key), -1)))) continue // not a run start
      let len = 1
      for (let d = addDays(parseDayKey(key), 1); active.has(dayKey(d)); d = addDays(d, 1)) len += 1
      if (len > longest) longest = len
    }
    const yesterday = addDays(today, -1)
    let cursor: Date | null = active.has(dayKey(today))
      ? today
      : active.has(dayKey(yesterday))
        ? yesterday
        : null
    let current = 0
    while (cursor && active.has(dayKey(cursor))) {
      current += 1
      cursor = addDays(cursor, -1)
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
        {totalDays > 0 && (
          <span className="text-muted-foreground">
            · active on <span className="font-medium text-foreground">{totalDays}</span> day{totalDays === 1 ? '' : 's'}
          </span>
        )}
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

      {/* Calendar grid (scrollable on small screens — focusable so keyboard
          users can scroll it, per WCAG 2.1.1 / axe scrollable-region-focusable) */}
      <div className="overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Contribution calendar">
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
                  const isFuture = parseDayKey(day.date) > startOfDay(new Date())
                  const isHovered = hovered?.date === day.date
                  return (
                    <div
                      key={di}
                      className={cn(
                        'h-[11px] w-[11px] sm:h-[13px] sm:w-[13px] rounded-[2px] transition-all',
                        isFuture && 'opacity-30',
                        !isFuture && day.count === 0 && 'bg-muted',
                        !isHovered && 'hover:ring-1 hover:ring-foreground/30',
                        isHovered && 'ring-2 ring-foreground/60 scale-125 z-10',
                      )}
                      style={
                        day.count > 0 && !isFuture
                          ? { background: levelColor(day.count) }
                          : undefined
                      }
                      onMouseEnter={() => setHovered(day)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${formatDate(day.date)}: ${day.count} review${day.count === 1 ? '' : 's'}${
                        day.count > 0 ? ` · ${day.correct}/${day.count} correct` : ''
                      }`}
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
