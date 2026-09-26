'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  BookOpen, BrainCircuit, ChevronRight, Compass, Flame,
  GraduationCap, PanelLeftClose, PanelLeftOpen, Search, Sparkles, TrendingUp, Volume2, VolumeX, WifiOff,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { SearchPalette } from '@/components/search-palette'
import { ACCENT_THEMES, syncAccentHue, useAppStore, type ViewName } from '@/lib/store'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { isSoundEnabled, playSound, toggleSound } from '@/lib/feel'
import { useMotionSafe } from '@/lib/motion'
import { useCountUp } from '@/hooks/use-count-up'

/** The five flat destinations. Nothing else is ever a tab. */
export const PRIMARY_TABS: { view: ViewName; label: string; icon: React.ElementType }[] = [
  { view: 'today', label: 'Today', icon: Compass },
  { view: 'learn', label: 'Learn', icon: GraduationCap },
  { view: 'review', label: 'Review', icon: BrainCircuit },
  { view: 'library', label: 'Library', icon: BookOpen },
  { view: 'progress', label: 'Progress', icon: TrendingUp },
]

function useNavCounts() {
  const view = useAppStore((s) => s.view)
  const [counts, setCounts] = useState({ due: 0, fresh: 0, streak: 0 })
  useEffect(() => {
    let live = true
    const pull = () =>
      api
        .getDashboardStats()
        .then((s) => {
          if (live) setCounts({ due: s.dueCount, fresh: s.newCount, streak: s.streak })
        })
        .catch(() => {})
    pull()
    const id = window.setInterval(pull, 30000)
    return () => {
      live = false
      window.clearInterval(id)
    }
  }, [view])
  return counts
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function OnlineDot({ className }: { className?: string }) {
  // useSyncExternalStore is the correct way to read an external system like
  // navigator.onLine - no mirrored state, no cascading render on mount.
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  )
  if (online) return null
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1 text-xs font-medium text-warning', className)}
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> Offline
    </span>
  )
}

function Badge({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'muted' }) {
  if (!value) return null
  return (
    <span
      title={value > 99 ? `${value} items` : undefined}
      className={cn(
        'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold num',
        tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

export function AppSidebar() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const { due, fresh, streak } = useNavCounts()
  const streakValue = useCountUp(streak)
  const { reduce } = useMotionSafe()

  useEffect(() => {
    let gPressed = false
    let gTimer: number | null = null

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return
      }

      // Sidebar collapse hotkey: '[' or Ctrl+\ / Cmd+\
      if ((e.key === '[' && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key === '\\')) {
        e.preventDefault()
        toggleSidebar()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (e.key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        toggleSound()
        return
      }

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        gPressed = true
        if (gTimer) window.clearTimeout(gTimer)
        gTimer = window.setTimeout(() => { gPressed = false }, 1000)
        return
      }

      if (gPressed) {
        gPressed = false
        if (gTimer) window.clearTimeout(gTimer)
        switch (e.key.toLowerCase()) {
          case 't': navigate('today'); break
          case 'r': navigate('review'); break
          case 'l': navigate('learn'); break
          case 'q': navigate('quiz'); break
          case 'b': navigate('library'); break
          case 'p': navigate('progress'); break
          case 'c': navigate('coach'); break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (gTimer) window.clearTimeout(gTimer)
    }
  }, [navigate, setPaletteOpen, toggleSidebar])

  return (
    <aside
      data-testid="app-sidebar"
      data-collapsed={sidebarCollapsed}
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar/70 backdrop-blur-xl md:flex transition-[width] duration-200 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
      aria-label="Application sidebar"
    >
      {/* Header with Logo and Collapse Toggle */}
      {!sidebarCollapsed ? (
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <button
            type="button"
            onClick={() => navigate('today')}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
            title="LexiLearn Home"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
              L
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">LexiLearn</span>
              <span className="block truncate text-xs text-muted-foreground">Local · SM-2 · Private</span>
            </span>
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar ([)"
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-2 pb-2 pt-4">
          <button
            type="button"
            onClick={() => navigate('today')}
            title="LexiLearn Home"
            aria-label="LexiLearn Home"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-xs transition-transform hover:scale-105 cursor-pointer"
          >
            L
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar ([)"
            aria-label="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search trigger */}
      {!sidebarCollapsed ? (
        <div className="px-3 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="relative block w-full text-left cursor-pointer"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="flex h-10 items-center rounded-md border border-border bg-card pl-9 pr-12 text-sm text-muted-foreground shadow-xs transition-colors hover:border-primary-line">
              Search words…
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                ⌘&nbsp;K
              </kbd>
            </span>
          </button>
        </div>
      ) : (
        <div className="flex justify-center px-2 pb-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Search words (⌘K)"
            aria-label="Search words"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-primary-line hover:text-foreground shadow-xs transition-colors cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation tabs */}
      <nav className={cn('flex-1 space-y-1', sidebarCollapsed ? 'px-2' : 'px-3 py-1')} aria-label="Primary">
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon
          const active = view === tab.view || (tab.view === 'library' && view === 'library-deck')

          if (sidebarCollapsed) {
            const hasDue = tab.view === 'review' && due > 0
            const hasFresh = tab.view === 'learn' && fresh > 0
            return (
              <button
                key={tab.view}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(tab.view)}
                title={`${tab.label}${tab.view === 'review' && due ? ` (${due} due)` : ''}${tab.view === 'learn' && fresh ? ` (${fresh} new)` : ''}`}
                className={cn(
                  'relative flex h-10 w-10 mx-auto items-center justify-center rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer',
                  active
                    ? 'bg-primary-soft text-primary shadow-xs ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {active && !reduce ? (
                  <motion.span
                    layoutId="sidebar-active-rail"
                    className="absolute left-0 h-5 w-0.5 rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    aria-hidden="true"
                  />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {(hasDue || hasFresh) ? (
                  <span
                    className={cn(
                      'absolute top-1.5 right-1.5 h-2 w-2 rounded-full',
                      hasDue ? 'bg-primary animate-pulse' : 'bg-muted-foreground/80'
                    )}
                  />
                ) : null}
              </button>
            )
          }

          return (
            <button
              key={tab.view}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(tab.view)}
              className={cn(
                'relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 cursor-pointer',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {active && !reduce ? (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 h-6 w-0.5 rounded-r-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  aria-hidden="true"
                />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
              {tab.view === 'review' ? <Badge value={due} /> : null}
              {tab.view === 'learn' ? <Badge value={fresh} tone="muted" /> : null}
            </button>
          )
        })}
      </nav>

      {/* Bottom widgets */}
      {!sidebarCollapsed ? (
        <div className="space-y-2 px-3 pb-3">
          <button
            type="button"
            onClick={() => navigate('coach')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150 cursor-pointer',
              view === 'coach'
                ? 'border-primary-line bg-primary-soft'
                : 'border-border bg-card hover:border-primary-line'
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">AI Coach</span>
              <span className="block truncate text-xs text-muted-foreground">Fix mistakes · speak</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Flame className="h-3.5 w-3.5 text-streak" aria-hidden="true" />
              <span className="num">{streakValue}-day</span> streak
            </span>
            <OnlineDot />
          </div>

          {/* Quick Sound & Accent Theme bar */}
          <div className="flex items-center justify-between gap-1.5 rounded-lg border border-border bg-card/60 p-1.5">
            <SoundButton />
            <div className="h-4 w-px bg-border mx-0.5" />
            <AccentThemePicker />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-2 pb-3">
          {/* Compact AI Coach */}
          <button
            type="button"
            onClick={() => navigate('coach')}
            title="AI Coach (G C)"
            aria-label="AI Coach"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-150 cursor-pointer',
              view === 'coach'
                ? 'border-primary-line bg-primary-soft text-primary shadow-xs ring-1 ring-primary/20'
                : 'border-border bg-card text-muted-foreground hover:border-primary-line hover:text-foreground'
            )}
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Compact Streak */}
          <div
            title={`${streakValue}-day streak`}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-streak shadow-2xs"
          >
            <Flame className="h-4 w-4" />
          </div>

          {/* Compact Sound Toggle */}
          <CompactSoundButton />
        </div>
      )}

      {/* Footer / Status bar */}
      {!sidebarCollapsed ? (
        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between text-[11px] leading-relaxed text-muted-foreground">
          <span>Local · Private</span>
          <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]" title="Toggle sidebar with [">
            [
          </kbd>
        </div>
      ) : (
        <div className="border-t border-border py-2 flex justify-center text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[9px]" title="Toggle sidebar">
            [
          </kbd>
        </div>
      )}
    </aside>
  )
}

function CompactSoundButton() {
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    setSoundOn(isSoundEnabled())
    const sync = () => setSoundOn(isSoundEnabled())
    window.addEventListener('lexilearn-feel', sync)
    return () => window.removeEventListener('lexilearn-feel', sync)
  }, [])

  return (
    <button
      type="button"
      onClick={() => {
        const next = toggleSound()
        setSoundOn(next)
      }}
      title={soundOn ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)'}
      aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer',
        soundOn
          ? 'text-primary bg-primary-soft hover:bg-primary-soft/80'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </button>
  )
}

function SoundButton() {
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    setSoundOn(isSoundEnabled())
    const sync = () => setSoundOn(isSoundEnabled())
    window.addEventListener('lexilearn-feel', sync)
    return () => window.removeEventListener('lexilearn-feel', sync)
  }, [])

  return (
    <button
      type="button"
      onClick={() => {
        const next = toggleSound()
        setSoundOn(next)
      }}
      title={soundOn ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)'}
      aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
        soundOn
          ? 'text-primary bg-primary-soft hover:bg-primary-soft/80'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      <span className="text-[11px]">{soundOn ? 'Sound on' : 'Muted'}</span>
    </button>
  )
}

function AccentThemePicker() {
  const accentHue = useAppStore((s) => s.accentHue)
  const setAccentHue = useAppStore((s) => s.setAccentHue)

  useEffect(() => {
    syncAccentHue()
  }, [])

  return (
    <div className="flex items-center gap-1 px-1" role="radiogroup" aria-label="Theme accent color">
      {ACCENT_THEMES.map((theme) => {
        const active = accentHue === theme.hue
        return (
          <button
            key={theme.name}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${theme.name} theme`}
            onClick={() => {
              playSound('tap')
              setAccentHue(theme.hue)
            }}
            className={cn(
              'h-4 w-4 rounded-full transition-transform cursor-pointer',
              active ? 'scale-125 ring-2 ring-foreground/20 ring-offset-1 ring-offset-card' : 'hover:scale-110 opacity-70 hover:opacity-100'
            )}
            style={{ backgroundColor: theme.color }}
          />
        )
      })}
    </div>
  )
}

export function MobileTopBar() {
  const navigate = useAppStore((s) => s.navigate)
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/92 px-4 py-2.5 backdrop-blur-xl transition-[box-shadow,border-color] duration-200 md:hidden',
        scrolled ? 'border-border shadow-sm' : 'border-transparent'
      )}
    >
      <button type="button" onClick={() => navigate('today')} className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          L
        </span>
        <span className="text-sm font-semibold tracking-tight">LexiLearn</span>
      </button>
      <div className="flex items-center gap-3">
        <OnlineDot />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search words"
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

export function MobileTabs() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const { due } = useNavCounts()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon
          const active = view === tab.view || (tab.view === 'library' && view === 'library-deck')
          return (
            <li key={tab.view}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(tab.view)}
                className={cn(
                  'relative flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors duration-150',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <span className="relative">
                  <Icon className={cn('h-5 w-5 transition-transform duration-150', active && 'scale-110')} aria-hidden="true" />
                  {tab.view === 'review' && due > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground num">
                      {due > 99 ? '99+' : due}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{tab.label}</span>
                {active ? (
                  <motion.span
                    layoutId="mobile-tab-indicator"
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function ShellOverlays() {
  const paletteOpen = useAppStore((s) => s.paletteOpen)
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen)
  return <SearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
}
