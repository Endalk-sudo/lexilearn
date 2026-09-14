'use client'

import { useEffect, useState } from 'react'
import { api, type WordDTO } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search as SearchIcon, Volume2, ArrowLeft, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { WordCard } from '@/components/word/word-card'
import { speak } from '@/lib/tts'

export function SearchView() {
  const { searchQuery, navigate } = useAppStore()
  const [query, setQuery] = useState(searchQuery)
  const [results, setResults] = useState<WordDTO[]>([])
  const [selected, setSelected] = useState<WordDTO | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    let mounted = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await api.searchWords(query)
        if (mounted) setResults(r)
      } catch (e) {
        console.error(e)
      } finally {
        if (mounted) setLoading(false)
      }
    }, 200)
    return () => {
      mounted = false
      clearTimeout(t)
    }
  }, [query])

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to dashboard
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dictionary Search</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Look up any word in your local dictionary.</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a word…"
          className="pl-9 h-11"
          autoFocus
        />
      </div>

      {selected ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to results
          </Button>
          <WordCard word={selected} showDefinition />
        </div>
      ) : (
        <>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              Searching…
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No words found matching &ldquo;{query}&rdquo;.
                </p>
              </CardContent>
            </Card>
          )}
          {!loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map((w) => (
                <Card
                  key={w.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => setSelected(w)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{w.word}</h3>
                        {w.pos && <span className="text-xs italic text-muted-foreground">{w.pos}</span>}
                        {w.cefr && <Badge variant="outline" className="text-[10px] font-mono">{w.cefr}</Badge>}
                      </div>
                      {w.ipa && <p className="text-xs font-mono text-muted-foreground mt-0.5">{w.ipa}</p>}
                      {w.definitions[0] && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{w.definitions[0].text}</p>
                      )}
                      {w.amharic && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">አማርኛ: {w.amharic}</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!speak(w.word)) toast.error('TTS not available')
                      }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
