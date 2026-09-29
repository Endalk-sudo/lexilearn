'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, BookOpen, ChevronDown, ChevronRight, Ear, FolderPlus, FolderTree,
  Layers, Library as LibraryIcon, Pencil, Plus, Search as SearchIcon, Star, Tag,
  Trash2, Upload, Volume2, X,
} from 'lucide-react'
import {
  api, type DeckDetail, type DeckSummary, type WordDTO, type CategorySummary,
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
import { WordCard } from '@/components/word-card'
import { WordFormDialog } from '@/features/library/components/word-form-dialog'
import { BulkAddWordsDialog } from '@/features/library/components/bulk-add-words-dialog'
import { ManageCategoriesDialog } from '@/features/library/components/manage-categories-dialog'
import { CategoryBadgeList } from '@/features/library/components/category-badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CSV_FORMAT_HINT, CSV_PLACEHOLDER, parseCsv, splitCategoryNames } from '@/features/library/lib/csv-parser'
import { posKey } from '@/features/library/lib/pos'
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
  const [loadError, setLoadError] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [expandedDeckIds, setExpandedDeckIds] = useState<Set<string>>(new Set())
  const navigate = useAppStore((s) => s.navigate)
  const setDictationDeckId = useAppStore((s) => s.setDictationDeckId)
  const { v, t } = useMotionSafe()

  const deckIdSet = useMemo(() => new Set(decks.map((d) => d.id)), [decks])
  const rootDecks = useMemo(
    () => decks.filter((d) => !d.parentId || !deckIdSet.has(d.parentId)),
    [decks, deckIdSet]
  )
  const subDecksByParent = useMemo(() => {
    const map = new Map<string, DeckSummary[]>()
    for (const d of decks) {
      if (d.parentId && deckIdSet.has(d.parentId)) {
        const list = map.get(d.parentId) ?? []
        list.push(d)
        map.set(d.parentId, list)
      }
    }
    return map
  }, [decks, deckIdSet])

  const toggleExpand = (id: string) => {
    setExpandedDeckIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await api.getDecks()
      setDecks(data)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    api.getDecks()
      .then((data) => {
        if (active) {
          setDecks(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

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

  if (loadError && decks.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Layers}
          title="Could not load your decks"
          hint="Check your connection and try again — nothing was deleted."
          actionLabel="Retry"
          onAction={() => void load()}
        />
        <CreateDeckDialog
          open={createOpen}
          onOpenChange={(v) => {
            setCreateOpen(v)
            if (!v) setCreateParentId(null)
          }}
          initialParentId={createParentId}
          parentDecks={decks.map((d) => ({ id: d.id, name: d.name }))}
          onCreated={async (id) => {
            await load()
            if (id) navigate('library-deck', { deckId: id })
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground num">{decks.length} decks</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(true)}>
            <Tag className="h-4 w-4 mr-1 text-primary" />
            Categories
          </Button>
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              setCreateParentId(null)
              setCreateOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New deck
          </Button>
        </div>
      </div>

      {rootDecks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No decks yet"
          hint="A deck is just a group of words. Create one for whatever you are reading this week."
          actionLabel="Create your first deck"
          onAction={() => {
            setCreateParentId(null)
            setCreateOpen(true)
          }}
        />
      ) : (
        <motion.ul variants={v(stagger(0.03))} initial="hidden" animate="show" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {rootDecks.map((deck) => {
            const children = subDecksByParent.get(deck.id) ?? []
            const isExpanded = expandedDeckIds.has(deck.id)
            return (
              <motion.li key={deck.id} variants={v(listItem)} transition={t()}>
                <div className="surface lift group flex h-full flex-col justify-between p-4.5 rounded-xl border border-border/80 bg-card hover:border-primary-line hover:shadow-md transition-all duration-200">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        data-testid={`deck-card-${deck.id}`}
                        onClick={() => navigate('library-deck', { deckId: deck.id })}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="block truncate text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {deck.name}
                          </span>
                          {deck.isCustom ? (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 text-muted-foreground border-border/60">
                              Custom
                            </Badge>
                          ) : (
                            <Badge variant="soft" className="text-[10px] py-0 px-1.5 shrink-0 bg-primary-soft text-primary font-semibold">
                              Curated
                            </Badge>
                          )}
                          {children.length > 0 ? (
                            <Badge variant="soft" className="text-[10px] py-0 px-1.5 shrink-0 bg-primary/10 text-primary font-medium flex items-center gap-1">
                              <FolderTree className="h-3 w-3" />
                              {children.length} sub-deck{children.length === 1 ? '' : 's'}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="mt-1.5 block text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {deck.description || (deck.isCustom ? 'Personal study collection.' : 'Standard vocabulary deck.')}
                        </span>
                      </button>
                      {deck.isCustom ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive-soft transition-colors cursor-pointer" aria-label={`Delete ${deck.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete “{deck.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the deck and its words{children.length > 0 ? ` plus its ${children.length} sub-deck(s)` : ''}. Progress on those words is
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
                  </div>

                  <div>
                    {isExpanded && children.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                          Sub-decks ({children.length})
                        </span>
                        <div className="space-y-1">
                          {children.map((sub) => (
                            <div
                              key={sub.id}
                              onClick={() => navigate('library-deck', { deckId: sub.id })}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted/80 hover:border-primary-line border border-transparent transition-all cursor-pointer group"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {sub.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground num">
                                  {sub.wordCount} words
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground num flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-primary/70" />
                        {deck.wordCount} words
                        {children.length > 0 && deck.directWordCount !== undefined && deck.directWordCount !== deck.wordCount ? (
                          <span className="font-normal text-muted-foreground/70">({deck.directWordCount} direct)</span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCreateParentId(deck.id)
                            setCreateOpen(true)
                          }}
                          className="h-8 px-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                          title="Create a sub-deck under this deck"
                        >
                          <FolderPlus className="h-3.5 w-3.5 mr-1 text-primary" />
                          Sub-deck
                        </Button>
                        {children.length > 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(deck.id)
                            }}
                            className="h-8 px-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                            title={isExpanded ? 'Hide sub-decks' : 'Show sub-decks'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 mr-1" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 mr-1" />
                            )}
                            {children.length}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDictationDeckId(deck.id)
                            navigate('dictation')
                          }}
                          className="h-8 px-2 text-xs font-medium cursor-pointer"
                          title={`Practice listening on ${deck.name}`}
                        >
                          <Ear className="h-3.5 w-3.5 mr-1 text-primary" />
                          Dictate
                        </Button>
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => navigate('library-deck', { deckId: deck.id })}
                          className="h-8 px-2.5 text-xs font-medium cursor-pointer"
                        >
                          Open deck
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.li>
            )
          })}
        </motion.ul>
      )}

      <CreateDeckDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v)
          if (!v) setCreateParentId(null)
        }}
        initialParentId={createParentId}
        parentDecks={decks.map((d) => ({ id: d.id, name: d.name }))}
        onCreated={async (id) => {
          await load()
          if (id) navigate('library-deck', { deckId: id })
        }}
      />

      <ManageCategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        onCategoriesChanged={() => void load()}
      />
    </div>
  )
}

function CreateDeckDialog({
  open,
  onOpenChange,
  onCreated,
  initialParentId = null,
  parentDecks = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id?: string) => void
  initialParentId?: string | null
  parentDecks?: { id: string; name: string }[]
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [csv, setCsv] = useState('')
  const [parentId, setParentId] = useState<string>(initialParentId ?? '')
  const [creating, setCreating] = useState(false)
  const [fileError, setFileError] = useState('')
  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : []), [csv])

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => { setParentId(initialParentId ?? '') }, 0)
      return () => window.clearTimeout(id)
    }
  }, [open, initialParentId])

  const nameError =
    name.trim().length > 0 && name.trim().length < 2
      ? 'Use at least 2 characters.'
      : name.trim().length > 200
        ? 'Keep the name under 200 characters.'
        : ''

  const reset = () => {
    setName('')
    setDescription('')
    setCsv('')
    setFileError('')
    setParentId(initialParentId ?? '')
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError('')
    if (file.size > 1024 * 1024) {
      setFileError('That file is over 1 MB — paste a smaller list instead.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setFileError('Could not read that file. Try pasting the text instead.')
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(file)
  }

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Give the deck a name first.')
      return
    }
    if (name.trim().length < 2 || name.trim().length > 200) return
    if (parsed.length > 1000) {
      toast.error('At most 1000 words per deck at creation — split the list and import the rest after.')
      return
    }
    setCreating(true)
    try {
      const words = parsed.map((w) => ({ ...w, categories: splitCategoryNames(w.categories) }))
      const result = await api.createCustomDeck(name.trim(), description.trim(), words, parentId || undefined)
      if (result.skipped && result.skipped > 0) {
        toast.success(`Deck created with ${result.count} words, ${result.skipped} duplicate rows skipped`)
      } else {
        toast.success(
          result.count
            ? `Deck created with ${result.count} word${result.count === 1 ? '' : 's'}`
            : 'Deck created'
        )
      }
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
    <Dialog open={open} onOpenChange={(v) => { if (!v && creating) { toast.error('Deck is still being created — please wait.'); return } onOpenChange(v) }}>
      <DialogContent className="max-w-2xl" onEscapeKeyDown={(e) => { if (creating) e.preventDefault() }} onPointerDownOutside={(e) => { if (creating) e.preventDefault() }}>
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
          {parentDecks.length > 0 && (
            <div>
              <Label htmlFor="deck-parent">Parent deck (optional)</Label>
              <select
                id="deck-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">None (top-level deck)</option>
                {parentDecks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="deck-description">Description (optional)</Label>
            <Input
              id="deck-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chapter 3 vocabulary"
              maxLength={2000}
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
              {parsed.length > 1000
                ? `${parsed.length} words — over the 1000-word limit`
                : parsed.length ? `${parsed.length} words ready` : 'CSV or tab-separated'}
            </span>
          </div>
          {fileError ? (
            <p className="text-xs font-medium text-destructive" role="alert">{fileError}</p>
          ) : null}
          {csv.trim() && parsed.length === 0 ? (
            <p className="text-xs font-medium text-amber-600" role="status">
              No valid rows found — every line was empty or a header. Check the format above.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={creating || !name.trim() || !!nameError}>
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
  const [resultsFor, setResultsFor] = useState('')
  const [selected, setSelected] = useState<WordDTO | null>(null)
  const [cefrFilter, setCefrFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [posFilter, setPosFilter] = useState<'all' | 'noun' | 'verb' | 'adj' | 'adv'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [onlyStarred, setOnlyStarred] = useState(false)
  const [bookmarkedList, setBookmarkedList] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.getCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const syncBookmarks = () => {
      try {
        const raw = localStorage.getItem('lexilearn-bookmarked-words')
        if (raw) setBookmarkedList(JSON.parse(raw))
        else setBookmarkedList([])
      } catch {}
    }
    syncBookmarks()
    window.addEventListener('lexilearn-bookmarks-changed', syncBookmarks)
    return () => window.removeEventListener('lexilearn-bookmarks-changed', syncBookmarks)
  }, [])

  const query = searchQuery
  const trimmed = query.trim()
  const pending = !!trimmed && resultsFor !== trimmed

  useEffect(() => {
    if (!trimmed) {
      // Deferred so the effect body never sets state synchronously
      // (react-hooks/set-state-in-effect).
      const id = window.setTimeout(() => {
        setResults([])
        setResultsFor('')
        setSelected(null)
      }, 0)
      return () => window.clearTimeout(id)
    }
    let cancelled = false
    const id = window.setTimeout(async () => {
      try {
        const list = await api.searchWords(trimmed)
        if (cancelled) return
        setResults(list)
      } catch {
        if (cancelled) return
        /* offline: keep the last results */
      } finally {
        if (!cancelled) setResultsFor(trimmed)
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [trimmed])

  const filteredResults = useMemo(() => {
    return results.filter((w) => {
      if (cefrFilter !== 'all' && (!w.cefr || !w.cefr.toUpperCase().startsWith(cefrFilter))) return false
      if (posFilter !== 'all' && posKey(w.pos) !== posFilter) return false
      if (categoryFilter !== 'all' && !w.categories?.some((c) => c.id === categoryFilter || c.name.toLowerCase() === categoryFilter.toLowerCase())) return false
      if (onlyStarred && !bookmarkedList.includes(w.word.toLowerCase())) return false
      return true
    })
  }, [results, cefrFilter, posFilter, categoryFilter, onlyStarred, bookmarkedList])

  // A selection that no longer matches the filtered list falls back to the
  // first result — derived, so no effect needs to clear it synchronously.
  const selectedValid = selected && filteredResults.some((w) => w.id === selected.id) ? selected : null
  const activeWord = selectedValid ?? filteredResults[0] ?? null

  // Keep the highlighted row visible while arrow-navigating.
  useEffect(() => {
    if (!activeWord || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-word-id="${activeWord.id}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeWord])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) {
        e.preventDefault()
        setSearchQuery('')
        setSelected(null)
      }
      return
    }
    if (e.key === 'Enter' && activeWord) {
      e.preventDefault()
      setSelected(activeWord)
      playSound('tap')
      return
    }
    if (filteredResults.length === 0) return
    const currentIdx = activeWord ? filteredResults.findIndex((w) => w.id === activeWord.id) : -1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = currentIdx < 0 ? 0 : Math.min(filteredResults.length - 1, currentIdx + 1)
      setSelected(filteredResults[nextIdx])
      playSound('tap')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIdx = currentIdx < 0 ? 0 : Math.max(0, currentIdx - 1)
      setSelected(filteredResults[prevIdx])
      playSound('tap')
    }
  }

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
          onKeyDown={handleKeyDown}
          placeholder="Search your dictionary… (↑/↓ to navigate)"
          aria-label="Search your dictionary"
          autoComplete="off"
          spellCheck={false}
          className="h-11 pl-9 pr-9 shadow-2xs"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSelected(null)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Filter Chips Bar */}
      {results.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Level:</span>
          {(['all', 'A', 'B', 'C'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setCefrFilter(lvl)}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium transition-all cursor-pointer',
                cefrFilter === lvl
                  ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {lvl === 'all' ? 'All' : `${lvl}-Level`}
            </button>
          ))}

          <div className="h-3.5 w-px bg-border/80 mx-1 hidden sm:block" />

          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">Type:</span>
          {(['all', 'noun', 'verb', 'adj', 'adv'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosFilter(pos)}
              aria-pressed={posFilter === pos}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium transition-all cursor-pointer',
                posFilter === pos
                  ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {pos === 'all' ? 'All' : pos === 'adj' ? 'Adjective' : pos === 'adv' ? 'Adverb' : pos.charAt(0).toUpperCase() + pos.slice(1)}
            </button>
          ))}

          <div className="h-3.5 w-px bg-border/80 mx-1" />

          <button
            type="button"
            onClick={() => setOnlyStarred(!onlyStarred)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-all cursor-pointer',
              onlyStarred
                ? 'bg-amber-500 text-white font-semibold shadow-2xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Star className={cn('h-3 w-3', onlyStarred && 'fill-current')} />
            <span>Starred</span>
          </button>

          {categories.length > 0 && (
            <>
              <div className="h-3.5 w-px bg-border/80 mx-1 hidden sm:block" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">Category:</span>
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-6 rounded-md border border-border/80 bg-muted/60 px-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer focus:outline-hidden"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.wordCount})
                  </option>
                ))}
              </select>
            </>
          )}

          <span className="ml-auto text-xs text-muted-foreground num" role="status">
            {filteredResults.length} {filteredResults.length === 1 ? 'word' : 'words'}
            {results.length >= 50 ? ' (top 50 — refine your search)' : ''}
          </span>
        </div>
      ) : null}

      {pending ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !query.trim() ? (
        <EmptyState
          icon={BookOpen}
          title="Look up any word you have added"
          hint="Search works entirely offline — it matches words in your local dictionary."
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
      ) : filteredResults.length === 0 ? (
        <div className="surface p-6 text-center space-y-2 rounded-xl border border-dashed border-border/70">
          <p className="text-sm font-semibold text-foreground">No words match the selected filters.</p>
          {onlyStarred && bookmarkedList.length === 0 ? (
            <p className="text-xs text-muted-foreground">Star words with the ☆ button to build a favorites list first.</p>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCefrFilter('all')
              setPosFilter('all')
              setCategoryFilter('all')
              setOnlyStarred(false)
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          {/* Laptop Widescreen Split-Pane Layout */}
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6 items-start">
            <div ref={listRef} role="listbox" aria-label="Dictionary results" className="lg:col-span-5 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredResults.map((word) => {
                const isSelected = activeWord?.id === word.id
                return (
                  <div
                    key={word.id}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    data-word-id={word.id}
                    className={cn(
                      'surface flex items-center gap-1 p-2 transition-all duration-150 cursor-pointer',
                      isSelected ? 'border-primary ring-1 ring-primary/40 bg-primary-soft/40 shadow-xs' : 'hover:border-primary-line'
                    )}
                    onClick={() => {
                      playSound('tap')
                      setSelected(word)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        playSound('tap')
                        setSelected(word)
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1 px-1.5 py-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{word.word}</span>
                        {word.pos ? (
                          <span className={cn(
                            'text-[11px] px-1.5 py-0.2 rounded border font-medium lowercase',
                            word.pos.includes('noun') && 'badge-noun',
                            word.pos.includes('verb') && 'badge-verb',
                            word.pos.includes('adj') && 'badge-adj',
                            word.pos.includes('adv') && 'badge-adv',
                            !word.pos.match(/noun|verb|adj|adv/) && 'border-border/60 text-muted-foreground'
                          )}>
                            {word.pos}
                          </span>
                        ) : null}
                        {word.cefr ? (
                          <Badge variant="outline" className="font-mono text-xs px-1.5 py-0">
                            {word.cefr}
                          </Badge>
                        ) : null}
                      </div>
                      {word.definitions[0] ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {word.definitions[0].text}
                        </span>
                      ) : null}
                      {word.categories && word.categories.length > 0 ? (
                        <div className="mt-1">
                          <CategoryBadgeList categories={word.categories} max={2} />
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Hear ${word.word}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!speak(word.word)) toast.error('Pronunciation is unavailable in this browser.')
                      }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="lg:col-span-7 sticky top-6">
              {activeWord ? <WordCard key={activeWord.id} word={activeWord} autoSpeak={false} /> : null}
            </div>
          </div>

          {/* Mobile / Narrow Screen Drill-down View */}
          <div className="lg:hidden space-y-3">
            {selected ? (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to results
                </Button>
                <WordCard key={selected.id} word={selected} autoSpeak={false} />
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredResults.map((word) => (
                  <li key={word.id} className="surface flex items-center gap-1 p-2 transition-colors duration-150 hover:border-primary-line">
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
        </>
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [subDeckCreateOpen, setSubDeckCreateOpen] = useState(false)
  const [editing, setEditing] = useState<(WordDTO & { id: string }) | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; word: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { v, t } = useMotionSafe()

  const refreshCategories = useCallback(async () => {
    try {
      setCategories(await api.getCategories())
    } catch {}
  }, [])

  useEffect(() => {
    void refreshCategories()
  }, [refreshCategories])

  const loadSeqRef = useRef(0)
  const load = useCallback(async () => {
    if (!deckId) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const detail = await api.getDeck(deckId)
      if (loadSeqRef.current === seq) setDeck(detail)
    } catch {
      if (loadSeqRef.current === seq) toast.error('Could not load that deck')
    } finally {
      if (loadSeqRef.current === seq) setLoading(false)
    }
  }, [deckId])

  useEffect(() => {
    if (!deckId) return
    void load()
  }, [load, deckId])

  const words = useMemo(() => {
    if (!deck) return []
    let list = deck.words
    if (categoryFilter !== 'all') {
      list = list.filter((w) =>
        w.categories?.some((c) => c.id === categoryFilter || c.name.toLowerCase() === categoryFilter.toLowerCase())
      )
    }
    const term = filter.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (w) =>
        w.word.toLowerCase().includes(term) ||
        (w.definitions[0]?.text ?? '').toLowerCase().includes(term) ||
        (w.amharic ?? '').toLowerCase().includes(term) ||
        (w.examples[0] ?? '').toLowerCase().includes(term)
    )
  }, [deck, filter, categoryFilter])

  const removeWord = async (wordId: string) => {
    const prev = deck
    // Optimistic removal keeps filter + scroll position; reload reconciles.
    if (prev) setDeck({ ...prev, words: prev.words.filter((w) => w.id !== wordId) })
    setDeleting(true)
    try {
      await api.deleteWord(wordId)
      toast.success('Word removed')
      await load()
    } catch {
      if (prev) setDeck(prev)
      toast.error('Could not remove that word')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
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
        hint="It may have been deleted — or loading failed. Your other decks are untouched."
        actionLabel="Retry"
        onAction={() => {
          void load()
        }}
        secondary={
          <Button variant="ghost" size="sm" onClick={() => navigate('library', { libraryTab: 'decks' })}>
            Back to library
          </Button>
        }
      />
    )
  }

  const mastered = deck.words.filter((w) => w.srs?.status === 'mastered').length

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <nav aria-label="Deck hierarchy" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <button
          type="button"
          onClick={() => navigate('library', { libraryTab: 'decks' })}
          className="hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Decks
        </button>
        {deck.ancestors?.map((anc) => (
          <span key={anc.id} className="inline-flex items-center gap-1.5">
            <span className="opacity-40">/</span>
            <button
              type="button"
              onClick={() => navigate('library-deck', { deckId: anc.id })}
              className="hover:text-foreground transition-colors truncate max-w-40 cursor-pointer"
            >
              {anc.name}
            </button>
          </span>
        ))}
        <span className="opacity-40">/</span>
        <span className="text-foreground font-semibold truncate max-w-48">{deck.name}</span>
      </nav>

      <PageHeader
        eyebrow={deck.isCustom ? 'Custom deck' : 'Curated deck'}
        icon={Layers}
        title={deck.name}
        description={
          deck.description ||
          `${deck.words.length} direct words · ${mastered} mastered${deck.subDecks && deck.subDecks.length > 0 ? ` · ${deck.subDecks.length} sub-deck${deck.subDecks.length === 1 ? '' : 's'}` : ''}`
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSubDeckCreateOpen(true)}>
              <FolderPlus className="h-4 w-4" />
              Sub-deck
            </Button>
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

      {deck.subDecks && deck.subDecks.length > 0 && (
        <div className="space-y-2.5 rounded-lg border border-border/70 bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sub-decks ({deck.subDecks.length})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => setSubDeckCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add sub-deck
            </Button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {deck.subDecks.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => navigate('library-deck', { deckId: sub.id })}
                className="group flex flex-col text-left rounded-md border border-border bg-card p-3 shadow-xs transition-all hover:border-primary-line hover:shadow-sm cursor-pointer"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {sub.name}
                  </span>
                  <Badge variant="soft" className="shrink-0 text-xs">
                    {sub.wordCount} {sub.wordCount === 1 ? 'word' : 'words'}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {deck.words.length === 0 ? (
        <EmptyState
          icon={Plus}
          title={deck.subDecks && deck.subDecks.length > 0 ? "No direct words in this deck" : "This deck is empty"}
          hint={
            deck.subDecks && deck.subDecks.length > 0
              ? "Words in sub-decks are included automatically during study sessions. You can also add words directly to this deck."
              : "Add words one at a time, paste a whole list to import, or add sub-decks to organize topics."
          }
          actionLabel="Add direct word"
          onAction={() => setAddOpen(true)}
          secondary={
            deck.subDecks && deck.subDecks.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setBulkOpen(true)}>
                Import a list instead
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setSubDeckCreateOpen(true)}>
                Create a sub-deck
              </Button>
            )
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
            {categories.length > 0 && (
              <select
                aria-label="Filter deck by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer focus:outline-hidden"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
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
              onAction={() => {
                setFilter('')
                setCategoryFilter('all')
              }}
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
                      {word.categories && word.categories.length > 0 ? (
                        <div className="mt-1.5">
                          <CategoryBadgeList categories={word.categories} max={3} />
                        </div>
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
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${word.word}`}
                        onClick={() => setDeleteTarget({ id: word.id, word: word.word })}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <NextStep
              title="Study new words"
              hint="Learn pulls from all decks — spaced repetition decides what to show."
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{deleteTarget?.word}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its review history goes with it. Other words in this deck are untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep word</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => { if (deleteTarget) void removeWord(deleteTarget.id) }}
            >
              {deleting ? 'Removing…' : 'Remove word'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WordFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={async () => {
          await load()
          void refreshCategories()
        }}
        deckId={deck.id}
      />
      <WordFormDialog
        key={editing?.id ?? 'closed'}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={async () => {
          await load()
          void refreshCategories()
        }}
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
                categories: editing.categories ?? [],
              }
            : undefined
        }
      />
      <BulkAddWordsDialog
        deckId={deck.id}
        deckName={deck.name}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onImported={async () => {
          await load()
          void refreshCategories()
        }}
      />
      <CreateDeckDialog
        open={subDeckCreateOpen}
        onOpenChange={setSubDeckCreateOpen}
        initialParentId={deck.id}
        parentDecks={[{ id: deck.id, name: deck.name }]}
        onCreated={async (id) => {
          await load()
          if (id) navigate('library-deck', { deckId: id })
        }}
      />
    </div>
  )
}
