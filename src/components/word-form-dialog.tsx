'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (open) {
      setWord(initialValues?.word ?? '')
      setPos(initialValues?.pos ?? '')
      setIpa(initialValues?.ipa ?? '')
      setDefinition(initialValues?.definition ?? '')
      setExample(initialValues?.example ?? '')
      setCefr(initialValues?.cefr ?? '')
      setSynonyms(initialValues?.synonyms ?? '')
      setAntonyms(initialValues?.antonyms ?? '')
      setAmharic(initialValues?.amharic ?? '')
    }
  }, [open, initialValues])

  const handleSave = async () => {
    if (!isEdit && !word.trim()) {
      toast.error('Word is required')
      return
    }
    setSaving(true)
    try {
      const fields = { pos: pos || undefined, ipa: ipa || undefined, definition: definition || undefined, example: example || undefined, cefr: cefr || undefined, synonyms: synonyms || undefined, antonyms: antonyms || undefined, amharic: amharic || undefined }
      if (isEdit) {
        await api.updateWord(initialValues.id!, fields)
        toast.success('Word updated')
      } else {
        const w = word.trim().toLowerCase()
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Input id="wf-cefr" value={cefr} onChange={(e) => setCefr(e.target.value)} placeholder="C1" />
            </div>
            <div>
              <Label htmlFor="wf-synonyms">Synonyms (comma-separated)</Label>
              <Input id="wf-synonyms" value={synonyms} onChange={(e) => setSynonyms(e.target.value)} placeholder="luck, fortune" />
            </div>
          </div>
          <div>
            <Label htmlFor="wf-antonyms">Antonyms (comma-separated)</Label>
            <Input id="wf-antonyms" value={antonyms} onChange={(e) => setAntonyms(e.target.value)} placeholder="misfortune" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add word'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
