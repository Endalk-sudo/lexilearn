'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Check, Ear, FileText, Flame, GripVertical, Keyboard,
  ListChecks, Target, Timer, ToggleLeft, Trophy, Volume2, X, Zap,
} from 'lucide-react'
import { api, type QuizMode, type QuizQuestion } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/page-header'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import { SessionCompleteV2 } from '@/components/feedback/session-complete-v2'
import { XpPopLayer, popXpAt, useXpPops } from '@/components/feedback/xp-pop'
import { MatchGame, type MatchPair } from '@/features/quiz/components/match-game'
import { GRADE_XP } from '@/lib/srs'
import { speak } from '@/lib/tts'
import { buzz, playSound, typeFeelFromKey } from '@/lib/feel'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { listItem, stagger, useMotionSafe } from '@/lib/motion'

const MODES: {
  mode: QuizMode
  title: string
  description: string
  icon: React.ElementType
  tag: string
}[] = [
  { mode: 'mc', title: 'Pick the meaning', description: 'See a word, choose its definition.', icon: FileText, tag: 'Warm-up' },
  { mode: 'reverse_mc', title: 'Find the word', description: 'See a definition, retrieve the word.', icon: ToggleLeft, tag: 'Recall' },
  { mode: 'match', title: 'Match them up', description: 'Drag each word onto its meaning.', icon: GripVertical, tag: 'Drag' },
  { mode: 'typing', title: 'Type it out', description: 'Produce the word from its definition.', icon: Keyboard, tag: 'Active recall' },
  { mode: 'spelling_bee', title: 'Spelling bee', description: 'Listen carefully and type what you hear.', icon: Ear, tag: 'Listening' },
  { mode: 'speed_round', title: 'Speed round', description: '60 seconds. Build a combo, answer fast.', icon: Zap, tag: 'Arcade' },
]

// Canonical XP per correct answer — same GRADE_XP table the server credits (W1).
const XP_PER_CORRECT = GRADE_XP[4]
const SPEED_SECONDS = 60

export function QuizView() {
  const [mode, setMode] = useState<QuizMode | null>(null)
  const { v, t } = useMotionSafe()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {!mode ? (
        <motion.div variants={v(stagger(0.04))} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={v(listItem)} transition={t()}>
            <PageHeader
              eyebrow="Quiz"
              icon={ListChecks}
              title="Six ways to test yourself"
              description="Short, low-stakes checks. A wrong answer just means you will see the word again sooner."
            />
          </motion.div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => (
              <ModeCard key={m.mode} {...m} onClick={() => setMode(m.mode)} />
            ))}
          </div>
        </motion.div>
      ) : (
        <QuizRunner mode={mode} onExit={() => setMode(null)} />
      )}
    </div>
  )
}

function ModeCard({
  mode,
  title,
  description,
  icon: Icon,
  tag,
  onClick,
}: {
  mode: QuizMode
  title: string
  description: string
  icon: React.ElementType
  tag: string
  onClick: () => void
}) {
  const { v, t } = useMotionSafe()
  return (
    <motion.button
      data-testid={`quiz-mode-${mode}`}
      aria-label={`Start ${title}`}
      variants={v(listItem)}
      transition={t()}
      type="button"
      onClick={() => {
        playSound('tap')
        onClick()
      }}
      className="surface p-4 text-left transition-colors duration-150 hover:border-primary-line"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <Badge variant="outline">{tag}</Badge>
      </div>
      <div className="mt-3.5 text-sm font-semibold tracking-tight">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </motion.button>
  )
}

function QuizRunner({ mode, onExit }: { mode: QuizMode; onExit: () => void }) {
  const requestMode: QuizMode = mode === 'match' ? 'mc' : mode
  const count = mode === 'speed_round' ? 40 : mode === 'match' ? 6 : 10

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [graded, setGraded] = useState<boolean | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS)
  const [finished, setFinished] = useState(false)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [dueAfter, setDueAfter] = useState(0)
  const [streakAfter, setStreakAfter] = useState(0)
  const [newAfter, setNewAfter] = useState(0)
  const navigate = useAppStore((s) => s.navigate)
  const { pops, pop } = useXpPops()
  const { v, t } = useMotionSafe()
  const finishedRef = useRef(false)
  /**
   * Session totals live in a ref as well as state: the speed-round timer and the
   * deferred auto-advance fire outside the render that produced them, so reading
   * state there would report stale numbers.
   */
  const statsRef = useRef({ correct: 0, xp: 0, answered: 0 })

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [list, settings] = await Promise.all([
          api.generateQuiz(null, requestMode, count),
          api.getSettings(),
        ])
        if (!live) return
        setQuestions(list)
        setTtsVoice(settings.ttsVoice)
        setTtsRate(settings.ttsRate)
      } catch {
        toast.error('Could not build this quiz. Check that you have words in your library.')
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [count, requestMode])

  const current = questions[idx]

  const finish = useCallback(
    async (total: number, correct: number, xp: number) => {
      if (finishedRef.current) return
      finishedRef.current = true
      setFinished(true)
      try {
        await api.submitQuizSession(mode, total, correct, xp)
        const stats = await api.getDashboardStats()
        setDueAfter(stats.dueCount)
        setNewAfter(stats.newCount)
        setStreakAfter(stats.streak)
      } catch {
        /* offline */
      }
    },
    [mode]
  )

  // Speed round timer
  useEffect(() => {
    if (mode !== 'speed_round' || finished || loading) return
    if (timeLeft <= 0) {
      void finish(Math.max(1, statsRef.current.answered), statsRef.current.correct, statsRef.current.xp)
      return
    }
    const id = window.setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [finish, finished, loading, mode, timeLeft])

  const advance = useCallback(() => {
    setSelected(null)
    setGraded(null)
    setAnswer('')
    if (idx + 1 >= questions.length) {
      void finish(Math.max(1, statsRef.current.answered), statsRef.current.correct, statsRef.current.xp)
    } else {
      setIdx((i) => i + 1)
    }
  }, [finish, idx, questions.length])

  const gradeAnswer = useCallback(
    (isCorrect: boolean, e?: { clientX: number; clientY: number }) => {
      setGraded(isCorrect)
      const xp = isCorrect ? XP_PER_CORRECT : GRADE_XP[0]
      if (isCorrect) {
        setCorrectCount((c) => c + 1)
        setCombo((c) => {
          const next = c + 1
          setBestCombo((b) => Math.max(b, next))
          return next
        })
        playSound('correct')
        buzz('success')
      } else {
        setCombo(0)
        playSound('wrong')
        buzz('error')
      }
      setXpEarned((x) => x + xp)
      setAnsweredCount((c) => c + 1)
      statsRef.current = {
        correct: statsRef.current.correct + (isCorrect ? 1 : 0),
        xp: statsRef.current.xp + xp,
        answered: statsRef.current.answered + 1,
      }
      if (xp && e) popXpAt(xp, e, pop)
      if (current) void api.submitReview(current.wordDTO.id, isCorrect ? 4 : 0, 'quiz').catch(() => {})
      if (mode !== 'speed_round') window.setTimeout(advance, 900)
      else window.setTimeout(advance, 350)
    },
    [advance, current, mode, pop]
  )

  // Keyboard: A-D / 1-4 for options, Enter to submit typing.
  useEffect(() => {
    if (finished || loading) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT') return
      if (graded !== null || !current) return
      const options = current.options
      if (!options) return
      const letter = e.key.toUpperCase()
      const optionIndex = /^[A-D]$/.test(letter)
        ? letter.charCodeAt(0) - 65
        : /^[1-4]$/.test(letter)
          ? Number(letter) - 1
          : -1
      if (optionIndex >= 0 && optionIndex < options.length) {
        e.preventDefault()
        setSelected(options[optionIndex])
        gradeAnswer(options[optionIndex] === current.correctAnswer)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, finished, gradeAnswer, graded, loading])

  const matchPairs = useMemo<MatchPair[]>(
    () =>
      questions.map((q) => ({
        // Key by word id so the game can report per-word results back for
        // SRS/XP logging (question ids would not map to reviewable words).
        id: q.wordDTO.id,
        word: q.promptWord?.word ?? q.prompt,
        definition: q.correctAnswer,
      })),
    [questions]
  )

  const modeMeta = MODES.find((m) => m.mode === mode)

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (!questions.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No words to quiz yet"
        hint="Add a few words to a deck first — quizzes pull from what is already in your library."
        actionLabel="Open library"
        onAction={() => navigate('library')}
      />
    )
  }

  if (finished) {
    return (
      <div className="space-y-4">
        <SessionCompleteV2
          title={mode === 'speed_round' ? 'Time! Round over' : 'Quiz complete'}
          subtitle={
            mode === 'speed_round'
              ? `Best combo ${bestCombo}×. Speed rounds reward instinct — accuracy comes next.`
              : undefined
          }
          correct={correctCount}
          total={Math.max(1, answeredCount > 0 ? answeredCount : correctCount)}
          xp={xpEarned}
          streak={streakAfter}
          onAgain={() => {
            finishedRef.current = false
            setFinished(false)
            setIdx(0)
            setCorrectCount(0)
            setXpEarned(0)
            setAnsweredCount(0)
            statsRef.current = { correct: 0, xp: 0, answered: 0 }
            setCombo(0)
            setBestCombo(0)
            setGraded(null)
            setSelected(null)
            setTimeLeft(SPEED_SECONDS)
            setLoading(true)
            api
              .generateQuiz(null, requestMode, count)
              .then((list) => setQuestions(list))
              .catch(() => toast.error('Could not rebuild the quiz'))
              .finally(() => setLoading(false))
          }}
          onDone={() => navigate('today')}
        />
        {dueAfter > 0 ? (
          <NextStep
            title="You have cards waiting"
            hint={`${dueAfter} word${dueAfter === 1 ? '' : 's'} are due for review right now.`}
            actionLabel={`Review ${dueAfter}`}
            onAction={() => navigate('review')}
          />
        ) : newAfter > 0 ? (
          <NextStep
            title="Keep the streak moving"
            hint="Your review queue is clear. Learning a few new words is the next best step."
            actionLabel="Learn new words"
            onAction={() => navigate('learn')}
          />
        ) : (
          <NextStep
            title="All clear for today"
            hint="Nothing is due and nothing is new. Come back tomorrow."
            actionLabel="Back to today"
            onAction={() => navigate('today')}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <XpPopLayer pops={pops} />

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
          Modes
        </Button>
        {mode === 'speed_round' ? (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold num',
              timeLeft <= 10 ? 'border-destructive/40 bg-destructive-soft text-destructive' : 'border-border bg-card'
            )}
            role="timer"
            aria-live="off"
          >
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            {timeLeft}s
          </span>
        ) : (
          <span className="text-sm text-muted-foreground num">
            {idx + 1} / {questions.length}
          </span>
        )}
      </div>

      {mode !== 'speed_round' ? (
        <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Quiz progress" aria-valuenow={idx + 1} aria-valuemin={0} aria-valuemax={questions.length}>
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${((idx + (graded !== null ? 1 : 0)) / questions.length) * 100}%` }}
            transition={t({ duration: 0.3, ease: [0.16, 1, 0.3, 1] })}
          />
        </div>
      ) : null}

      {mode === 'match' ? (
        <div className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <GripVertical className="h-4 w-4 text-primary" aria-hidden="true" />
            Match each word to its meaning
          </div>
          <MatchGame
            pairs={matchPairs}
            onComplete={(results) => {
              // Every pair is eventually matched, so "correct" stays = total;
              // the grade records HOW it went: clean first try = Good (4),
              // matched after stumbles = Hard (3). XP comes from the same
              // GRADE_XP table the server credits, and each pair is logged as
              // a real review so match participates in SRS/XP/streak like the
              // other modes (W1).
              const total = results.length
              const correct = total
              const xp = results.reduce((sum, r) => sum + GRADE_XP[r.firstTry ? 4 : 3], 0)
              setCorrectCount(correct)
              setXpEarned(xp)
              setAnsweredCount(total)
              for (const r of results) {
                void api.submitReview(r.wordId, r.firstTry ? 4 : 3, 'match').catch(() => {})
              }
              void finish(total, correct, xp)
            }}
          />
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            variants={v(stagger(0.04))}
            initial="hidden"
            animate="show"
            exit="exit"
            transition={t()}
            className="surface p-4 sm:p-5"
          >
            <motion.div variants={v(listItem)} transition={t()} className="flex items-center justify-between gap-3">
              <h1>
                <Badge variant="soft">{modeMeta?.title}</Badge>
              </h1>
              {mode === 'speed_round' ? (
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground num">
                  <Flame className="h-3.5 w-3.5 text-streak" aria-hidden="true" />
                  {combo}× combo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground num">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  {correctCount} correct
                </span>
              )}
            </motion.div>

            <motion.div variants={v(listItem)} transition={t()} className="mt-4">
              {mode === 'spelling_bee' ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Listen and type what you hear</p>
                  <Button
                    size="lg"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      if (!speak(current.audioWord ?? '', { voice: ttsVoice, rate: ttsRate })) {
                        toast.error('Pronunciation is unavailable in this browser.')
                      }
                    }}
                  >
                    <Volume2 className="h-4 w-4" />
                    Play the word
                  </Button>
                </div>
              ) : mode === 'reverse_mc' || mode === 'typing' ? (
                <div>
                  <div className="label text-muted-foreground">Definition</div>
                  <p className="mt-1.5 text-base leading-relaxed">{current.prompt}</p>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                      {current.promptWord?.word ?? current.prompt}
                    </h2>
                    {current.promptWord?.ipa ? (
                      <p className="mt-1 font-mono text-sm text-muted-foreground">{current.promptWord.ipa}</p>
                    ) : null}
                  </div>
                  {current.promptWord ? (
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Hear ${current.promptWord.word}`}
                      onClick={() => {
                        if (!speak(current.promptWord!.word, { voice: ttsVoice, rate: ttsRate })) {
                          toast.error('Pronunciation is unavailable in this browser.')
                        }
                      }}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              )}
            </motion.div>

            {current.options ? (
              <motion.div variants={v(listItem)} transition={t()} className="mt-4 grid gap-2">
                {current.options.map((option, i) => {
                  const isRight = option === current.correctAnswer
                  const isPicked = option === selected
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={graded !== null}
                      onClick={(e) => {
                        setSelected(option)
                        gradeAnswer(isRight, e)
                      }}
                      data-testid={`quiz-option-${i}`}
                      className={cn(
                        'flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-card px-3.5 py-3 text-left text-sm shadow-xs transition-colors duration-150',
                        graded === null && 'hover:border-primary-line hover:bg-primary-soft',
                        graded !== null && isRight && 'border-success/40 bg-success-soft',
                        graded !== null && isPicked && !isRight && 'border-destructive/40 bg-destructive-soft'
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-muted font-mono text-xs font-semibold" aria-hidden="true">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal">{option}</span>
                      {graded !== null && isRight ? <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : null}
                      {graded !== null && isPicked && !isRight ? <X className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" /> : null}
                    </button>
                  )
                })}
              </motion.div>
            ) : (
              <motion.div variants={v(listItem)} transition={t()} className="mt-4 space-y-3">
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={graded !== null}
                  autoFocus
                  placeholder={mode === 'spelling_bee' ? 'Type what you hear…' : 'Type the word…'}
                  aria-label="Your answer"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full rounded-md border border-input bg-card p-4 text-center font-mono text-lg outline-none transition-colors focus-visible:border-primary-line"
                  onKeyDown={(e) => {
                    typeFeelFromKey(e)
                    if (e.key === 'Enter' && graded === null && answer.trim()) {
                      gradeAnswer(answer.trim().toLowerCase() === current.correctAnswer.toLowerCase())
                    }
                  }}
                />
                {graded !== null ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className={cn(
                      'rounded-md border p-3 text-center text-sm font-medium',
                      graded ? 'border-success/40 bg-success-soft text-success' : 'border-destructive/40 bg-destructive-soft text-destructive'
                    )}
                  >
                    {graded ? 'Correct.' : `It was “${current.correctAnswer}”. It will come back sooner.`}
                  </div>
                ) : (
                  <Button onClick={() => gradeAnswer(answer.trim().toLowerCase() === current.correctAnswer.toLowerCase())} disabled={!answer.trim()} className="w-full">
                    Check answer
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {mode === 'speed_round' ? (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat icon={Target} value={correctCount} label="Correct" />
          <MiniStat icon={Flame} value={`${bestCombo}×`} label="Best combo" />
          <MiniStat icon={Trophy} value={xpEarned} label="XP" />
        </div>
      ) : null}
    </div>
  )
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: string | number
  label: string
}) {
  return (
    <div className="surface p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
      <div className="mt-1.5 text-base font-semibold num">{value}</div>
      <div className="label text-muted-foreground">{label}</div>
    </div>
  )
}
