'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainCircuit, Sparkles, Volume2 } from 'lucide-react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { SessionCompleteV2 } from '@/components/feedback/session-complete-v2'
import { SessionSkeleton } from '@/components/feedback/session-skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import { XpPopLayer, popXpAt, useXpPops } from '@/components/feedback/xp-pop'
import { speak } from '@/lib/tts'
import { buzz, playSound } from '@/lib/feel'
import { calculateSm2, GRADE_XP, type Grade, type SrsCard } from '@/lib/srs'
import { resumeIndexFor, saveResume } from '@/lib/resume'
import { gradeEnter, gradeExit, listItem, stagger, useMotionSafe } from '@/lib/motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const GRADES: { grade: Grade; key: string; label: string; hint: string; cls: string }[] = [
  { grade: 0, key: '1', label: 'Again', hint: 'Forgot it', cls: 'text-destructive hover:border-destructive/40 hover:bg-destructive-soft' },
  { grade: 3, key: '2', label: 'Hard', hint: 'Tough recall', cls: 'text-warning hover:border-warning/40 hover:bg-warning-soft' },
  { grade: 4, key: '3', label: 'Good', hint: 'Knew it', cls: 'text-success hover:border-success/40 hover:bg-success-soft' },
  { grade: 5, key: '4', label: 'Easy', hint: 'Instant', cls: 'text-primary hover:border-primary-line hover:bg-primary-soft' },
]

/** Show where each grade will send the card, so the choice is informed. */
function previewInterval(srs: CardWithWord['srs'], grade: Grade): string {
  if (!srs) return ''
  try {
    const next = calculateSm2({ ...(srs as unknown as SrsCard) }, grade)
    return next.interval <= 1 ? '1 day' : `${next.interval} days`
  } catch {
    return ''
  }
}

export function ReviewView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastGrade, setLastGrade] = useState<Grade>(4)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [done, setDone] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [levelBefore, setLevelBefore] = useState('')
  const [levelAfter, setLevelAfter] = useState('')
  const [streak, setStreak] = useState(0)
  const [newAfter, setNewAfter] = useState(0)
  const navigate = useAppStore((s) => s.navigate)
  const { pops, pop } = useXpPops()
  const { v, t } = useMotionSafe()
  const gradeRefs = useRef<(HTMLButtonElement | null)[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, settings, stats] = await Promise.all([
        api.getReviewableCards(null, 30),
        api.getSettings(),
        api.getDashboardStats(),
      ])
      setCards(list)
      setTtsVoice(settings.ttsVoice)
      setTtsRate(settings.ttsRate)
      setLevelBefore(stats.level.name)
      setStreak(stats.streak)
      const start = list.length ? resumeIndexFor('review', list.length) : 0
      setIdx(start)
      setRevealed(false)
      setDone(false)
      setCorrectCount(0)
      setXpEarned(0)
      if (list.length) {
        saveResume({
          view: 'review',
          label: 'Review',
          detail: `${list.length - start} due`,
          index: start,
          total: list.length,
        })
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false)
    }
  }, [])

  const didInitRef = useRef(false)

  // Initial data fetch on mount (guarded so StrictMode double-effects don't refetch).
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    void load()
  }, [load])

  const current = cards[idx]

  const reveal = useCallback(() => {
    if (!current) return
    playSound('tap')
    buzz('light')
    setRevealed(true)
  }, [current])

  const grade = useCallback(
    async (g: Grade, e?: { clientX: number; clientY: number }, buttonIndex?: number) => {
      if (!current || !revealed) return
      setLastGrade(g)
      const xp = GRADE_XP[g]
      const passed = g >= 3
      playSound(passed ? 'correct' : 'wrong')
      buzz(passed ? 'success' : 'error')
      if (e) popXpAt(xp, e, pop)
      else {
        const el = typeof buttonIndex === 'number' ? gradeRefs.current[buttonIndex] : null
        if (el) {
          const rect = el.getBoundingClientRect()
          pop(xp, rect.left + rect.width / 2 - 38, rect.top - 10)
        } else {
          popXpAt(xp, undefined, pop)
        }
      }
      if (passed) setCorrectCount((c) => c + 1)
      setXpEarned((x) => x + xp)
      void api.submitReview(current.word.id, g, 'review').catch(() => {})

      const last = idx + 1 >= cards.length
      if (last) {
        try {
          const stats = await api.getDashboardStats()
          setLevelAfter(stats.level.name)
          setStreak(stats.streak)
          setNewAfter(stats.newCount)
        } catch {
          /* offline */
        }
        setDone(true)
        return
      }
      const nextIdx = idx + 1
      setIdx(nextIdx)
      setRevealed(false)
      saveResume({
        view: 'review',
        label: 'Review',
        detail: `${cards.length - nextIdx} due`,
        index: nextIdx,
        total: cards.length,
      })
    },
    [cards.length, current, idx, pop, revealed]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) {
        e.preventDefault()
        reveal()
        return
      }
      if (revealed) {
        const match = GRADES.find((g) => g.key === e.key)
        if (match) {
          e.preventDefault()
          const buttonIndex = GRADES.indexOf(match)
          void grade(match.grade, undefined, buttonIndex)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grade, reveal, revealed])

  const levelUp = useMemo(() => !!levelAfter && levelBefore !== levelAfter, [levelAfter, levelBefore])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <SessionSkeleton />
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <SessionCompleteV2
          title="Review complete"
          correct={correctCount}
          total={cards.length}
          xp={xpEarned}
          streak={streak}
          levelUp={levelUp}
          onAgain={() => {
            playSound('tap')
            void load()
          }}
          onDone={() => navigate('today')}
        />
        {newAfter > 0 ? (
          <NextStep
            title="Queue cleared"
            hint={`${newAfter} word${newAfter === 1 ? '' : 's'} have never been studied. Learning them now is the best use of a fresh head.`}
            actionLabel="Learn new words"
            onAction={() => navigate('learn')}
          />
        ) : (
          <NextStep
            title="Queue cleared — cement it by ear"
            hint="A short dictation round replays what you just recalled, through a different sense."
            actionLabel="Start dictation"
            onAction={() => navigate('dictation')}
            secondary={
              <Button variant="outline" size="sm" onClick={() => navigate('today')}>
                Back to today
              </Button>
            }
          />
        )}
      </div>
    )
  }

  if (!cards.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <EmptyState
          icon={BrainCircuit}
          title="Nothing is due right now"
          hint="That is the point of spaced repetition — the next batch arrives exactly when you would start forgetting it."
          actionLabel="Learn new words"
          onAction={() => navigate('learn')}
          secondary={
            <Button variant="ghost" size="sm" onClick={() => navigate('library')}>
              Browse your library
            </Button>
          }
        />
      </div>
    )
  }

  const progressPct = ((idx + (revealed ? 1 : 0)) / cards.length) * 100

  return (
    <div className="mx-auto max-w-2xl">
      <XpPopLayer pops={pops} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="label text-primary">Review</div>
          <div className="mt-1 text-sm text-muted-foreground num">
            {idx + 1} / {cards.length} due
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Space to reveal · 1–4 to grade</span>
          <span className="sm:hidden">Tap to reveal</span>
        </span>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Review progress" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${progressPct}%` }}
          transition={t({ duration: 0.3, ease: [0.16, 1, 0.3, 1] })}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.word.id}
          initial={gradeEnter(lastGrade).initial}
          animate={gradeEnter(lastGrade).animate}
          exit={gradeExit(lastGrade).exit}
          transition={t()}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={(_, info) => {
            if (info.offset.x < -90 && !revealed) reveal()
          }}
          className="touch-pan-y"
        >
          <div className="surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                  {current.word.word}
                </h1>
                {current.word.ipa ? (
                  <p className="mt-1.5 font-mono text-sm text-muted-foreground">{current.word.ipa}</p>
                ) : null}
                {current.word.pos ? (
                  <p className="mt-0.5 text-sm italic text-muted-foreground">{current.word.pos}</p>
                ) : null}
              </div>
              <Button
                size="icon-lg"
                variant="outline"
                aria-label={`Hear ${current.word.word}`}
                onClick={() => {
                  if (!speak(current.word.word, { voice: ttsVoice, rate: ttsRate })) {
                    toast.error('Pronunciation is unavailable in this browser.')
                  }
                }}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>

            {!revealed ? (
              <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden="true">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <p className="mt-3 text-sm font-semibold">Recall it before you reveal</p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Say the meaning out loud in your head, then check yourself.
                </p>
                <Button size="lg" onClick={reveal} data-testid="review-reveal" className="mt-4 w-full sm:w-auto sm:px-10">
                  Reveal answer
                </Button>
              </div>
            ) : (
              <motion.div variants={v(stagger(0.04))} initial="hidden" animate="show" className="mt-5 space-y-4 border-t border-border pt-5">
                {current.word.definitions.length > 0 ? (
                  <motion.div variants={v(listItem)} transition={t()}>
                    <div className="label text-muted-foreground">Meaning</div>
                    <ul className="mt-2 space-y-1.5">
                      {current.word.definitions.slice(0, 2).map((d, i) => (
                        <li key={i} className="text-[15px] leading-relaxed">
                          {d.pos ? <span className="mr-1.5 italic text-muted-foreground">{d.pos}</span> : null}
                          {d.text}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ) : null}

                {current.word.amharic ? (
                  <motion.div variants={v(listItem)} transition={t()} className="rounded-md bg-muted/40 p-3.5">
                    <div className="label text-muted-foreground">Amharic</div>
                    <div className="mt-1 text-[15px]">{current.word.amharic}</div>
                  </motion.div>
                ) : null}

                {current.word.examples[0] ? (
                  <motion.blockquote
                    variants={v(listItem)}
                    transition={t()}
                    className="border-l-2 border-primary-line bg-primary-soft px-3.5 py-3 text-sm italic leading-relaxed"
                  >
                    “{current.word.examples[0]}”
                  </motion.blockquote>
                ) : null}

                <motion.div variants={v(listItem)} transition={t()}>
                  <div className="label text-muted-foreground">How well did you recall it?</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {GRADES.map((g, i) => (
                      <button
                        key={g.grade}
                        ref={(el) => {
                          gradeRefs.current[i] = el
                        }}
                        type="button"
                        data-testid={`grade-${g.label.toLowerCase()}`}
                        onClick={(e) => void grade(g.grade, e, i)}
                        className={cn(
                          'flex min-h-16 flex-col items-start gap-0.5 rounded-lg border border-border bg-card px-3 py-3 text-left shadow-xs transition-colors duration-150 active:scale-[.98]',
                          g.cls
                        )}
                      >
                        <span className="text-sm font-semibold">{g.label}</span>
                        <span className="text-xs text-muted-foreground">{g.hint}</span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          +{GRADE_XP[g.grade]} XP · {g.key}
                          {previewInterval(current.srs, g.grade) ? ` · ${previewInterval(current.srs, g.grade)}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>

                <motion.div variants={v(listItem)} transition={t()} className="flex justify-center">
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate('coach')}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Struggling with this one? Fix it with the AI Coach
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
