'use client'

// recharts lives behind this module boundary so the charting library (~150 KB
// of d3 scales and layout code) loads only when Progress renders — never on
// first paint. The pie legend and grade bars in progress.tsx stay inline
// because they are plain HTML.

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

export type WeeklyDatum = { day: string; correct: number; incorrect: number }
export type PieDatum = { name: string; value: number }

const TOOLTIP_STYLE = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: 12,
  color: 'var(--popover-foreground)',
} as const

export function WeeklyChart({ data }: { data: WeeklyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="correct" name="Correct" stackId="a" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="incorrect" name="Missed" stackId="a" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StatusPie({ data, tokens }: { data: PieDatum[]; tokens: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        {/* rootTabIndex={-1}: the chart is decorative (the legend list conveys
            the data) and lives inside aria-hidden, so its series layer must not
            be keyboard-focusable. */}
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={2} strokeWidth={0} rootTabIndex={-1}>
          {data.map((_, i) => (
            <Cell key={i} fill={tokens[i % tokens.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  )
}
