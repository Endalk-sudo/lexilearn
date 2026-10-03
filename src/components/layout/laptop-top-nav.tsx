'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen, BrainCircuit, ChevronRight, Compass,
  Ear, Flame, GraduationCap, Keyboard, Layers, PanelLeftClose, PanelLeftOpen, Search,
  Sparkles, Volume2, VolumeX,
} from 'lucide-react'
import { useAppStore, VIEW_TITLES, type ViewName } from '@/lib/store'
import { api, type DashboardStats } from '@/lib/api'
import { isSoundEnabled, playSound, toggleSound, useSoundState } from '@/lib/feel'
import { cn } from '@/lib/utils'
import { isTypingTarget } from '@/hooks/use-shortcuts'

export function LaptopTopNav() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const soundOn = useSoundState()

  useEffect(() => {
    let live = true
    const pull = () => {
      api.getDashboardStats().then((s) => {
        if (live) setStats(s)
      }).catch(() => {})
    }
    pull()
    const id = setInterval(pull, 30000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [view])

  // Keyboard Escape navigation: exit focus mode first, then go back to the
  // parent view. Focus mode wins while active — it is the modal-looking mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTypingTarget(e.target)) return
        const s = useAppStore.getState()
        if (s.focusMode) {
          s.setFocusMode(false)
          return
        }
        if (view === 'library-deck') {
          navigate('library', { libraryTab: 'decks' })
        } else if (view === 'dictation') {
          navigate('library')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, navigate])

  const QUICK_MODES: { view: ViewName; label: string; icon: React.ElementType; count?: number }[] = [
    { view: 'review', label: 'Review', icon: BrainCircuit, count: stats?.dueCount },
    { view: 'learn', label: 'Learn', icon: GraduationCap, count: stats?.newCount },
    { view: 'dictation', label: 'Dictate', icon: Ear },
    { view: 'deck', label: 'Deck', icon: Layers },
    { view: 'library', label: 'Library', icon: BookOpen },
    { view: 'coach', label: 'Coach', icon: Sparkles },
  ]

  return (
    <header
      data-focus-chrome="topbar"
      suppressHydrationWarning
      className="sticky top-0 z-20 hidden md:flex h-14 w-full items-center justify-between border-b border-border/70 bg-background/85 px-6 backdrop-blur-xl transition-[border-color,background-color] duration-200"
    >
      {/* Sidebar toggle & Breadcrumb Hierarchy */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <div className="h-4 w-px bg-border/60" />
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => navigate('today')}
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground cursor-pointer font-medium"
          >
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>Home</span>
          </button>

        {view !== 'today' ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            {view === 'library-deck' ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate('library', { libraryTab: 'decks' })}
                  className="text-muted-foreground transition-colors hover:text-foreground cursor-pointer font-medium"
                >
                  Library
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-44">
                  Deck
                </span>
                <kbd className="ml-1 rounded-md border border-white/60 dark:border-white/10 bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-neu-sm">
                  Esc to exit
                </kbd>
              </>
            ) : (
              <span className="font-semibold text-foreground">
                {VIEW_TITLES[view]}
              </span>
            )}
          </>
        ) : null}
      </nav>
      </div>

      {/* Quick Mode Switcher & Tools */}
      <div className="flex items-center gap-2.5">
        <div className="surface-inset flex items-center rounded-xl border border-border/50 p-1 shadow-neu-inset-sm">
          {QUICK_MODES.map((mode) => {
            const Icon = mode.icon
            const active = view === mode.view || (mode.view === 'library' && view === 'library-deck')
            return (
              <button
                key={mode.view}
                type="button"
                onClick={() => {
                  playSound('tap')
                  navigate(mode.view)
                }}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                  active
                    ? 'bg-card text-primary shadow-neu-sm border border-white/60 dark:border-white/10'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={`Switch to ${mode.label}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{mode.label}</span>
                {mode.count && mode.count > 0 && !active ? (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-bold text-primary num shadow-2xs">
                    {mode.count > 99 ? '99+' : mode.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Global Search shortcut button */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8.5 items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-semibold text-muted-foreground hover:border-primary-line/60 hover:text-foreground hover:shadow-neu active:shadow-neu-pressed transition-all cursor-pointer shadow-neu-sm"
          title="Search words (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px] text-muted-foreground">⌘K</span>
        </button>

        {/* Keyboard Shortcuts cheat sheet button */}
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="flex h-8.5 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-semibold text-muted-foreground hover:border-primary-line/60 hover:text-foreground hover:shadow-neu active:shadow-neu-pressed transition-all cursor-pointer shadow-neu-sm"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px] text-muted-foreground">?</span>
        </button>

        {/* Live Streak indicator */}
        {stats?.streak ? (
          <div className="flex h-8.5 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-streak shadow-neu-sm">
            <Flame className="h-3.5 w-3.5 fill-current" />
            <span className="num">{stats.streak}d</span>
          </div>
        ) : null}

        {/* Quick sound toggle */}
        <button
          type="button"
          onClick={() => toggleSound()}
          className={cn(
            'flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-border/70 bg-card text-xs transition-all cursor-pointer shadow-neu-sm hover:shadow-neu active:shadow-neu-pressed',
            soundOn ? 'text-primary hover:border-primary-line' : 'text-muted-foreground hover:text-foreground'
          )}
          title={soundOn ? 'Sound on (press m to toggle)' : 'Muted (press m to toggle)'}
          aria-label="Toggle sound"
        >
          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>
    </header>
  )
}
