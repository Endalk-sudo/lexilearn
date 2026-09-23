'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, BookOpen, BrainCircuit, CornerDownLeft, Ear, GraduationCap,
  Plus, Search, Sparkles, TrendingUp, Volume2,
} from 'lucide-react'
import { api, type WordDTO } from '@/lib/api'
import { useAppStore, type LibraryTab, type ViewName } from '@/lib/store'
import { WordCardV2 } from '@/components/word-card-v2'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/feel'

const RECENTS_KEY = 'lexilearn-recent-searches'

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    return raw ? (JSON.parse(raw) as string[]).slice(0, 6) : []
  } catch {
    return []
  }
}

function pushRecent(term: string) {
  try {
    const next = [term, ...readRecents().filter((r) => r !== term)].slice(0, 6)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}

type Quick = { label: string; hint: string; icon: React.ElementType; view: ViewName; tab?: LibraryTab }

const QUICK: Quick[] = [
  { label: 'Review due cards', hint: 'Clear today\u2019s queue', icon: BrainCircuit, view: 'review' },
  { label: 'Learn new words', hint: 'Recall, listen, spell', icon: GraduationCap, view: 'learn' },
  { label: 'Dictation', hint: 'Hear it, type it', icon: Ear, view: 'dictation' },
  { label: 'Dictionary', hint: 'Look up any word', icon: BookOpen, view: 'library', tab: 'dictionary' },
  { label: 'Progress', hint: 'Streaks and mastery', icon: TrendingUp, view: 'progress' },
  { label: 'AI Coach', hint: 'Fix mistakes, speak', icon: Sparkles, view: 'coach' },
]

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useAppStore((s) => s.navigate)
  const setDictationDeckId = useAppStore((s) => s.setDictationDeckId)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WordDTO[]>([])
  // The query that produced `results`. A non-empty query that doesn't match it
  // is "pending" — derived state, so effects never set it synchronously.
  const [resultsFor, setResultsFor] = useState('')
  const [selected, setSelected] = useState<WordDTO | null>(null)
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const trimmed = query.trim()
  const filtered = useMemo(() => results.slice(0, 12), [results])
  const pending = !!trimmed && resultsFor !== trimmed
  const showQuick = !trimmed && !selected
  const showRecents = showQuick && recents.length > 0
  const showOptions = !selected && !showQuick && !pending && filtered.length > 0

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement
    // Recents + state reset happen inside the timeout so the effect body never
    // sets state synchronously (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      setRecents(readRecents())
      setQuery('')
      setResults([])
      setResultsFor('')
      setSelected(null)
      setActive(0)
      inputRef.current?.focus()
    }, 30)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(id)
      document.body.style.overflow = ''
      restoreRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!trimmed) return
    const id = window.setTimeout(async () => {
      try {
        const found = await api.searchWords(trimmed)
        setResults(found)
      } catch {
        setResults([])
      } finally {
        setResultsFor(trimmed)
      }
    }, 180)
    return () => window.clearTimeout(id)
  }, [trimmed])

  const hear = useCallback((word: WordDTO) => {
    if (!speak(word.word)) toast.error('Pronunciation is unavailable in this browser.')
  }, [])

  const openWord = useCallback(
    (word: WordDTO) => {
      playSound('tap')
      pushRecent(word.word)
      setSelected(word)
    },
    []
  )

  const go = useCallback(
    (quick: Quick) => {
      playSound('tap')
      if (quick.view === 'dictation') setDictationDeckId(null)
      if (quick.tab) navigate(quick.view, { libraryTab: quick.tab })
      else navigate(quick.view)
      onClose()
    },
    [navigate, onClose, setDictationDeckId]
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Tab') {
      // Keep keyboard focus inside the dialog while it is open (WCAG 2.4.3).
      const card = cardRef.current
      if (!card) return
      const focusables = card.querySelectorAll<HTMLElement>(
        'button, input, [href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
      return
    }
    const list: (WordDTO | Quick)[] = selected ? [] : trimmed ? filtered : QUICK
    if (!list.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % list.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + list.length) % list.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = list[active]
      if (!item) return
      if ('word' in item) openWord(item)
      else go(item)
    } else if (e.key === 'Home') {
      setActive(0)
    } else if (e.key === 'End') {
      setActive(list.length - 1)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[8vh] sm:pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search words and jump to a section"
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in-0 duration-150" onClick={onClose} />
      <div ref={cardRef} className="relative flex max-h-[72vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-2 border-b border-border p-2.5">
          {selected ? (
            <Button size="icon" variant="ghost" onClick={() => setSelected(null)} aria-label="Back to results">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Search className="ml-1.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
              setActive(0)
            }}
            placeholder="Search words, or jump to a section…"
            aria-label="Search words"
            role="combobox"
            aria-expanded={!selected}
            aria-controls="palette-results"
            aria-activedescendant={showOptions ? `palette-item-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="mr-1 hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        {/* Container keeps its stable id for aria-controls; the listbox role sits
            on the results list itself so quick/selected branches stay plain UI. */}
        <div id="palette-results" className="min-h-40 flex-1 overflow-y-auto overscroll-contain p-2">
          {selected ? (
            <div className="p-1">
              <WordCardV2 word={selected} />
            </div>
          ) : showQuick ? (
            <div className="space-y-3">
              {showRecents ? (
                <div>
                  <div className="label px-2 py-1.5 text-muted-foreground">Recent</div>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {recents.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary-line hover:text-foreground"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="label px-2 py-1.5 text-muted-foreground">Jump to</div>
                <ul>
                  {QUICK.map((quick, i) => {
                    const Icon = quick.icon
                    return (
                      <li key={quick.label}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(quick)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                            active === i ? 'bg-primary-soft text-primary' : 'hover:bg-accent'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{quick.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">{quick.hint}</span>
                          </span>
                          {active === i ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ) : pending ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" aria-hidden="true" />
              Searching…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <BookOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Nothing matches “{query}” in your local dictionary.
              </p>
              <Button
                variant="soft"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setSearchQuery(query)
                  navigate('library', { libraryTab: 'dictionary', query })
                  onClose()
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add it to a deck
              </Button>
            </div>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {filtered.map((word, i) => (
                <li key={word.id} id={`palette-item-${i}`} role="option" aria-selected={active === i}>
                  {/* Non-focusable row: keyboard users navigate via the input's
                      aria-activedescendant + Enter, so the row itself must not
                      be a focusable control inside the listbox. */}
                  <div
                    onMouseEnter={() => setActive(i)}
                    onClick={() => openWord(word)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-md p-2.5 text-left transition-colors',
                      active === i ? 'bg-primary-soft' : 'hover:bg-accent'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{word.word}</span>
                        {word.cefr ? <Badge variant="outline" className="font-mono text-xs">{word.cefr}</Badge> : null}
                      </span>
                      {word.definitions[0] ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {word.definitions[0].text}
                        </span>
                      ) : null}
                    </span>
                    {/* Mouse-only affordance; the footer's Hear button is the
                        keyboard/AT path for listening to the active word. */}
                    <span
                      aria-hidden="true"
                      onClick={(e) => {
                        e.stopPropagation()
                        hear(word)
                      }}
                      className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Volume2 className="h-4 w-4" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">↑ ↓ to move · Enter to open · Esc to close</span>
          <span className="sm:hidden">Tap a result to open it</span>
          {showOptions && filtered[active] ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => hear(filtered[active])}
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              Hear “{filtered[active].word}”
            </Button>
          ) : (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" /> Works offline
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
