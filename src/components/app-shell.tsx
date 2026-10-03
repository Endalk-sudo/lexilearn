'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  BookOpen, BrainCircuit, ChevronRight, Compass, Flame,
  GraduationCap, PanelLeftClose, PanelLeftOpen, Search, Sparkles, TrendingUp, Volume2, VolumeX, WifiOff,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { SearchPalette } from '@/components/search-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { ACCENT_THEMES, syncAccentHue, syncStudyPrefs, useAppStore, type ViewName } from '@/lib/store'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { isSoundEnabled, playSound, toggleSound, useSoundState } from '@/lib/feel'
import { useMotionSafe } from '@/lib/motion'
import { useCountUp } from '@/hooks/use-count-up'
import { isTypingTarget } from '@/hooks/use-shortcuts'

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
      if (isTypingTarget(e.target)) {
        return
      }

      // Cheat sheet dialog: '?' or Shift+'/'
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        useAppStore.getState().setShortcutsOpen(true)
        return
      }

      // Sidebar collapse hotkey: '[' or Ctrl+\ / Cmd+\
      if ((e.key === '[' && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key === '\\')) {
        e.preventDefault()
        useAppStore.getState().toggleSidebar()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useAppStore.getState().setPaletteOpen(true)
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
        const nav = useAppStore.getState().navigate
        switch (e.key.toLowerCase()) {
          case 't': nav('today'); break
          case 'r': nav('review'); break
          case 'l': nav('learn'); break
          case 'd': nav('dictation'); break
          case 'v': nav('deck'); break
          case 'b': nav('library'); break
          case 'p': nav('progress'); break
          case 'c': nav('coach'); break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (gTimer) window.clearTimeout(gTimer)
    }
  }, [])

  return (
    <aside
      data-testid="app-sidebar"
      data-collapsed={sidebarCollapsed}
      data-focus-chrome="sidebar"
      suppressHydrationWarning
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
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-neu-primary transition-transform group-hover:scale-105">
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
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-neu-sm hover:border-primary-line/50 hover:text-foreground hover:shadow-neu active:shadow-neu-pressed transition-all cursor-pointer"
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
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-neu-primary transition-transform hover:scale-105 cursor-pointer"
          >
            L
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar ([)"
            aria-label="Expand sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-neu-sm hover:border-primary-line/50 hover:text-foreground hover:shadow-neu active:shadow-neu-pressed transition-all cursor-pointer"
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
            <span className="flex h-10 items-center rounded-xl border border-border/70 bg-card/60 pl-9 pr-12 text-sm text-muted-foreground shadow-neu-inset-sm transition-all hover:border-primary-line/60">
              Search words…
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-white/60 dark:border-white/10 bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-neu-sm">
                ⌘K
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-neu-sm hover:border-primary-line hover:text-foreground hover:shadow-neu active:shadow-neu-pressed transition-all cursor-pointer"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation tabs */}
      <nav className={cn('flex-1 space-y-1.5', sidebarCollapsed ? 'px-2' : 'px-3 py-1')} aria-label="Primary">
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
                  'relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer',
                  active
                    ? 'bg-primary-soft text-primary shadow-neu-pressed border border-primary-line/40'
                    : 'text-muted-foreground hover:bg-card/70 hover:shadow-neu-sm hover:text-foreground'
                )}
              >
                {active && !reduce ? (
                  <motion.span
                    layoutId="sidebar-active-rail"
                    className="absolute left-0 h-5 w-1 rounded-r-full bg-primary"
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
                'relative flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-all duration-150 cursor-pointer',
                active
                  ? 'bg-primary-soft text-primary shadow-neu-pressed border border-primary-line/40'
                  : 'text-muted-foreground hover:bg-card/70 hover:shadow-neu-sm hover:text-foreground'
              )}
            >
              {active && !reduce ? (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute left-0 h-6 w-1 rounded-r-full bg-primary"
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
        <div className="space-y-2.5 px-3 pb-3">
          <button
            type="button"
            onClick={() => navigate('coach')}
            className={cn(
              'surface lift flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all duration-150 cursor-pointer',
              view === 'coach'
                ? 'border-primary-line bg-primary-soft/60 shadow-neu-pressed text-primary'
                : 'border-border/60 bg-card hover:border-primary-line/50 hover:shadow-neu'
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-neu-primary" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">AI Coach</span>
              <span className="block truncate text-xs text-muted-foreground">Fix mistakes · speak</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>

          <div className="surface flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-neu-sm">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 text-streak" aria-hidden="true" />
              <span className="num">{streakValue}-day</span> streak
            </span>
            <OnlineDot />
          </div>

          {/* Quick Sound & Accent Theme bar */}
          <div className="surface-inset flex items-center justify-between gap-1.5 rounded-xl border border-border/50 p-1.5 shadow-neu-inset-sm">
            <SoundButton />
            <div className="h-4 w-px bg-border/60 mx-0.5" />
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
              'flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 cursor-pointer shadow-neu-sm',
              view === 'coach'
                ? 'border-primary-line bg-primary-soft text-primary shadow-neu-pressed'
                : 'border-border/70 bg-card text-muted-foreground hover:border-primary-line hover:text-foreground hover:shadow-neu active:shadow-neu-pressed'
            )}
          >
            <Sparkles className="h-4 w-4" />
          </button>

          {/* Compact Streak */}
          <div
            title={`${streakValue}-day streak`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-streak shadow-neu-sm"
          >
            <Flame className="h-4 w-4" />
          </div>

          {/* Compact Sound Toggle */}
          <CompactSoundButton />
        </div>
      )}

      {/* Footer / Status bar */}
      {!sidebarCollapsed ? (
        <div className="border-t border-border/60 px-4 py-2.5 flex items-center justify-between text-[11px] leading-relaxed text-muted-foreground">
          <span>Local · Private</span>
          <kbd title="Toggle sidebar with [" className="rounded-md border border-white/60 dark:border-white/10 bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-neu-sm">
            [
          </kbd>
        </div>
      ) : (
        <div className="border-t border-border/60 py-2 flex justify-center text-[10px] text-muted-foreground">
          <kbd title="Toggle sidebar" className="rounded-md border border-white/60 dark:border-white/10 bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-neu-sm">
            [
          </kbd>
        </div>
      )}
    </aside>
  )
}

function CompactSoundButton() {
  const soundOn = useSoundState()

  return (
    <button
      type="button"
      onClick={toggleSound}
      title={soundOn ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)'}
      aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-neu-sm',
        soundOn
          ? 'text-primary bg-primary-soft border-primary-line/40 hover:bg-primary-soft/80 active:shadow-neu-pressed'
          : 'text-muted-foreground bg-card border-border/70 hover:bg-accent hover:text-foreground active:shadow-neu-pressed'
      )}
    >
      {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </button>
  )
}

function SoundButton() {
  const soundOn = useSoundState()

  return (
    <button
      type="button"
      onClick={toggleSound}
      title={soundOn ? 'Sound effects on (click to mute)' : 'Sound effects muted (click to unmute)'}
      aria-label={soundOn ? 'Mute sound' : 'Enable sound'}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shadow-neu-sm border border-transparent',
        soundOn
          ? 'text-primary bg-primary-soft border-primary-line/40 hover:bg-primary-soft/80 active:shadow-neu-pressed'
          : 'text-muted-foreground bg-card/60 hover:bg-card hover:text-foreground active:shadow-neu-pressed'
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
    syncStudyPrefs()
  }, [])

  return (
    <div className="flex items-center gap-1.5 px-1" role="radiogroup" aria-label="Theme accent color">
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
              'h-4.5 w-4.5 rounded-full transition-all duration-150 cursor-pointer shadow-neu-sm border border-white/40 dark:border-white/10',
              active
                ? 'scale-125 ring-2 ring-foreground/30 shadow-neu-primary'
                : 'hover:scale-110 opacity-75 hover:opacity-100'
            )}
            style={{ backgroundColor: theme.color }}
            suppressHydrationWarning
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
      data-focus-chrome="topbar"
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur-xl transition-all duration-200 md:hidden',
        scrolled ? 'border-border/70 shadow-neu-sm' : 'border-transparent'
      )}
    >
      <button type="button" onClick={() => navigate('today')} className="flex items-center gap-2 cursor-pointer">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-neu-primary">
          L
        </span>
        <span className="text-sm font-bold tracking-tight">LexiLearn</span>
      </button>
      <div className="flex items-center gap-3">
        <OnlineDot />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search words"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground shadow-neu-sm transition-all hover:text-foreground active:shadow-neu-pressed cursor-pointer"
        >
          <Search className="h-4.5 w-4.5" aria-hidden="true" />
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
      data-focus-chrome="tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-neu-lg md:hidden"
    >
      <ul className="grid grid-cols-5 p-1">
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
                  'relative flex min-h-13 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer',
                  active ? 'text-primary shadow-neu-pressed bg-primary-soft/40' : 'text-muted-foreground'
                )}
              >
                <span className="relative">
                  <Icon className={cn('h-5 w-5 transition-transform duration-150', active && 'scale-110')} aria-hidden="true" />
                  {tab.view === 'review' && due > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground num shadow-neu-primary">
                      {due > 99 ? '99+' : due}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[11px]">{tab.label}</span>
                {active ? (
                  <motion.span
                    layoutId="mobile-tab-indicator"
                    className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-primary"
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
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  return (
    <>
      <SearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
