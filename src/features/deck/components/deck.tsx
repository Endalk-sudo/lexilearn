'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Layers } from 'lucide-react'
import { api, type DeckSummary } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { LearnView } from '@/features/learn/components/learn'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/feedback/empty-state'

/**
 * Deck — study a picked deck through the same recall → meaning → spell flow
 * Learn uses, but scoped to that deck's reviewable + new cards instead of the
 * global new-word queue. Grades flow to SRS/XP/streak exactly like Learn.
 */
export function DeckView() {
  const [selected, setSelected] = useState<{ id: string | null; name: string } | null>(null)
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    let live = true
    api.getDecks()
      .then((list) => { if (live) { setDecks(list); setLoadFailed(false) } })
      .catch(() => { if (live) { setDecks([]); setLoadFailed(true) } })
    return () => { live = false }
  }, [])

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          ← Back to decks
        </button>
        <LearnView
          mode="deck"
          deckId={selected.id}
          deckName={selected.name}
          key={selected.id ?? 'all'}
        />
      </div>
    )
  }

  return (
    <div className="study-col mx-auto space-y-6">
      <PageHeader
        eyebrow="Deck"
        icon={Layers}
        title="Study a deck"
        description="Pick a deck and run it through the Learn flow — recall, study the meaning, then spell it. It grades like any other session."
      />
      {decks === null && !loadFailed ? (
        <div className="space-y-3" aria-busy="true">
          <div className="surface h-14 rounded-xl" />
          <div className="surface h-14 rounded-xl" />
          <div className="surface h-14 rounded-xl" />
        </div>
      ) : loadFailed ? (
        <EmptyState
          icon={Layers}
          title="Couldn't load your decks"
          hint="Check your connection, then try again."
          actionLabel="Retry"
          onAction={() => window.location.reload()}
        />
      ) : decks && decks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No decks yet"
          hint="Create a deck in the library, then come back here to study it."
          actionLabel="Open library"
          onAction={() => navigate('library')}
        />
      ) : (
        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => setSelected({ id: null, name: 'Whole library' })}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary-line/60 hover:bg-primary-soft/40 cursor-pointer"
          >
            <span>
              <span className="block text-sm font-semibold">Whole library</span>
              <span className="block text-xs text-muted-foreground">
                Every reviewable + new word, no deck filter
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {(decks ?? []).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelected({ id: d.id, name: d.name })}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary-line/60 hover:bg-primary-soft/40 cursor-pointer"
            >
              <span>
                <span className="block text-sm font-semibold">{d.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {d.wordCount} word{d.wordCount === 1 ? '' : 's'}{d.subDeckCount ? ` · ${d.subDeckCount} sub-deck${d.subDeckCount === 1 ? '' : 's'}` : ''}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
