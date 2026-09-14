'use client'

import { useAppStore, type ViewName } from '@/lib/store'
import { cn } from '@/lib/utils'
import { BookOpen, BrainCircuit, LayoutDashboard, Library, Settings, BarChart3, Search, PencilLine, ListChecks, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

const NAV: { label: string; view: ViewName; icon: React.ElementType }[] = [
  { label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
  { label: 'Learn', view: 'learn', icon: BookOpen },
  { label: 'Review', view: 'review', icon: BrainCircuit },
  { label: 'Quiz', view: 'quiz', icon: ListChecks },
  { label: 'Mentor', view: 'mentor', icon: Sparkles },
  { label: 'Decks', view: 'decks', icon: Library },
  { label: 'Stats', view: 'stats', icon: BarChart3 },
  { label: 'Settings', view: 'settings', icon: Settings },
]

export function Sidebar() {
  const { view, navigate, setView } = useAppStore()
  const [query, setQuery] = useState('')

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-5 py-5 border-b">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          L
        </div>
        <div>
          <div className="font-semibold leading-none">LexiLearn</div>
          <div className="text-[10px] text-muted-foreground mt-1">Local · Offline · Private</div>
        </div>
      </div>

      <div className="px-3 py-3 border-b">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (query.trim()) navigate('search', { query })
          }}
          className="relative"
        >
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search words…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </form>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = view === item.view
          return (
            <Button
              key={item.view}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'w-full justify-start gap-2.5 font-medium',
                isActive && 'bg-secondary text-secondary-foreground'
              )}
              onClick={() => setView(item.view)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <PencilLine className="h-3 w-3" />
          <span>SM-2 Spaced Repetition</span>
        </div>
        <div className="mt-1">100% local SQLite · No telemetry</div>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const { view, setView } = useAppStore()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex gap-1 px-2 py-1.5 overflow-x-auto scrollbar-none">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = view === item.view
          return (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-md text-[10px] font-medium transition-colors shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
