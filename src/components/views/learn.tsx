'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Keyboard, Volume2 } from 'lucide-react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/page-header'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { WordCardV2 } from '@/components/word/word-card-v2'
import { SpellingInput } from '@/components/word/spelling-input'
import { SessionCompleteV2 } from '@/components/feedback/session-complete-v2'
import { SessionSkeleton } from '@/components/feedback/session-skeleton'
import { EmptyState } from '@/components/feedback/empty-state'
import { Checkmark } from '@/components/feedback/checkmark'
import { XpPopLayer, popXpFromElement, useXpPops } from '@/components/feedback/xp-pop'
import { speak } from '@/lib/tts'
import { buzz, playSound } from '@/lib/feel'
import { celebrate } from '@/components/feedback/confetti'
import { resumeIndexFor, saveResume } from '@/lib/resume'
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
  const navigate = useAppStore((s) => s.navigate)
  const { pops, pop } = useXpPops()
  const { v, t } = useMotionSafe()
  const primaryRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, settings, stats] = await Promise.all([
        api.getNewCards(null, 10),
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
    load()
  }, [load])

  const current = cards[idx]

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
      const gained = correct ? 5 : 1
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

  // Keyboard: Space/Enter drives the whole loop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (typing) return
      if ((e.key === ' ' || e.key === 'Enter') && stage === 'recall') {
        e.preventDefault()
        reveal()
      } else if ((e.key === ' ' || e.key === 'Enter') && stage === 'result') {
        e.preventDefault()
        if (idx + 1 >= cards.length) void next()
        else void next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards.length, idx, next, reveal, stage])

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
        <SessionCompleteV2
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
        <PageHeader eyebrow="Learn" icon={Keyboard} title="No new words right now" description="Every word in your library has already been introduced." />
        <EmptyState
          icon={Volume2}
          title="Add words to keep going"
          hint="Import a list, create a deck, or review what you already have so it never fades."
          actionLabel="Open library"
          onAction={() => navigate('library')}
          secondary={
            <Button variant="ghost" size="sm" onClick={() => navigate('review')}>
              Review instead
            </Button>
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

      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="label text-primary">Learn</div>
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
          <WordCardV2
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
              <Button ref={primaryRef} size="lg" onClick={reveal} className="mt-5 w-full sm:w-auto sm:px-10">
                Reveal and listen
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">Space to reveal · swipe left</p>
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
              <Button ref={primaryRef} onClick={submitSpelling} disabled={!spelling.trim()} className="mt-4 w-full">
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
                  {wasCorrect ? 'Correct — +5 XP' : 'Saved for another round — +1 XP'}
                </div>
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {wasCorrect
                    ? `You spelled “${current.word.word}” correctly.`
                    : `The correct spelling is “${current.word.word}”. It will come back sooner so you get another go.`}
                </p>
              </div>
              <Button ref={primaryRef} onClick={() => void next()} className="mt-5 w-full">
                {idx + 1 >= cards.length ? 'Finish session' : 'Next word'}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Enter to continue</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
