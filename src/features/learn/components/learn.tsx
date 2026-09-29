'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Keyboard, Volume2 } from 'lucide-react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { StudyScopeBanner } from '@/components/study-scope-banner'
import { PageHeader } from '@/components/layout/page-header'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { WordCard } from '@/components/word-card'
import { SpellingInput } from '@/features/learn/components/spelling-input'
import { SessionComplete } from '@/components/feedback/session-complete'
import { SessionSkeleton } from '@/components/feedback/session-skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import { Checkmark } from '@/components/feedback/checkmark'
import { XpPopLayer, popXpFromElement, useXpPops } from '@/components/feedback/xp-pop'
import { speak } from '@/lib/tts'
import { buzz, playSound } from '@/lib/feel'
import { resumeIndexFor, saveResume } from '@/lib/resume'
import { GRADE_XP } from '@/lib/srs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { gradeEnter, gradeExit, listItem, stagger, useMotionSafe } from '@/lib/motion'

type Stage = 'recall' | 'spell' | 'result'

const STEPS: { id: Stage; label: string }[] = [
  { id: 'recall', label: 'Recall' },
  { id: 'spell', label: 'Spell' },
  { id: 'result', label: 'Check' },
]

export function LearnView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState<Stage>('recall')
  const [spelling, setSpelling] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [done, setDone] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [levelBefore, setLevelBefore] = useState('')
  const [levelAfter, setLevelAfter] = useState('')
  const [streak, setStreak] = useState(0)
  const [dueAfter, setDueAfter] = useState(0)
  const studyCategory = useAppStore((s) => s.studyCategory)
  const setStudyCategory = useAppStore((s) => s.setStudyCategory)
  const navigate = useAppStore((s) => s.navigate)
  const autoSpeak = useAppStore((s) => s.autoSpeak)
  const { pops, pop } = useXpPops()
  const { v, t } = useMotionSafe()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const lastSpokenWordIdRef = useRef<string | null>(null)

  const studyCategoryRef = useRef(studyCategory)
  useEffect(() => {
    studyCategoryRef.current = studyCategory
  }, [studyCategory])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, settings, stats] = await Promise.all([
        api.getNewCards(null, 10, studyCategoryRef.current?.id),
        api.getSettings(),
        api.getDashboardStats(),
      ])
      setCards(list)
      setTtsVoice(settings.ttsVoice)
      setTtsRate(settings.ttsRate)
      setLevelBefore(stats.level.name)
      setStreak(stats.streak)
      const start = list.length ? resumeIndexFor('learn', list.length) : 0
      setIdx(start)
      setStage('recall')
      setDone(false)
      setCorrectCount(0)
      setXpEarned(0)
      if (list.length) {
        saveResume({
          view: 'learn',
          label: 'New words',
          detail: `${list.length - start} to go`,
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

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const current = cards[idx]

  // Auto-pronounce word when card opens if autoSpeak is enabled
  useEffect(() => {
    if (!autoSpeak || !current || stage !== 'recall' || loading) return
    if (lastSpokenWordIdRef.current === current.word.id) return
    lastSpokenWordIdRef.current = current.word.id
    const id = window.setTimeout(() => {
      speak(current.word.word, { voice: ttsVoice, rate: ttsRate })
    }, 200)
    return () => window.clearTimeout(id)
  }, [autoSpeak, current, stage, loading, ttsVoice, ttsRate])

  const reveal = useCallback(() => {
    if (!current) return
    playSound('tap')
    buzz('light')
    setStage('spell')
    setSpelling('')
    setAttempts(0)
    if (!speak(current.word.word, { voice: ttsVoice, rate: ttsRate })) {
      toast.error('Pronunciation is unavailable in this browser.')
    }
  }, [current, ttsRate, ttsVoice])

  const finishCard = useCallback(
    async (correct: boolean) => {
      if (!current) return
      setWasCorrect(correct)
      setStage('result')
      const gained = correct ? GRADE_XP[5] : GRADE_XP[0]
      setXpEarned((x) => x + gained)
      if (correct) setCorrectCount((c) => c + 1)
      if (correct) {
        playSound('correct')
        buzz('success')
      } else {
        playSound('wrong')
        buzz('error')
      }
      popXpFromElement(gained, primaryRef.current, pop)
      void api.submitReview(current.word.id, correct ? 5 : 0, 'learn').catch(() => {})
    },
    [current, pop]
  )

  const submitSpelling = useCallback(() => {
    if (!current || !spelling.trim() || stage !== 'spell') return
    const correct = spelling.trim().toLowerCase() === current.word.word.toLowerCase()
    if (!correct && attempts === 0) {
      setAttempts(1)
      setShakeKey((k) => k + 1)
      playSound('wrong')
      buzz('error')
      return
    }
    void finishCard(correct)
  }, [attempts, current, finishCard, spelling, stage])

  const next = useCallback(async () => {
    const last = idx + 1 >= cards.length
    if (last) {
      try {
        const stats = await api.getDashboardStats()
        setLevelAfter(stats.level.name)
        setStreak(stats.streak)
        setDueAfter(stats.dueCount)
      } catch {
        /* offline */
      }
      setDone(true)
      return
    }
    const nextIdx = idx + 1
    setIdx(nextIdx)
    setStage('recall')
    setSpelling('')
    setAttempts(0)
    setWasCorrect(false)
    saveResume({
      view: 'learn',
      label: 'New words',
      detail: `${cards.length - nextIdx} to go`,
      index: nextIdx,
      total: cards.length,
    })
  }, [cards.length, idx])

  // Keyboard navigation & study shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      // In typing mode (spelling step), support modifier shortcuts:
      if (typing && stage === 'spell') {
        const isReplay = (e.altKey && e.key.toLowerCase() === 'r') || (e.ctrlKey && e.code === 'Space')
        if (isReplay) {
          e.preventDefault()
          if (current) speak(current.word.word, { voice: ttsVoice, rate: ttsRate })
          return
        }

        const isHint = (e.altKey && e.key.toLowerCase() === 'h') || (e.ctrlKey && e.key.toLowerCase() === 'h')
        if (isHint) {
          e.preventDefault()
          if (attempts === 0) {
            setAttempts(1)
            playSound('tap')
          } else {
            void finishCard(false)
          }
          return
        }

        return
      }

      if (typing) return

      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Stage recall
      if (stage === 'recall') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          reveal()
          return
        }
        if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'p') {
          e.preventDefault()
          if (current) speak(current.word.word, { voice: ttsVoice, rate: ttsRate })
          return
        }
      }

      // Stage result
      if (stage === 'result') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          void next()
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [attempts, cards.length, current, finishCard, idx, next, reveal, stage, ttsRate, ttsVoice])

  const levelUp = useMemo(() => !!levelAfter && levelBefore !== levelAfter, [levelAfter, levelBefore])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <SessionSkeleton />
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <SessionComplete
          title="New words locked in"
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
        {dueAfter > 0 ? (
          <NextStep
            title="Review is waiting"
            hint={`${dueAfter} card${dueAfter === 1 ? '' : 's'} are due now — clearing them is what makes today\u2019s words stick.`}
            actionLabel={`Review ${dueAfter}`}
            onAction={() => navigate('review')}
          />
        ) : (
          <NextStep
            title="Now hear what you just learned"
            hint="Dictation replays today’s words by ear — the fastest way to make them stick."
            actionLabel="Start dictation"
            onAction={() => navigate('dictation')}
            secondary={
              <Button variant="outline" size="sm" onClick={() => navigate('quiz')}>
                Quiz instead
              </Button>
            }
          />
        )}
      </div>
    )
  }

  if (!cards.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <StudyScopeBanner />
        <PageHeader
          eyebrow="Learn"
          icon={Keyboard}
          title={studyCategory ? `No new words in “${studyCategory.name}”` : 'No new words right now'}
          description={
            studyCategory
              ? `All words in the "${studyCategory.name}" category have already been introduced, or none have been assigned to it yet.`
              : 'Every word in your library has already been introduced.'
          }
        />
        <EmptyState
          icon={Volume2}
          title={studyCategory ? 'Try another category or all words' : 'Add words to keep going'}
          hint={
            studyCategory
              ? 'You can clear the category filter to learn words across all decks, or pick another category.'
              : 'Import a list, create a deck, or review what you already have so it never fades.'
          }
          actionLabel={studyCategory ? 'Learn all categories' : 'Open library'}
          onAction={() => {
            if (studyCategory) setStudyCategory(null)
            else navigate('library')
          }}
          secondary={
            studyCategory ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('library', { libraryTab: 'decks' })}>
                Manage categories
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate('review')}>
                Review instead
              </Button>
            )
          }
        />
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.id === stage)
  const progressPct = ((idx + (stage === 'result' ? 1 : 0)) / cards.length) * 100

  return (
    <div className="mx-auto max-w-3xl">
      <XpPopLayer pops={pops} />
      <StudyScopeBanner />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="label text-primary">Learn</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="num">
              {idx + 1} / {cards.length}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{STEPS[Math.max(0, stepIndex)].label}</span>
          </div>
        </div>
        <ol className="flex shrink-0 items-center gap-1.5" aria-label="Session steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-1.5 rounded-full transition-all duration-200',
                  i === stepIndex ? 'w-6 bg-primary' : i < stepIndex ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted'
                )}
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-5 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Session progress" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${progressPct}%` }}
          transition={t({ duration: 0.3, ease: [0.16, 1, 0.3, 1] })}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.word.id}
          initial={gradeEnter(4).initial}
          animate={gradeEnter(4).animate}
          exit={gradeExit(stage === 'result' ? (wasCorrect ? 5 : 0) : 4).exit}
          transition={t()}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={(_, info) => {
            if (info.offset.x < -90) {
              if (stage === 'recall') reveal()
              else if (stage === 'result') void next()
            }
          }}
          className="touch-pan-y"
        >
          <WordCard
            word={current.word}
            ttsVoice={ttsVoice}
            ttsRate={ttsRate}
            showDefinition={stage !== 'recall'}
            hideWord={stage === 'spell'}
          />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {stage === 'recall' ? (
          <motion.div key="recall" variants={v(stagger(0.04))} initial="hidden" animate="show" exit="exit" className="mt-4">
            <motion.div variants={v(listItem)} transition={t()} className="surface p-5 text-center sm:p-6">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary" aria-hidden="true">
                <Keyboard className="h-4 w-4" />
              </div>
              <h2 className="mt-3 text-sm font-semibold">Say the meaning in your head first</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                Trying to retrieve it — even when you are unsure — is what builds the memory.
              </p>
              <Button ref={primaryRef} size="lg" onClick={reveal} data-testid="learn-reveal" className="mt-5 w-full sm:w-auto sm:px-10">
                Reveal and listen
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-3 text-xs text-muted-foreground"><span className="hidden sm:inline">Space to reveal · swipe left</span><span className="sm:hidden">Tap to reveal</span></p>
            </motion.div>
          </motion.div>
        ) : null}

        {stage === 'spell' ? (
          <motion.div key="spell" variants={v(stagger(0.04))} initial="hidden" animate="show" exit="exit" className="mt-4">
            <motion.div variants={v(listItem)} transition={t()} className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Listen and spell it</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!speak(current.word.word, { voice: ttsVoice, rate: ttsRate })) {
                      toast.error('Pronunciation is unavailable in this browser.')
                    }
                  }}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Play
                </Button>
              </div>
              <div key={shakeKey} className={cn(attempts > 0 && 'shake')}>
                <SpellingInput
                  value={spelling}
                  onChange={setSpelling}
                  target={current.word.word}
                  autoFocus
                  onSubmit={submitSpelling}
                  placeholder="Type the word you hear…"
                  size="xl"
                />
              </div>
              {attempts > 0 ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-center text-sm font-medium text-warning"
                >
                  Try again — check the spelling. One more attempt.
                </p>
              ) : null}
              <Button ref={primaryRef} onClick={submitSpelling} disabled={!spelling.trim()} data-testid="learn-check" className="mt-4 w-full">
                Check answer
                <ArrowRight className="h-4 w-4" />
              </Button>
              {attempts > 0 ? (
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => void finishCard(false)}>
                  Show me the answer
                </Button>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}

        {stage === 'result' ? (
          <motion.div key="result" variants={v(stagger(0.04))} initial="hidden" animate="show" exit="exit" className="mt-4">
            <motion.div variants={v(listItem)} transition={t()} className="surface p-5 sm:p-6">
              <div className="flex flex-col items-center text-center">
                <Checkmark size={48} tone={wasCorrect ? 'success' : 'error'} />
                <div className="mt-4 text-base font-semibold">
                  {wasCorrect ? `Correct — +${GRADE_XP[5]} XP` : `Saved for another round — +${GRADE_XP[0]} XP`}
                </div>
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {wasCorrect
                    ? `You spelled “${current.word.word}” correctly.`
                    : `The correct spelling is “${current.word.word}”. It will come back sooner so you get another go.`}
                </p>
              </div>
              <Button ref={primaryRef} onClick={() => void next()} data-testid="learn-next" className="mt-5 w-full cursor-pointer shadow-sm">
                {idx + 1 >= cards.length ? 'Finish session' : 'Next word'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Press Enter or Space to continue</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Laptop Keyboard HUD Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-4 py-2 text-xs text-muted-foreground backdrop-blur-xs">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              {stage === 'spell' ? 'Enter' : 'Space / Enter'}
            </kbd>
            <span>{stage === 'recall' ? 'Reveal & Hear' : stage === 'spell' ? 'Check answer' : 'Next Word'}</span>
          </span>
          {stage === 'recall' ? (
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                R
              </kbd>
              <span>Hear again</span>
            </span>
          ) : stage === 'spell' ? (
            <>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                  Alt+R / ⌃Space
                </kbd>
                <span>Replay audio</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                  Alt+H
                </kbd>
                <span>Hint / Skip</span>
              </span>
            </>
          ) : null}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          Step {stage === 'recall' ? '1: Recall' : stage === 'spell' ? '2: Spell' : '3: Result'}
        </span>
      </div>
    </div>
  )
}
