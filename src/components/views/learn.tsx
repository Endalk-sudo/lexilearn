'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { WordCard } from '@/components/word/word-card'
import { SpellingInput } from '@/components/word/spelling-input'
import { Volume2, Check, X, ArrowRight, RefreshCw, Sparkles, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'

type Stage = 'recall' | 'spelling' | 'graded'

export function LearnView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState<Stage>('recall')
  const [spelling, setSpelling] = useState('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [ttsVoice, setTtsVoice] = useState<string>('')
  const [ttsRate, setTtsRate] = useState<number>(1)
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [list, settings] = await Promise.all([api.getNewCards(null, 10), api.getSettings()])
        if (mounted) {
          setCards(list)
          setTtsVoice(settings.ttsVoice)
          setTtsRate(settings.ttsRate)
          setLoading(false)
        }
      } catch (e) {
        console.error(e)
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const current = cards[idx]

  const handleReveal = useCallback(() => {
    setStage('spelling')
    setSpelling('')
    // Auto-play pronunciation
    if (current) {
      const ok = speak(current.word.word, { voice: ttsVoice, rate: ttsRate })
      if (!ok) toast.error('TTS not available in this browser.')
    }
  }, [current, ttsVoice, ttsRate])

  const handleSpellingSubmit = useCallback(async () => {
    if (!current) return
    const correct = spelling.trim().toLowerCase() === current.word.word.toLowerCase()
    setIsCorrect(correct)
    setStage('graded')
    const grade: 0 | 4 = correct ? 4 : 0
    try {
      await api.submitReview(current.word.id, grade, 'learn')
      if (correct) toast.success(`+${grade === 4 ? 5 : 1} XP — ${current.word.word}`)
      else toast.error(`Misspelled — the word is "${current.word.word}"`)
    } catch (e) {
      console.error(e)
    }
  }, [current, spelling])

  const handleNext = useCallback(() => {
    if (idx + 1 >= cards.length) {
      toast.success('🎉 Learning session complete!')
      navigate('dashboard')
      return
    }
    setIdx(idx + 1)
    setStage('recall')
    setSpelling('')
    setIsCorrect(false)
  }, [idx, cards.length, navigate])

  const handleRestart = useCallback(() => {
    setIdx(0)
    setStage('recall')
    setSpelling('')
    setIsCorrect(false)
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">No new words to learn</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            You&apos;ve started learning every word in the database.
          </p>
          <Button variant="outline" onClick={() => navigate('decks')}>Browse decks</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')} className="-ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Learn New Words</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Recall · Reveal · Spell
          </p>
        </div>
        <Badge variant="secondary" className="font-mono">
          {idx + 1} / {cards.length}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${((idx) / cards.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
            {current && (
            <WordCard
              word={current.word}
              ttsVoice={ttsVoice}
              ttsRate={ttsRate}
              showDefinition={stage !== 'recall'}
              hideWord={stage === 'spelling'}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Stage: recall */}
      {stage === 'recall' && (
        <Card>
          <CardContent className="p-5 sm:p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Try to recall the meaning of the word above. When ready, click below to reveal and practice spelling.
            </p>
            <Button onClick={handleReveal} className="w-full sm:w-auto">
              Reveal & Spell <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stage: spelling */}
      {stage === 'spelling' && current && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Listen and spell the word</span>
              <Button size="sm" variant="outline" onClick={() => {
                const ok = speak(current.word.word, { voice: ttsVoice, rate: ttsRate })
                if (!ok) toast.error('TTS not available.')
              }}>
                <Volume2 className="h-4 w-4 mr-1.5" /> Play
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpellingInput
              value={spelling}
              onChange={setSpelling}
              target={current.word.word}
              autoFocus
              onSubmit={handleSpellingSubmit}
              placeholder="Type the word you hear…"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStage('recall')}>Back</Button>
              <Button onClick={handleSpellingSubmit}>
                Submit <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage: graded */}
      {stage === 'graded' && current && (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-full p-2 ${isCorrect ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                {isCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </div>
              <div>
                <div className="font-semibold">
                  {isCorrect ? 'Correct!' : 'Not quite'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isCorrect ? 'Word marked as Good (4). It will reappear in 1 day.' : `Correct spelling: ${current.word.word}`}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              {idx + 1 >= cards.length && (
                <Button variant="outline" onClick={handleRestart}>
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Restart
                </Button>
              )}
              <Button onClick={handleNext}>
                {idx + 1 >= cards.length ? 'Finish' : 'Next word'} <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
