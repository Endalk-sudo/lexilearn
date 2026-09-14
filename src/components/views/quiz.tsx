'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type QuizQuestion, type QuizMode } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ListChecks, Volume2, Check, X, Clock, RotateCcw, Trophy, ArrowRight, FileText, ToggleLeft, Keyboard, Ear, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { cn } from '@/lib/utils'

const MODES: { mode: QuizMode; title: string; description: string; icon: React.ElementType }[] = [
  { mode: 'mc', title: 'Multiple Choice', description: 'See a word, pick its definition.', icon: FileText },
  { mode: 'reverse_mc', title: 'Reverse MC', description: 'See a definition, pick the word.', icon: ToggleLeft },
  { mode: 'typing', title: 'Typing Test', description: 'See a definition, type the word.', icon: Keyboard },
  { mode: 'spelling_bee', title: 'Spelling Bee', description: 'Listen to audio, type the spelling.', icon: Ear },
  { mode: 'speed_round', title: 'Speed Round', description: '60 seconds — answer as many as you can.', icon: Zap },
]

export function QuizView() {
  const [mode, setMode] = useState<QuizMode | null>(null)
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ListChecks className="h-6 w-6" />
          Quiz Modes
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pick a mode to test your knowledge.</p>
      </div>
      {!mode ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <Card key={m.mode} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setMode(m.mode)}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-semibold">{m.title}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{m.description}</div>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    Start <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <QuizRunner mode={mode} onExit={() => setMode(null)} />
      )}
    </div>
  )
}

function QuizRunner({ mode, onExit }: { mode: QuizMode; onExit: () => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [graded, setGraded] = useState<null | boolean>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [timeLeft, setTimeLeft] = useState(60)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qs, settings] = await Promise.all([
        api.generateQuiz(null, mode, mode === 'speed_round' ? 30 : 10),
        api.getSettings(),
      ])
      setQuestions(qs)
      setTtsVoice(settings.ttsVoice)
      setTtsRate(settings.ttsRate)
      setIdx(0)
      setAnswer('')
      setSelectedOption(null)
      setGraded(null)
      setCorrectCount(0)
      setXpEarned(0)
      setCompleted(false)
      setTimeLeft(60)
    } catch (e) {
      console.error(e)
      toast.error('Not enough words to generate a quiz. Try adding a custom deck.')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => { load() }, [load])

  // Speed round timer
  useEffect(() => {
    if (mode !== 'speed_round' || completed || loading || graded !== null) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setCompleted(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [mode, completed, loading, graded, idx])

  // Auto-play spelling bee audio
  useEffect(() => {
    if (mode === 'spelling_bee' && questions[idx] && !graded) {
      const ok = speak(questions[idx].audioWord!, { voice: ttsVoice, rate: ttsRate })
      if (!ok) toast.error('TTS not available.')
    }
  }, [idx, mode, questions, graded, ttsVoice, ttsRate])

  const finish = useCallback(async (finalCorrect: number, finalXp: number, total: number) => {
    try {
      await api.submitQuizSession(mode, total, finalCorrect, finalXp)
    } catch (e) {
      console.error(e)
    }
    setCompleted(true)
  }, [mode])

  const gradeAnswer = useCallback((isCorrect: boolean) => {
    if (graded !== null) return
    setGraded(isCorrect)
    const newXp = isCorrect ? 5 : 0
    const newCorrect = correctCount + (isCorrect ? 1 : 0)
    setCorrectCount(newCorrect)
    setXpEarned((x) => x + newXp)
    if (isCorrect) toast.success('Correct! +5 XP')
    else toast.error('Not quite right.')

    // For speed round: auto-advance after a short pause
    if (mode === 'speed_round') {
      setTimeout(() => {
        if (idx + 1 >= questions.length) {
          finish(newCorrect, xpEarned + newXp, questions.length)
        } else {
          setIdx(idx + 1)
          setAnswer('')
          setSelectedOption(null)
          setGraded(null)
        }
      }, 500)
    }
  }, [graded, correctCount, xpEarned, mode, idx, questions.length, finish])

  const next = useCallback(() => {
    if (idx + 1 >= questions.length) {
      finish(correctCount, xpEarned, questions.length)
    } else {
      setIdx(idx + 1)
      setAnswer('')
      setSelectedOption(null)
      setGraded(null)
    }
  }, [idx, questions.length, correctCount, xpEarned, finish])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Need at least 4 words in the database to run this quiz.</p>
          <Button variant="outline" className="mt-4" onClick={onExit}>Back to modes</Button>
        </CardContent>
      </Card>
    )
  }

  if (completed) {
    const total = questions.length
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Trophy className="h-12 w-12 mx-auto text-amber-500 mb-3" />
          <h3 className="text-xl font-bold">Quiz complete!</h3>
          <p className="text-sm text-muted-foreground mt-1">Mode: {MODES.find((m) => m.mode === mode)?.title}</p>
          <div className="grid grid-cols-3 gap-3 my-6 max-w-md mx-auto">
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-bold">{correctCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Correct</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Total</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-bold">{pct}%</div>
              <div className="text-[10px] text-muted-foreground uppercase">Accuracy</div>
            </div>
          </div>
          <div className="text-sm text-emerald-600 font-medium mb-4">+{xpEarned} XP earned</div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={load}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Try again
            </Button>
            <Button onClick={onExit}>Back to modes</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const current = questions[idx]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>← Exit</Button>
        <div className="flex items-center gap-2">
          {mode === 'speed_round' && (
            <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="font-mono">
              <Clock className="h-3 w-3 mr-1" /> {timeLeft}s
            </Badge>
          )}
          <Badge variant="secondary" className="font-mono">
            {idx + 1} / {questions.length}
          </Badge>
          <Badge variant="outline">Score: {correctCount}</Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${(idx / questions.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{current.prompt}</CardTitle>
              {current.promptWord && mode !== 'spelling_bee' && (
                <div className="text-2xl font-bold mt-1">{current.promptWord.word}</div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {(mode === 'mc' || mode === 'reverse_mc' || mode === 'speed_round') && current.options && (
                <div className="grid gap-2">
                  {current.options.map((opt, i) => {
                    const isCorrect = opt === current.correctAnswer
                    const isSelected = opt === selectedOption
                    return (
                      <Button
                        key={i}
                        variant={
                          graded !== null && isCorrect ? 'default'
                          : graded !== null && isSelected && !isCorrect ? 'destructive'
                          : isSelected ? 'secondary'
                          : 'outline'
                        }
                        className={cn(
                          'justify-start text-left h-auto py-3 px-4 whitespace-normal',
                          graded !== null && isCorrect && 'bg-emerald-500 text-white hover:bg-emerald-600',
                          graded !== null && isSelected && !isCorrect && 'bg-rose-500 text-white hover:bg-rose-600',
                        )}
                        disabled={graded !== null}
                        onClick={() => {
                          if (graded !== null) return
                          setSelectedOption(opt)
                          gradeAnswer(opt === current.correctAnswer)
                        }}
                      >
                        <span className="font-mono text-xs mr-2 opacity-70">{String.fromCharCode(65 + i)}.</span>
                        <span>{opt}</span>
                        {graded !== null && isCorrect && <Check className="h-4 w-4 ml-auto" />}
                        {graded !== null && isSelected && !isCorrect && <X className="h-4 w-4 ml-auto" />}
                      </Button>
                    )
                  })}
                </div>
              )}

              {(mode === 'typing' || mode === 'spelling_bee') && (
                <div className="space-y-3">
                  {mode === 'spelling_bee' && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          const ok = speak(current.audioWord!, { voice: ttsVoice, rate: ttsRate })
                          if (!ok) toast.error('TTS not available.')
                        }}
                      >
                        <Volume2 className="h-5 w-5 mr-2" /> Play again
                      </Button>
                    </div>
                  )}
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={graded !== null}
                    autoFocus
                    placeholder={mode === 'spelling_bee' ? 'Type the word you hear…' : 'Type the answer…'}
                    className="w-full text-center font-mono text-lg p-3 rounded-md border bg-background"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && graded === null && answer.trim()) {
                        gradeAnswer(answer.trim().toLowerCase() === current.correctAnswer.toLowerCase())
                      }
                    }}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  {graded !== null && (
                    <div className={cn('text-center text-sm font-medium', graded ? 'text-emerald-600' : 'text-rose-600')}>
                      {graded ? 'Correct!' : `Answer: ${current.correctAnswer}`}
                    </div>
                  )}
                </div>
              )}

              {graded !== null && mode !== 'speed_round' && (
                <div className="flex justify-end">
                  <Button onClick={next}>
                    {idx + 1 >= questions.length ? 'See results' : 'Next'} <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
