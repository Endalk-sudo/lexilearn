'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Volume2, Sparkles, Check, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { GRADE_LABELS, type Grade } from '@/lib/srs'

const GRADE_BUTTONS: { grade: Grade; key: string; color: string }[] = [
  { grade: 0, key: '1', color: 'bg-rose-500 hover:bg-rose-600' },
  { grade: 3, key: '2', color: 'bg-amber-500 hover:bg-amber-600' },
  { grade: 4, key: '3', color: 'bg-emerald-500 hover:bg-emerald-600' },
  { grade: 5, key: '4', color: 'bg-sky-500 hover:bg-sky-600' },
]

export function ReviewView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [ttsVoice, setTtsVoice] = useState<string>('')
  const [ttsRate, setTtsRate] = useState<number>(1)
  const [completed, setCompleted] = useState(false)
  const gradeRef = useRef<HTMLDivElement>(null)
  const navigate = useAppStore((s) => s.navigate)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const [list, settings] = await Promise.all([api.getReviewableCards(null, 30), api.getSettings()])
      setCards(list)
      setTtsVoice(settings.ttsVoice)
      setTtsRate(settings.ttsRate)
      setIdx(0)
      setRevealed(false)
      setCompleted(false)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCards() }, [loadCards])

  const current = cards[idx]

  const grade = useCallback(async (g: Grade) => {
    if (!current || !revealed) return
    try {
      await api.submitReview(current.word.id, g, 'review')
      if (g >= 3) toast.success(`${GRADE_LABELS[g]} · +${g === 5 ? 8 : g === 4 ? 5 : 3} XP`)
      else toast.error(`${GRADE_LABELS[g]} · word reset to Learning`)
    } catch (e) {
      console.error(e)
    }
    if (idx + 1 >= cards.length) {
      setCompleted(true)
      return
    }
    setIdx(idx + 1)
    setRevealed(false)
  }, [current, revealed, idx, cards.length])

  // Keyboard shortcuts: Space=reveal, 1/2/3/4=grade
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (loading || completed) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === ' ' || e.key === 'Enter') {
        if (!revealed) {
          e.preventDefault()
          setRevealed(true)
        }
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        const map: Record<string, Grade> = { '1': 0, '2': 3, '3': 4, '4': 5 }
        grade(map[e.key])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [revealed, grade, loading, completed])

  // Focus first grade button on reveal
  useEffect(() => {
    if (revealed && gradeRef.current) {
      const btn = gradeRef.current.querySelector('button')
      btn?.focus()
    }
  }, [revealed])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">No reviews due</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            You&apos;re all caught up! Come back later or learn some new words.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate('learn')}>Learn new</Button>
            <Button variant="outline" onClick={() => navigate('quiz')}>Take a quiz</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (completed) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold">Review session complete!</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            You reviewed {cards.length} cards. Great work keeping up with spaced repetition.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={loadCards}>Review more</Button>
            <Button onClick={() => navigate('dashboard')}>Back to dashboard</Button>
          </div>
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
            <h1 className="text-2xl font-bold tracking-tight">Review Session</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Spaced repetition · SM-2 algorithm
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
          animate={{ width: `${(idx / cards.length) * 100}%` }}
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
            <Card className="overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                {/* Card header with status */}
                <div className="flex items-center justify-between mb-4">
                  {current.srs ? (
                    <Badge variant="outline" className="capitalize">
                      {current.srs.status}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">New</Badge>
                  )}
                  {current.word.cefr && (
                    <Badge variant="outline" className="font-mono">{current.word.cefr}</Badge>
                  )}
                </div>

                {/* Word display - hidden definition until revealed */}
                <div className="text-center py-6">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{current.word.word}</h2>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { if (!speak(current.word.word, { voice: ttsVoice, rate: ttsRate })) toast.error('TTS not available') }}
                      title="Pronounce"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {current.word.ipa && (
                    <p className="text-sm text-muted-foreground font-mono">{current.word.ipa}</p>
                  )}
                  {current.word.pos && (
                    <p className="text-sm text-muted-foreground italic mt-1">{current.word.pos}</p>
                  )}
                </div>

                {/* Reveal button or definition */}
                {!revealed ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Try to recall the meaning, then reveal.
                    </p>
                    <Button onClick={() => setRevealed(true)} size="lg">
                      Reveal definition
                    </Button>
                    <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
                      <kbd className="inline-flex items-center justify-center h-6 w-14 rounded-md border bg-muted text-[11px] font-mono font-semibold">Space</kbd>
                      <span className="text-xs">to reveal</span>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="border-t pt-4 space-y-3"
                  >
                    {current.word.definitions.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Definition</div>
                        <ul className="space-y-1">
                          {current.word.definitions.map((d, i) => (
                            <li key={i} className="text-sm">
                              <span className="text-muted-foreground italic mr-1.5">{d.pos}</span>
                              {d.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {current.word.examples.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Example</div>
                        <p className="text-sm italic border-l-2 border-primary/30 pl-3">
                          {current.word.examples[0]}
                        </p>
                      </div>
                    )}
                    {current.srs && (
                      <div className="text-[11px] text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        <div>Interval: <span className="font-mono">{current.srs.interval}d</span></div>
                        <div>Reps: <span className="font-mono">{current.srs.repetitions}</span></div>
                        <div>Ease: <span className="font-mono">{current.srs.easeFactor.toFixed(2)}</span></div>
                        <div>Total: <span className="font-mono">{current.srs.totalReviews}</span></div>
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Grading buttons */}
      {revealed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div ref={gradeRef}>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GRADE_BUTTONS.map((g) => (
                  <Button
                    key={g.grade}
                    onClick={() => grade(g.grade)}
                    className={`${g.color} text-white relative`}
                    size="lg"
                  >
                    <span className="absolute top-1 left-2 text-[10px] opacity-80 font-mono">{g.key}</span>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{GRADE_LABELS[g.grade]}</span>
                      <span className="text-[10px] opacity-90">
                        {g.grade === 0 ? 'Reset' : g.grade === 3 ? 'Soon' : g.grade === 4 ? 'Normal' : 'Long'}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                {['1','2','3','4'].map((k) => (
                  <kbd key={k} className="inline-flex items-center justify-center h-6 w-6 rounded-md border bg-muted text-[11px] font-mono font-semibold">{k}</kbd>
                ))}
                <span className="text-xs">to grade</span>
              </div>
            </CardContent>
          </Card>
          </div>
        </motion.div>
      )}
    </div>
  )
}
