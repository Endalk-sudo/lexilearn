'use client'

import { useState, useEffect } from 'react'
import { api, type CategorySummary, type CategoryDTO, type WordDTO } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tag, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getCategoryStyle } from './category-badge'
import { cn } from '@/lib/utils'

type WordValues = {
  word?: string
  pos?: string
  ipa?: string
  definition?: string
  example?: string
  cefr?: string
  synonyms?: string
  antonyms?: string
  amharic?: string
  categories?: CategoryDTO[]
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  /**
   * Receives the saved word when editing, so a paged deck list can patch that
   * one row in place instead of refetching (which would reset to page 1).
   * Undefined when adding — a new word is not in any loaded page yet.
   */
  onSaved: (saved?: WordDTO) => void
  deckId: string
  initialValues?: WordValues & { id?: string }
}

export function WordFormDialog({ open, onOpenChange, onSaved, deckId, initialValues }: Props) {
  const isEdit = !!initialValues?.id
  const [word, setWord] = useState(initialValues?.word ?? '')
  const [pos, setPos] = useState(initialValues?.pos ?? '')
  const [ipa, setIpa] = useState(initialValues?.ipa ?? '')
  const [definition, setDefinition] = useState(initialValues?.definition ?? '')
  const [example, setExample] = useState(initialValues?.example ?? '')
  const [cefr, setCefr] = useState(initialValues?.cefr ?? '')
  const [synonyms, setSynonyms] = useState(initialValues?.synonyms ?? '')
  const [antonyms, setAntonyms] = useState(initialValues?.antonyms ?? '')
  const [amharic, setAmharic] = useState(initialValues?.amharic ?? '')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialValues?.categories?.map((c) => c.id) ?? []
  )
  const [allCategories, setAllCategories] = useState<CategorySummary[]>([])
  const [newCatInput, setNewCatInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [cefrError, setCefrError] = useState('')

  useEffect(() => {
    if (open) {
      void api.getCategories().then(setAllCategories).catch(() => {})
    }
  }, [open])

  const resetForm = () => {
    setWord(initialValues?.word ?? '')
    setPos(initialValues?.pos ?? '')
    setIpa(initialValues?.ipa ?? '')
    setDefinition(initialValues?.definition ?? '')
    setExample(initialValues?.example ?? '')
    setCefr(initialValues?.cefr ?? '')
    setSynonyms(initialValues?.synonyms ?? '')
    setAntonyms(initialValues?.antonyms ?? '')
    setAmharic(initialValues?.amharic ?? '')
    setSelectedCategoryIds(initialValues?.categories?.map((c) => c.id) ?? [])
    setNewCatInput('')
    setCefrError('')
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm()
    onOpenChange(v)
  }

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleAddNewCategory = async () => {
    const trimmed = newCatInput.trim()
    if (!trimmed) return
    try {
      const res = await api.createCategory(trimmed)
      const updatedList = await api.getCategories()
      setAllCategories(updatedList)
      setSelectedCategoryIds((prev) => [...prev, res.id])
      setNewCatInput('')
      toast.success(`Category "${trimmed}" created`)
    } catch {
      toast.error('Failed to create category')
    }
  }

  const handleSave = async () => {
    if (!isEdit && !word.trim()) {
      toast.error('Word is required')
      return
    }
    const cefrNorm = cefr.trim().toUpperCase()
    if (cefrNorm && !/^(A1|A2|B1|B2|C1|C2)$/.test(cefrNorm)) {
      setCefrError('Use a CEFR level like A1, B2 or C1 — or leave it blank.')
      return
    }
    setCefrError('')
    setSaving(true)
    try {
      const fields = {
        pos: pos || undefined,
        ipa: ipa || undefined,
        definition: definition || undefined,
        example: example || undefined,
        cefr: cefrNorm || undefined,
        synonyms: synonyms || undefined,
        antonyms: antonyms || undefined,
        amharic: amharic || undefined,
        categoryIds: selectedCategoryIds,
      }
      if (isEdit) {
        const res = await api.updateWord(initialValues.id!, fields)
        toast.success('Word updated')
        onOpenChange(false)
        onSaved(res.word)
      } else {
        const w = word.trim()
        await api.addWord(deckId, { word: w, ...fields })
        toast.success('Word added')
        onOpenChange(false)
        onSaved()
      }
    } catch {
      toast.error(isEdit ? 'Failed to update word' : 'Failed to add word')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit word' : 'Add word'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
          {!isEdit && (
            <div>
              <Label htmlFor="wf-word">Word</Label>
              <Input id="wf-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="serendipity" />
            </div>
          )}

          {/* Categories Selector */}
          <div>
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              Categories / Topics
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {allCategories.map((c) => {
                const selected = selectedCategoryIds.includes(c.id)
                const style = getCategoryStyle(c.color)
                return (
                  <Badge
                    key={c.id}
                    variant="outline"
                    onClick={() => toggleCategory(c.id)}
                    className={cn(
                      'text-xs py-0.5 px-2 cursor-pointer transition-all inline-flex items-center gap-1',
                      selected
                        ? `${style} ring-1.5 ring-primary font-semibold shadow-xs`
                        : 'opacity-60 hover:opacity-100 border-border/80 text-muted-foreground'
                    )}
                  >
                    {selected && <Check className="h-3 w-3 shrink-0" />}
                    <span>{c.name}</span>
                  </Badge>
                )
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Input
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="New category name…"
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddNewCategory()
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="soft"
                className="h-7 text-xs px-2"
                onClick={() => void handleAddNewCategory()}
                disabled={!newCatInput.trim()}
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Add tag
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wf-pos">Part of speech</Label>
              <Input id="wf-pos" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="noun" />
            </div>
            <div>
              <Label htmlFor="wf-ipa">IPA</Label>
              <Input id="wf-ipa" value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="/ˌsɛrənˈdɪpɪti/" className="font-mono" />
            </div>
          </div>
          <div>
            <Label htmlFor="wf-def">Definition</Label>
            <Input id="wf-def" value={definition} onChange={(e) => setDefinition(e.target.value)} placeholder="a happy accident" />
            {!isEdit && !definition.trim() ? (
              <p className="mt-1 text-xs text-muted-foreground">Tip: words without a definition are hidden from quizzes.</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="wf-amharic">Amharic definition (አማርኛ)</Label>
            <Textarea id="wf-amharic" value={amharic} onChange={(e) => setAmharic(e.target.value)} placeholder="ድንገተኛ ደስታ" className="min-h-[60px]" />
          </div>
          <div>
            <Label htmlFor="wf-example">Example</Label>
            <Textarea id="wf-example" value={example} onChange={(e) => setExample(e.target.value)} placeholder="Finding that old letter was pure serendipity." className="min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="wf-cefr">CEFR level</Label>
              <Input id="wf-cefr" value={cefr} onChange={(e) => { setCefr(e.target.value); setCefrError('') }} placeholder="C1" aria-invalid={!!cefrError} aria-describedby={cefrError ? 'wf-cefr-error' : undefined} className="uppercase" />
              {cefrError ? (
                <p id="wf-cefr-error" className="mt-1.5 text-xs font-medium text-destructive">{cefrError}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="wf-synonyms">Synonyms (| or , separated)</Label>
              <Input id="wf-synonyms" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} placeholder="luck | fortune" />
            </div>
          </div>
          <div>
            <Label htmlFor="wf-antonyms">Antonyms (| or , separated)</Label>
            <Input id="wf-antonyms" value={antonyms} onChange={(e) => setAntonyms(e.target.value)} placeholder="misfortune" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add word'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
