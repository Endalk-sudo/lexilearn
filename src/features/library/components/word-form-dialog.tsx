'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

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
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
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
  const [saving, setSaving] = useState(false)
  const [cefrError, setCefrError] = useState('')

  // Reset in the close event (rather than an effect) to keep the lint rule
  // react-hooks/set-state-in-effect happy. The edit instance additionally
  // remounts per word via `key={editing?.id}`, so the first painted frame
  // already shows this word's values — no stale flash.
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
    setCefrError('')
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm()
    onOpenChange(v)
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
      const fields = { pos: pos || undefined, ipa: ipa || undefined, definition: definition || undefined, example: example || undefined, cefr: cefrNorm || undefined, synonyms: synonyms || undefined, antonyms: antonyms || undefined, amharic: amharic || undefined }
      if (isEdit) {
        await api.updateWord(initialValues.id!, fields)
        toast.success('Word updated')
      } else {
        // Preserve the user's casing for display; dedupe stays
        // case-insensitive on the server.
        const w = word.trim()
        await api.addWord(deckId, { word: w, ...fields })
        toast.success('Word added')
      }
      onOpenChange(false)
      onSaved()
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
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {!isEdit && (
            <div>
              <Label htmlFor="wf-word">Word</Label>
              <Input id="wf-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="serendipity" />
            </div>
          )}
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
