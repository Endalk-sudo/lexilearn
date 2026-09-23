'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { parseCsv, CSV_FORMAT_HINT, CSV_PLACEHOLDER, type ParsedWord } from '@/features/library/lib/csv-parser'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Upload, Plus } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  deckId: string
  deckName: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}

export function BulkAddWordsDialog({ deckId, deckName, open, onOpenChange, onImported }: Props) {
  const [csv, setCsv] = useState('')
  const [importing, setImporting] = useState(false)

  const parsed: ParsedWord[] = csv.trim() ? parseCsv(csv) : []

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (parsed.length === 0) {
      toast.error('No valid words found in CSV.')
      return
    }
    setImporting(true)
    try {
      const res = await api.addWordsToDeck(deckId, parsed)
      toast.success(`${res.count} words added to "${deckName}"`)
      setCsv('')
      onOpenChange(false)
      onImported()
    } catch {
      toast.error('Failed to import words')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add words to "{deckName}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label htmlFor="bulk-csv">Words — one per line</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              Format: <code className="px-1 py-0.5 rounded bg-muted">{CSV_FORMAT_HINT}</code>
            </p>
            <Textarea
              id="bulk-csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={CSV_PLACEHOLDER}
              className="font-mono text-xs min-h-[180px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="bulk-csv-file" className="cursor-pointer">
              <div className="inline-flex items-center justify-center rounded-md text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload CSV
              </div>
              <input id="bulk-csv-file" type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
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
                      <th className="text-left px-3 py-1.5 font-medium">አማርኛ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 20).map((w, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-1.5 font-medium">{w.word}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{w.pos ?? '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">{w.definition ?? '—'}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{w.ipa ?? '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[150px] truncate" lang="am">{w.amharic ?? '—'}</td>
                      </tr>
                    ))}
                    {parsed.length > 20 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">
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
          <Button onClick={handleImport} disabled={importing || parsed.length === 0}>
            <Plus className="h-4 w-4 mr-1.5" />
            {importing ? 'Importing…' : `Import ${parsed.length} word${parsed.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
