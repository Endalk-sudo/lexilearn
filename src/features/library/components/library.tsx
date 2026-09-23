'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, BookOpen, Ear, Layers, Library as LibraryIcon, Pencil, Plus,
  Search as SearchIcon, Trash2, Upload, Volume2,
} from 'lucide-react'
import {
  api, type DeckDetail, type DeckSummary, type WordDTO,
} from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/page-header'
import { SegmentedControl } from '@/components/layout/segmented-control'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import { WordCardV2 } from '@/components/word-card-v2'
import { WordFormDialog } from '@/features/library/components/word-form-dialog'
import { BulkAddWordsDialog } from '@/features/library/components/bulk-add-words-dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CSV_FORMAT_HINT, CSV_PLACEHOLDER, parseCsv } from '@/features/library/lib/csv-parser'
import { speak } from '@/lib/tts'
import { playSound } from '@/lib/feel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { listItem, stagger, useMotionSafe } from '@/lib/motion'

export function LibraryView() {
  const libraryTab = useAppStore((s) => s.libraryTab)
  const setLibraryTab = useAppStore((s) => s.setLibraryTab)
  const { v, t } = useMotionSafe()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div variants={v(stagger(0.04))} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={v(listItem)} transition={t()}>
          <PageHeader
            eyebrow="Library"
            icon={LibraryIcon}
            title="Your words, all in one place"
            description="Decks hold what you are studying. The dictionary searches everything you have ever added."
          />
        </motion.div>
        <motion.div variants={v(listItem)} transition={t()}>
          <SegmentedControl
            ariaLabel="Library sections"
            value={libraryTab}
            onChange={setLibraryTab}
            options={[
              { value: 'decks', label: 'Decks', icon: Layers },
              { value: 'dictionary', label: 'Dictionary', icon: SearchIcon },
            ]}
          />
        </motion.div>
        {libraryTab === 'decks' ? <DecksPanel /> : <DictionaryPanel />}
      </motion.div>
    </div>
  )
}

function DecksPanel() {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const navigate = useAppStore((s) => s.navigate)
  const { v, t } = useMotionSafe()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDecks(await api.getDecks())
    } catch {
      /* offline */
    } finally {
      setLoading(false)
    }
  }, [])

  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    load()
  }, [load])

  const removeDeck = async (id: string) => {
    try {
      await api.deleteDeck(id)
      toast.success('Deck deleted')
      await load()
    } catch (e) {
      // Surface the server's reason (e.g. bundled decks cannot be deleted).
      toast.error(e instanceof Error && e.message ? e.message : 'Could not delete that deck')
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground num">{decks.length} decks</p>
        <Button variant="soft" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New deck
        </Button>
      </div>

      {decks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No decks yet"
          hint="A deck is just a group of words. Create one for whatever you are reading this week."
          actionLabel="Create your first deck"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <motion.ul variants={v(stagger(0.03))} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <motion.li key={deck.id} variants={v(listItem)} transition={t()}>
              <div className="surface flex h-full flex-col p-4 transition-colors duration-150 hover:border-primary-line">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    data-testid={`deck-card-${deck.id}`}
                    onClick={() => navigate('library-deck', { deckId: deck.id })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold tracking-tight">{deck.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {deck.description || (deck.isCustom ? 'Custom deck' : 'Curated deck')}
                    </span>
                  </button>
                  {deck.isCustom ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Delete ${deck.name}`}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete “{deck.name}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the deck and its {deck.wordCount} words. Progress on those words is
                            removed too, and this cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep deck</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void removeDeck(deck.id)}
                          >
                            Delete deck
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground num">{deck.wordCount} words</span>
                  <Button size="sm" variant="ghost" onClick={() => navigate('library-deck', { deckId: deck.id })}>
                    Open
                  </Button>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <CreateDeckDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (id) => {
          await load()
          if (id) navigate('library-deck', { deckId: id })
        }}
      />
    </div>
  )
}

function CreateDeckDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id?: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [csv, setCsv] = useState('')
  const [creating, setCreating] = useState(false)
  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : []), [csv])
  const nameError = name.trim().length > 0 && name.trim().length < 2 ? 'Use at least 2 characters.' : ''

  const reset = () => {
    setName('')
    setDescription('')
    setCsv('')
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(file)
  }

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Give the deck a name first.')
      return
    }
    if (name.trim().length < 2) return
    setCreating(true)
    try {
      const result = await api.createCustomDeck(name.trim(), description.trim(), parsed)
      toast.success(
        parsed.length
          ? `Deck created with ${parsed.length} word${parsed.length === 1 ? '' : 's'}`
          : 'Deck created'
      )
      reset()
      onOpenChange(false)
      onCreated(result.id)
    } catch {
      toast.error('Could not create the deck')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New deck</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
          <div>
            <Label htmlFor="deck-name">Name</Label>
            <Input
              id="deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Words from my reading this week"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'deck-name-error' : undefined}
            />
            {nameError ? (
              <p id="deck-name-error" className="mt-1.5 text-xs font-medium text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="deck-description">Description (optional)</Label>
            <Input
              id="deck-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chapter 3 vocabulary"
            />
          </div>
          <div>
            <Label htmlFor="deck-csv">Words (optional) — one per line</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Format: <code className="rounded bg-muted px-1 py-0.5">{CSV_FORMAT_HINT}</code>
            </p>
            <Textarea
              id="deck-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={CSV_PLACEHOLDER}
              className="mt-1.5 min-h-32 font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="deck-csv-file"
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:border-primary-line"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Upload file
            </label>
            <input id="deck-csv-file" type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            <span className="text-xs text-muted-foreground num">
              {parsed.length ? `${parsed.length} words ready` : 'CSV or tab-separated'}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create deck'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DictionaryPanel() {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const navigate = useAppStore((s) => s.navigate)
  const [results, setResults] = useState<WordDTO[]>([])
  // The query lives in the store so the search palette can pre-fill it.
  // `resultsFor` marks which query produced the results, making "pending"
  // derived state — no effect ever sets state synchronously.
  const [resultsFor, setResultsFor] = useState('')
  const [selected, setSelected] = useState<WordDTO | null>(null)

  const query = searchQuery
  const trimmed = query.trim()
  const pending = !!trimmed && resultsFor !== trimmed

  useEffect(() => {
    if (!trimmed) return
    const id = window.setTimeout(async () => {
      try {
        const list = await api.searchWords(trimmed)
        setResults(list)
      } catch {
        /* offline: keep the last results */
      } finally {
        setResultsFor(trimmed)
      }
    }, 180)
    return () => window.clearTimeout(id)
  }, [trimmed])

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSelected(null)
          }}
          placeholder="Search your dictionary…"
          aria-label="Search your dictionary"
          autoComplete="off"
          spellCheck={false}
          className="h-11 pl-9"
        />
      </div>

      {selected ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4" />
            Back to results
          </Button>
          <WordCardV2 word={selected} />
        </div>
      ) : pending ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !query.trim() ? (
        <EmptyState
          icon={BookOpen}
          title="Look up any word you have added"
          hint="Search works entirely offline — it reads your local dictionary, not the internet."
          actionLabel="Browse decks"
          onAction={() => navigate('library', { libraryTab: 'decks' })}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={`Nothing matches “${query}”`}
          hint="Your dictionary only contains words you have added. Add this one to a deck to keep it."
          actionLabel="Add words to a deck"
          onAction={() => navigate('library', { libraryTab: 'decks' })}
        />
      ) : (
        <ul className="space-y-2">
          {results.map((word) => (
            <li key={word.id} className="surface flex items-center gap-1 p-2 transition-colors duration-150 hover:border-primary-line">
              {/* Row button and Hear button are siblings — a button inside a
                  button is invalid and unreachable for keyboard users (W8). */}
              <button
                type="button"
                onClick={() => {
                  playSound('tap')
                  setSelected(word)
                }}
                className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{word.word}</span>
                    {word.pos ? <span className="text-xs italic text-muted-foreground">{word.pos}</span> : null}
                    {word.cefr ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {word.cefr}
                      </Badge>
                    ) : null}
                  </span>
                  {word.definitions[0] ? (
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {word.definitions[0].text}
                    </span>
                  ) : null}
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Hear ${word.word}`}
                onClick={() => {
                  if (!speak(word.word)) toast.error('Pronunciation is unavailable in this browser.')
                }}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const STATUS_VARIANT: Record<string, 'outline' | 'soft' | 'success' | 'warning'> = {
  new: 'outline',
  learning: 'warning',
  reviewing: 'soft',
  mastered: 'success',
}

export function DeckDetailView() {
  const deckId = useAppStore((s) => s.deckId)
  const navigate = useAppStore((s) => s.navigate)
  const setDictationDeckId = useAppStore((s) => s.setDictationDeckId)
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editing, setEditing] = useState<(WordDTO & { id: string }) | null>(null)
  const { v, t } = useMotionSafe()

  const load = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    try {
      setDeck(await api.getDeck(deckId))
    } catch {
      toast.error('Could not load that deck')
    } finally {
      setLoading(false)
    }
  }, [deckId])

  // Reload only when the deck id actually changes; the ref guard keeps the
  // fetch (and its setState) out of the synchronous effect body on re-renders.
  const loadedDeckRef = useRef<string | null>(null)
  useEffect(() => {
    if (loadedDeckRef.current === deckId) return
    loadedDeckRef.current = deckId
    load()
  }, [load, deckId])

  const words = useMemo(() => {
    if (!deck) return []
    const term = filter.trim().toLowerCase()
    if (!term) return deck.words
    return deck.words.filter(
      (w) =>
        w.word.toLowerCase().includes(term) ||
        (w.definitions[0]?.text ?? '').toLowerCase().includes(term)
    )
  }, [deck, filter])

  const removeWord = async (wordId: string) => {
    try {
      await api.deleteWord(wordId)
      toast.success('Word removed')
      await load()
    } catch {
      toast.error('Could not remove that word')
    }
  }

  if (!deckId) {
    return (
      <EmptyState
        icon={Layers}
        title="No deck selected"
        hint="Pick a deck from your library to see the words inside it."
        actionLabel="Back to library"
        onAction={() => navigate('library', { libraryTab: 'decks' })}
      />
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-11 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!deck) {
    return (
      <EmptyState
        icon={Layers}
        title="That deck is not available"
        hint="It may have been deleted. Your other decks are untouched."
        actionLabel="Back to library"
        onAction={() => navigate('library', { libraryTab: 'decks' })}
      />
    )
  }

  const mastered = deck.words.filter((w) => w.srs?.status === 'mastered').length

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('library', { libraryTab: 'decks' })}>
        <ArrowLeft className="h-4 w-4" />
        Library
      </Button>

      <PageHeader
        eyebrow={deck.isCustom ? 'Custom deck' : 'Curated deck'}
        icon={Layers}
        title={deck.name}
        description={
          deck.description ||
          `${deck.words.length} words · ${mastered} mastered`
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button
              variant="soft"
              size="sm"
              onClick={() => {
                setDictationDeckId(deck.id)
                navigate('dictation')
              }}
            >
              <Ear className="h-4 w-4" />
              Dictate
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add word
            </Button>
          </>
        }
      />

      {deck.words.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="This deck is empty"
          hint="Add words one at a time, or paste a whole list and import them in one go."
          actionLabel="Add your first word"
          onAction={() => setAddOpen(true)}
          secondary={
            <Button variant="ghost" size="sm" onClick={() => setBulkOpen(true)}>
              Import a list instead
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter this deck…"
                aria-label="Filter words in this deck"
                className="pl-9"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <span className="text-sm text-muted-foreground num" role="status" aria-live="polite" data-testid="deck-filter-count">
              showing {words.length} of {deck.words.length}
            </span>
          </div>

          {words.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title={`No words match “${filter}”`}
              hint="Try a shorter search, or clear the filter to see the whole deck."
              actionLabel="Clear filter"
              onAction={() => setFilter('')}
            />
          ) : (
            <motion.ul variants={v(stagger(0.02))} initial="hidden" animate="show" className="space-y-2">
              {words.map((word) => (
                <motion.li key={word.id} variants={v(listItem)} transition={t()} className="cv-auto">
                  <div className="surface flex items-start justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{word.word}</span>
                        {word.pos ? (
                          <span className="text-xs italic text-muted-foreground">{word.pos}</span>
                        ) : null}
                        {word.cefr ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {word.cefr}
                          </Badge>
                        ) : null}
                        {word.srs ? (
                          <Badge variant={STATUS_VARIANT[word.srs.status] ?? 'outline'} className="capitalize">
                            {word.srs.status}
                          </Badge>
                        ) : null}
                      </div>
                      {word.definitions[0] ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {word.definitions[0].text}
                        </p>
                      ) : null}
                      {word.amharic ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" lang="am">{word.amharic}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Hear ${word.word}`}
                        onClick={() => {
                          if (!speak(word.word)) toast.error('Pronunciation is unavailable in this browser.')
                        }}
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${word.word}`}
                        onClick={() => setEditing({ ...word, id: word.id })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label={`Delete ${word.word}`}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove “{word.word}”?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Its review history goes with it. Other words in this deck are untouched.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep word</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void removeWord(word.id)}
                            >
                              Remove word
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <NextStep
              title="Study this deck"
              hint="Spaced repetition decides what to show and when."
              actionLabel="Start learning"
              onAction={() => navigate('learn')}
            />
            <NextStep
              title="Hear this deck"
              hint="Every word and sentence, dictated aloud."
              actionLabel="Start dictation"
              onAction={() => {
                setDictationDeckId(deck.id)
                navigate('dictation')
              }}
            />
          </div>
        </>
      )}

      <WordFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={load}
        deckId={deck.id}
      />
      <WordFormDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={load}
        deckId={deck.id}
        initialValues={
          editing
            ? {
                id: editing.id,
                word: editing.word,
                pos: editing.pos ?? '',
                ipa: editing.ipa ?? '',
                definition: editing.definitions[0]?.text ?? '',
                example: editing.examples[0] ?? '',
                cefr: editing.cefr ?? '',
                synonyms: editing.synonyms.join(', '),
                antonyms: editing.antonyms.join(', '),
                amharic: editing.amharic ?? '',
              }
            : undefined
        }
      />
      <BulkAddWordsDialog
        deckId={deck.id}
        deckName={deck.name}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onImported={load}
      />
    </div>
  )
}
