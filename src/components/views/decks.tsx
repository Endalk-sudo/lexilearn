'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, type DeckSummary, type DeckDetail, type WordDTO, type SrsCardDTO } from '@/lib/api'

// Import these from @/lib/api instead of redeclaring locally
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Trash2, ArrowLeft, BookOpen, Upload, BrainCircuit, Pencil, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BulkAddWordsDialog } from '@/components/bulk-add-words-dialog'
import { WordFormDialog } from '@/components/word-form-dialog'
import { parseCsv, CSV_FORMAT_HINT, CSV_PLACEHOLDER } from '@/lib/csv-parser'

export function DecksView() {
  const [decks, setDecks] = useState<DeckSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useAppStore((s) => s.navigate)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.getDecks()
      setDecks(list)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Word Decks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browse pre-built lists or create your own.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New deck
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((d) => (
          <Card
            key={d.id}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate('deck-detail', { deckId: d.id })}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold">{d.name}</div>
                  {d.isCustom && <Badge variant="secondary" className="text-[10px] mt-1">Custom</Badge>}
                </div>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {d.description || 'No description'}
              </p>
              <div className="mt-3 text-xs text-muted-foreground">
                {d.wordCount} words
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateDeckDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} />
    </div>
  )
}

export function DeckDetailView() {
  const { activeDeckId, navigate } = useAppStore()
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [showWordForm, setShowWordForm] = useState(false)
  const [editingWord, setEditingWord] = useState<DeckDetail['words'][0] | null>(null)
  const [deletingWord, setDeletingWord] = useState<DeckDetail['words'][0] | null>(null)

  const loadDeck = useCallback(async () => {
    if (!activeDeckId) return
    try {
      const d = await api.getDeck(activeDeckId)
      setDeck(d)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [activeDeckId])

  useEffect(() => {
    if (!activeDeckId) {
      navigate('decks')
      return
    }
    setLoading(true)
    loadDeck()
  }, [activeDeckId, navigate, loadDeck])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (!deck) return null

  const mastered = deck.words.filter((w) => w.srs?.status === 'mastered').length
  const learning = deck.words.filter((w) => w.srs?.status === 'learning').length
  const reviewing = deck.words.filter((w) => w.srs?.status === 'reviewing').length
  const fresh = deck.words.filter((w) => !w.srs).length

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('decks')}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> All decks
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{deck.name}</h1>
            {deck.isCustom && <Badge variant="secondary">Custom</Badge>}
          </div>
          {deck.description && <p className="text-sm text-muted-foreground mt-1">{deck.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulkAdd(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add words
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('review', { deckId: deck.id })}>
            <BrainCircuit className="h-4 w-4 mr-1.5" /> Review this deck
          </Button>
          {deck.isCustom && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{deck.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the deck and all {deck.words.length} words in it. Your SRS progress for these words will also be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await api.deleteDeck(deck.id)
                        toast.success(`Deck "${deck.name}" deleted`)
                        navigate('decks')
                      } catch (e) { toast.error('Failed to delete deck') }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-500">{mastered}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Mastered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-sky-500">{reviewing}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Reviewing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{learning}</div>
            <div className="text-[10px] uppercase text-muted-foreground">Learning</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{fresh}</div>
            <div className="text-[10px] uppercase text-muted-foreground">New</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk add dialog */}
      {deck && (
        <BulkAddWordsDialog
          deckId={deck.id}
          deckName={deck.name}
          open={showBulkAdd}
          onOpenChange={setShowBulkAdd}
          onImported={loadDeck}
        />
      )}

      {/* Word list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Words ({deck.words.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setEditingWord(null); setShowWordForm(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add word
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto pr-2 -mr-2 space-y-1">
            {deck.words.map((w, i) => (
              <div
                key={w.id}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{w.word}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {w.definitions[0]?.text ?? '—'}
                    </div>
                    {w.amharic && (
                      <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                        አማርኛ: {w.amharic}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {w.cefr && <Badge variant="outline" className="text-[10px] font-mono">{w.cefr}</Badge>}
                  {w.srs ? (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] capitalize',
                        w.srs.status === 'mastered' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                        w.srs.status === 'reviewing' && 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
                        w.srs.status === 'learning' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {w.srs.status}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">New</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditingWord(w); setShowWordForm(true) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => setDeletingWord(w)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Word form dialog */}
      <WordFormDialog
        open={showWordForm}
        onOpenChange={setShowWordForm}
        onSaved={loadDeck}
        deckId={deck.id}
        initialValues={editingWord ? {
          id: editingWord.id,
          word: editingWord.word,
          pos: editingWord.pos ?? undefined,
          ipa: editingWord.ipa ?? undefined,
          definition: editingWord.definitions[0]?.text,
          example: editingWord.examples[0],
          cefr: editingWord.cefr ?? undefined,
          synonyms: editingWord.synonyms.join(', '),
          antonyms: editingWord.antonyms.join(', '),
          amharic: editingWord.amharic ?? undefined,
        } : undefined}
      />

      {/* Delete word confirmation */}
      <AlertDialog open={!!deletingWord} onOpenChange={(v) => { if (!v) setDeletingWord(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingWord?.word}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this word and its SRS card. Review history for this word will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingWord) return
                try {
                  await api.deleteWord(deletingWord.id)
                  toast.success(`"${deletingWord.word}" deleted`)
                  loadDeck()
                } catch { toast.error('Failed to delete word') }
                setDeletingWord(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateDeckDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [csv, setCsv] = useState('')
  const [creating, setCreating] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(file)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a deck name')
      return
    }
    const words = parseCsv(csv)
    if (words.length === 0) {
      toast.error('Please add at least one word')
      return
    }
    setCreating(true)
    try {
      const res = await api.createCustomDeck(name.trim(), description.trim(), words)
      toast.success(`Deck created with ${res.count} words`)
      setName('')
      setDescription('')
      setCsv('')
      onOpenChange(false)
      onCreated()
    } catch {
      toast.error('Failed to create deck')
    } finally {
      setCreating(false)
    }
  }

  const parsed = csv.trim() ? parseCsv(csv) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Custom Deck</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label htmlFor="deck-name">Name</Label>
            <Input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Reading List" />
          </div>
          <div>
            <Label htmlFor="deck-desc">Description (optional)</Label>
            <Input id="deck-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Words from my reading this week" />
          </div>
          <div>
            <Label htmlFor="deck-csv">Words — one per line</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Format: <code className="px-1 py-0.5 rounded bg-muted">{CSV_FORMAT_HINT}</code>
            </p>
            <Textarea
              id="deck-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={CSV_PLACEHOLDER}
              className="font-mono text-xs min-h-[180px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="csv-file" className="cursor-pointer">
              <div className="inline-flex items-center justify-center rounded-md text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload CSV
              </div>
              <input id="csv-file" type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </Label>
            <span className="text-xs text-muted-foreground">CSV or tab-separated</span>
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="text-xs font-medium px-3 py-2 bg-muted/50 border-b">
                Preview — {parsed.length} word{parsed.length === 1 ? '' : 's'} parsed
              </div>
              <div className="max-h-48 overflow-y-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-medium">Word</th>
                      <th className="text-left px-3 py-1.5 font-medium">POS</th>
                      <th className="text-left px-3 py-1.5 font-medium">Definition</th>
                      <th className="text-left px-3 py-1.5 font-medium">IPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 20).map((w, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-1.5 font-medium">{w.word}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{w.pos ?? '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">{w.definition ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{w.ipa ?? '—'}</td>
                      </tr>
                    ))}
                    {parsed.length > 20 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-muted-foreground">
                          …and {parsed.length - 20} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || parsed.length === 0}>
            {creating ? 'Creating…' : `Create deck (${parsed.length} word${parsed.length === 1 ? '' : 's'})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
