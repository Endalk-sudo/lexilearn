'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen, BrainCircuit, ChevronRight, Compass,
  Ear, Flame, GraduationCap, HelpCircle, Keyboard, Layers, PanelLeftClose, PanelLeftOpen, Search,
  Sparkles, Volume2, VolumeX,
} from 'lucide-react'
import { useAppStore, VIEW_TITLES, type ViewName } from '@/lib/store'
import { api, type DashboardStats } from '@/lib/api'
import { isSoundEnabled, playSound, toggleSound } from '@/lib/feel'
import { cn } from '@/lib/utils'

export function LaptopTopNav() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())

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

  useEffect(() => {
    const sync = () => setSoundOn(isSoundEnabled())
    window.addEventListener('lexilearn-feel', sync)
    return () => window.removeEventListener('lexilearn-feel', sync)
  }, [])

  // Keyboard Escape navigation: exit focus mode first, then go back to the
  // parent view. Focus mode wins while active — it is the modal-looking mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
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
    { view: 'quiz', label: 'Quiz', icon: HelpCircle },
    { view: 'dictation', label: 'Dictate', icon: Ear },
    { view: 'deck', label: 'Deck', icon: Layers },
    { view: 'library', label: 'Library', icon: BookOpen },
    { view: 'coach', label: 'Coach', icon: Sparkles },
  ]

  return (
    <header data-focus-chrome="topbar" className="sticky top-0 z-20 hidden md:flex h-14 w-full items-center justify-between border-b border-border/70 bg-background/85 px-6 backdrop-blur-xl transition-[border-color,background-color] duration-200">
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
                <kbd className="ml-1 rounded border border-border/70 bg-muted/60 px-1 py-0.2 font-mono text-[10px] text-muted-foreground">
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
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5 shadow-2xs">
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
                  'relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
                title={`Switch to ${mode.label}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{mode.label}</span>
                {mode.count && mode.count > 0 && !active ? (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-bold text-primary num">
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
          className="flex h-8 items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-2.5 text-xs text-muted-foreground hover:border-primary-line hover:text-foreground transition-colors cursor-pointer shadow-2xs"
          title="Search words (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          <kbd className="font-mono text-[10px]">⌘K</kbd>
        </button>

        {/* Keyboard Shortcuts cheat sheet button */}
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2 text-xs text-muted-foreground hover:border-primary-line hover:text-foreground transition-colors cursor-pointer shadow-2xs"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <kbd className="font-mono text-[10px]">?</kbd>
        </button>

        {/* Live Streak indicator */}
        {stats?.streak ? (
          <div className="flex h-8 items-center gap-1 rounded-lg border border-border/70 bg-card/60 px-2 text-xs font-semibold text-streak shadow-2xs">
            <Flame className="h-3.5 w-3.5 fill-current" />
            <span className="num">{stats.streak}d</span>
          </div>
        ) : null}

        {/* Quick sound toggle */}
        <button
          type="button"
          onClick={() => {
            const next = toggleSound()
            setSoundOn(next)
          }}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-xs transition-colors cursor-pointer shadow-2xs',
            soundOn ? 'text-primary hover:bg-primary-soft' : 'text-muted-foreground hover:bg-muted'
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
