'use client'

import { useAppStore, type ViewName } from '@/lib/store'
import { cn } from '@/lib/utils'
import { BookOpen, BrainCircuit, LayoutDashboard, Library, Settings, BarChart3, Search, PencilLine, ListChecks, Sparkles, Flame, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

const NAV: { label: string; view: ViewName; icon: React.ElementType; short: string }[] = [
  { label: 'Dashboard', short: 'Home', view: 'dashboard', icon: LayoutDashboard },
  { label: 'Learn', short: 'Learn', view: 'learn', icon: BookOpen },
  { label: 'Review', short: 'Review', view: 'review', icon: BrainCircuit },
  { label: 'Quiz', short: 'Quiz', view: 'quiz', icon: ListChecks },
  { label: 'Coach Lab', short: 'Coach', view: 'coach-lab', icon: Sparkles },
  { label: 'Decks', short: 'Decks', view: 'decks', icon: Library },
  { label: 'Stats', short: 'Stats', view: 'stats', icon: BarChart3 },
  { label: 'Settings', short: 'Settings', view: 'settings', icon: Settings },
]

export function Sidebar() {
  const { view, navigate, setView } = useAppStore()
  const [query, setQuery] = useState('')

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card/55 backdrop-blur-xl sticky top-0 h-screen">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-sm">
            L
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-foreground/80" />
          </div>
          <div>
            <div className="font-bold tracking-tight">LexiLearn</div>
            <div className="text-[10px] text-muted-foreground">Learn. Play. Remember.</div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3">
        <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) navigate('search', { query }) }} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search words…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 h-10 bg-background/80 rounded-xl" />
        </form>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = view === item.view
          return (
            <Button
              key={item.view}
              variant="ghost"
              size="sm"
              className={cn('relative w-full h-10 justify-start gap-3 px-3 rounded-xl font-medium pressable', isActive && 'bg-primary/12 text-primary hover:bg-primary/15')}
              onClick={() => setView(item.view)}
            >
              {isActive && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-primary" />}
              <Icon className="h-4 w-4" />
              {item.label}
              {item.view === 'review' && <span className="ml-auto text-[9px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">1–4</span>}
            </Button>
          )
        })}
      </nav>

      <div className="mx-3 mb-3 space-y-2">
        <button onClick={() => setView('mentor')} className="flex w-full items-center gap-2 rounded-2xl border bg-background/70 p-3 text-left transition-colors hover:border-primary/25 hover:bg-primary/[.03]">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Sparkles className="h-4 w-4" /></div>
          <div><div className="text-xs font-bold">AI Mentor</div><div className="text-[10px] text-muted-foreground">Practice, explain, speak</div></div>
        </button>
        <div className="rounded-2xl border bg-background/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium"><Flame className="h-3.5 w-3.5 text-orange-500" /> Build your streak</div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">A few focused minutes every day beats cramming.</p>
        </div>
      </div>

      <div className="px-4 py-4 border-t text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><PencilLine className="h-3 w-3" /><span>SM-2 spaced repetition</span></div>
        <div className="mt-1 flex items-center gap-1.5"><Zap className="h-3 w-3" /><span>100% local · No telemetry</span></div>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const { view, setView } = useAppStore()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/92 backdrop-blur-xl">
      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {[...NAV.slice(0, 4), NAV.find(item => item.view === 'coach-lab')!].map((item) => {
          const Icon = item.icon
          const isActive = view === item.view
          return (
            <button key={item.view} onClick={() => setView(item.view)} className={cn('flex min-w-0 flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-colors pressable', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>
              <Icon className="h-4 w-4" />
              <span>{item.short}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
