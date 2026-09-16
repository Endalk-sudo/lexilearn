'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Volume2, BookOpen, Languages, RotateCcw, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import type { WordDTO } from '@/lib/api'

export function WordCard({ word, ttsVoice, ttsRate, showDefinition = true, compact = false, hideWord = false }: { word: WordDTO; ttsVoice?: string; ttsRate?: number; showDefinition?: boolean; compact?: boolean; hideWord?: boolean }) {
  const [revealed, setRevealed] = useState(showDefinition)
  const [showAmharic, setShowAmharic] = useState(false)
  const [hint, setHint] = useState(false)

  const handleSpeak = () => {
    const ok = speak(word.word, { voice: ttsVoice, rate: ttsRate })
    if (!ok) toast.error('TTS not available in this browser.')
  }

  return (
    <Card className="game-panel overflow-hidden rounded-3xl">
      <div className="p-5 sm:p-7">
        {!hideWord ? <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <motion.h2 layout className="break-words text-4xl font-black tracking-tight sm:text-5xl">{word.word}</motion.h2>
                {word.pos && <span className="text-sm italic text-muted-foreground">{word.pos}</span>}
              </div>
              {word.ipa && <div className="font-mono text-sm text-muted-foreground">{word.ipa}</div>}
            </div>
            <Button size="icon" variant="outline" className="rounded-xl" onClick={handleSpeak} title="Hear pronunciation"><Volume2 className="h-4 w-4" /></Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {word.cefr && <Badge variant="outline" className="font-mono">{word.cefr}</Badge>}
            {word.syllables?.length > 0 && <Badge variant="secondary" className="font-normal">{word.syllables.join(' · ')}</Badge>}
            {word.synonyms.length > 0 && <span className="text-xs text-muted-foreground">{word.synonyms.length} synonym{word.synonyms.length === 1 ? '' : 's'}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {word.amharic && <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setShowAmharic((v) => !v)}><Languages className="mr-1.5 h-3.5 w-3.5" />{showAmharic ? 'Hide አማርኛ' : 'Show አማርኛ'}</Button>}
            <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={() => setHint((v) => !v)}><Lightbulb className="mr-1.5 h-3.5 w-3.5" />{hint ? 'Hide hint' : 'Hint'}</Button>
          </div>
          <AnimatePresence>
            {showAmharic && word.amharic && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 rounded-2xl bg-primary/7 p-3 text-sm"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">አማርኛ</div>{word.amharic}</motion.div>}
            {hint && !revealed && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground"><div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground"><Lightbulb className="h-3.5 w-3.5 text-amber-500" /> First letter</div>{word.word[0]?.toUpperCase()}•••</motion.div>}
          </AnimatePresence>
        </> : <div className="min-h-24" />}

        <AnimatePresence mode="wait">
          {revealed ? <motion.div key="answer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6 space-y-5 border-t pt-5">
            {word.definitions.length > 0 && <InfoSection title="Meaning"><ul className="space-y-2">{word.definitions.map((d, i) => <li key={i} className="text-sm leading-relaxed"><span className="mr-1.5 italic text-muted-foreground">{d.pos}</span>{d.text}</li>)}</ul></InfoSection>}
            {!compact && word.examples.length > 0 && <InfoSection title="In a sentence"><div className="space-y-2">{word.examples.map((ex, i) => <div key={i} className="rounded-xl border-l-2 border-primary/40 bg-muted/35 px-3 py-2 text-sm italic leading-relaxed">{ex}</div>)}</div></InfoSection>}
            {!compact && (word.synonyms.length > 0 || word.antonyms.length > 0) && <div className="grid gap-4 sm:grid-cols-2">{word.synonyms.length > 0 && <InfoSection title="Synonyms"><div className="flex flex-wrap gap-1.5">{word.synonyms.map((s) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}</div></InfoSection>}{word.antonyms.length > 0 && <InfoSection title="Antonyms"><div className="flex flex-wrap gap-1.5">{word.antonyms.map((s) => <Badge key={s} variant="outline" className="font-normal">{s}</Badge>)}</div></InfoSection>}</div>}
            {!compact && word.etymology && <InfoSection title="Word origin"><p className="text-sm leading-relaxed text-muted-foreground">{word.etymology}</p></InfoSection>}
            {!showDefinition && <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setRevealed(false)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Hide answer</Button>}
          </motion.div> : <motion.div key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6"><Button variant="outline" onClick={() => setRevealed(true)} className="h-12 w-full rounded-xl text-sm font-semibold"><BookOpen className="mr-2 h-4 w-4" /> Reveal meaning <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">SPACE</span></Button></motion.div>}
        </AnimatePresence>
      </div>
    </Card>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><div className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{title}</div>{children}</section> }
