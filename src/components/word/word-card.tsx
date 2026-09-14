'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Volume2, BookOpen } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import type { WordDTO } from '@/lib/api'

export function WordCard({
  word,
  ttsVoice,
  ttsRate,
  showDefinition = true,
  compact = false,
  hideWord = false,
}: {
  word: WordDTO
  ttsVoice?: string
  ttsRate?: number
  showDefinition?: boolean
  compact?: boolean
  hideWord?: boolean
}) {
  const [revealed, setRevealed] = useState(showDefinition)

  const handleSpeak = () => {
    const ok = speak(word.word, { voice: ttsVoice, rate: ttsRate })
    if (!ok) toast.error('TTS not available in this browser.')
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6">
        {!hideWord && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{word.word}</h2>
                  {word.pos && (
                    <span className="text-sm text-muted-foreground italic">{word.pos}</span>
                  )}
                </div>
                {word.ipa && (
                  <div className="text-sm text-muted-foreground mt-1 font-mono">{word.ipa}</div>
                )}
              </div>
              <Button size="icon" variant="outline" onClick={handleSpeak} title="Pronounce">
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Syllables & CEFR */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {word.syllables && word.syllables.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {word.syllables.join(' · ')}
                </Badge>
              )}
              {word.cefr && (
                <Badge variant="outline" className="font-mono">{word.cefr}</Badge>
              )}
            </div>
          </>
        )}

        <AnimatePresence>
          {revealed ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 space-y-4"
            >
              {/* Definitions */}
              {word.definitions.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Definition</div>
                  <ul className="space-y-1.5">
                    {word.definitions.map((d, i) => (
                      <li key={i} className="text-sm leading-relaxed">
                        <span className="text-muted-foreground italic mr-1.5">{d.pos}</span>
                        {d.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Amharic translation */}
              {word.amharic && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="text-[10px]">አማርኛ</span>
                  </div>
                  <p className="text-sm leading-relaxed">{word.amharic}</p>
                </div>
              )}

              {!compact && word.examples.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Examples</div>
                  <ul className="space-y-1.5">
                    {word.examples.map((ex, i) => (
                      <li key={i} className="text-sm leading-relaxed border-l-2 border-primary/30 pl-3 italic">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!compact && (word.synonyms.length > 0 || word.antonyms.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {word.synonyms.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Synonyms</div>
                      <div className="flex flex-wrap gap-1">
                        {word.synonyms.map((s) => (
                          <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {word.antonyms.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Antonyms</div>
                      <div className="flex flex-wrap gap-1">
                        {word.antonyms.map((s) => (
                          <Badge key={s} variant="outline" className="font-normal">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!compact && word.etymology && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Etymology</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{word.etymology}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4"
            >
              <Button variant="outline" onClick={() => setRevealed(true)} className="w-full">
                <BookOpen className="h-4 w-4 mr-2" />
                Reveal definition
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}
