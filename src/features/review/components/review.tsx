'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainCircuit, Flame, Snail, Sparkles, Star, Undo2, Volume2 } from 'lucide-react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SessionComplete } from '@/components/feedback/session-complete'
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

const GRADES: { grade: Grade; key: string; label: string; hint: string; borderCls: string; badgeCls: string; activeCls: string }[] = [
  {
    grade: 0,
    key: '1',
    label: 'Again',
    hint: 'Forgot completely',
    borderCls: 'border-destructive/30 hover:border-destructive/80 hover:bg-destructive-soft/50 text-destructive',
    badgeCls: 'bg-destructive/10 text-destructive',
    activeCls: 'active:bg-destructive-soft',
  },
  {
    grade: 3,
    key: '2',
    label: 'Hard',
    hint: 'Tough recall',
    borderCls: 'border-warning/30 hover:border-warning/80 hover:bg-warning-soft/50 text-warning',
    badgeCls: 'bg-warning/10 text-warning',
    activeCls: 'active:bg-warning-soft',
  },
  {
    grade: 4,
    key: '3',
    label: 'Good',
    hint: 'Clean recall',
    borderCls: 'border-success/30 hover:border-success/80 hover:bg-success-soft/50 text-success',
    badgeCls: 'bg-success/10 text-success',
    activeCls: 'active:bg-success-soft',
  },
  {
    grade: 5,
    key: '4',
    label: 'Easy',
    hint: 'Instant & clear',
    borderCls: 'border-primary/30 hover:border-primary/80 hover:bg-primary-soft/50 text-primary',
    badgeCls: 'bg-primary/10 text-primary',
    activeCls: 'active:bg-primary-soft',
  },
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

type ReviewHistoryItem = {
  card: CardWithWord
  index: number
  grade: Grade
  xp: number
  passed: boolean
}

export function ReviewView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [lastGrade, setLastGrade] = useState<Grade>(4)
  const [combo, setCombo] = useState(0)
  const [history, setHistory] = useState<ReviewHistoryItem[]>([])
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [done, setDone] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [levelBefore, setLevelBefore] = useState('')
  const [levelAfter, setLevelAfter] = useState('')
  const [streak, setStreak] = useState(0)
  const [newAfter, setNewAfter] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  // Read bookmark state from localStorage — use lazy initialization to avoid
  // synchronous setState in effect (React 19 best practice).
  const [bookmarked, setBookmarked] = useState(() => {
    try {
      const raw = localStorage.getItem('lexilearn-bookmarked-words')
      if (raw) {
        const list: string[] = JSON.parse(raw)
        return Array.isArray(list) && list.includes(cards[idx]?.word.word.toLowerCase() ?? '')
      }
    } catch {}
    return false
  })
  const navigate = useAppStore((s) => s.navigate)
  const autoSpeak = useAppStore((s) => s.autoSpeak)
  const { pops, pop } = useXpPops()
  const { v, t } = useMotionSafe()
  const gradeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const lastSpokenWordIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!cards[idx]) return
    try {
      const raw = localStorage.getItem('lexilearn-bookmarked-words')
      if (raw) {
        const list: string[] = JSON.parse(raw)
        setBookmarked(Array.isArray(list) && list.includes(cards[idx].word.word.toLowerCase()))
      } else {
        setBookmarked(false)
      }
    } catch {
      setBookmarked(false)
    }
  }, [cards, idx])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [due, settings, stats] = await Promise.all([
        api.getReviewableCards(null, 30),
        api.getSettings(),
        api.getDashboardStats(),
      ])
      // Nothing due yet (brand-new account) → practice the newest words so
      // Review is never a dead end; real due cards always come first (B1).
      const list = due.length ? due : await api.getNewCards(null, 30)
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
      setCombo(0)
      setHistory([])
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

  // Auto-pronounce word when review card opens if autoSpeak is enabled
  useEffect(() => {
    if (!autoSpeak || !current || done || loading) return
    if (lastSpokenWordIdRef.current === current.word.id) return
    lastSpokenWordIdRef.current = current.word.id
    const id = window.setTimeout(() => {
      setSpeaking(true)
      setTimeout(() => setSpeaking(false), 1400)
      speak(current.word.word, { voice: ttsVoice, rate: ttsRate })
    }, 200)
    return () => window.clearTimeout(id)
  }, [autoSpeak, current, done, loading, ttsVoice, ttsRate])

  const playAudio = useCallback((slow = false) => {
    if (!current) return
    playSound('tap')
    setSpeaking(true)
    setTimeout(() => setSpeaking(false), 1400)
    const rate = slow ? 0.72 : (ttsRate || 1)
    if (!speak(current.word.word, { voice: ttsVoice, rate })) {
      toast.error('Pronunciation is unavailable in this browser.')
    }
  }, [current, ttsRate, ttsVoice])

  const toggleBookmark = useCallback(() => {
    if (!current) return
    playSound('tap')
    const next = !bookmarked
    setBookmarked(next)
    try {
      const raw = localStorage.getItem('lexilearn-bookmarked-words')
      let list: string[] = raw ? JSON.parse(raw) : []
      if (!Array.isArray(list)) list = []
      const lower = current.word.word.toLowerCase()
      if (next && !list.includes(lower)) list.push(lower)
      else if (!next) list = list.filter((w) => w !== lower)
      localStorage.setItem('lexilearn-bookmarked-words', JSON.stringify(list))
      window.dispatchEvent(new CustomEvent('lexilearn-bookmarks-changed'))
      toast.success(next ? `Starred "${current.word.word}"` : `Unstarred "${current.word.word}"`)
    } catch {}
  }, [bookmarked, current])

  const reveal = useCallback(() => {
    if (!current) return
    playSound('flip')
    buzz('light')
    setRevealed(true)
  }, [current])

  const undoGrade = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setIdx(prev.index)
    setRevealed(true)
    if (prev.passed) setCorrectCount((c) => Math.max(0, c - 1))
    setXpEarned((x) => Math.max(0, x - prev.xp))
    setCombo((c) => Math.max(0, c - 1))
    toast.info(`Restored "${prev.card.word.word}" for re-grading`)
    playSound('tap')
  }, [history])

  const grade = useCallback(
    async (g: Grade, e?: { clientX: number; clientY: number }, buttonIndex?: number) => {
      if (!current || !revealed) return
      setLastGrade(g)
      const passed = g >= 3

      // Streak fire bonus: +20% XP if combo >= 2
      let xp = GRADE_XP[g]
      if (passed && combo >= 2) {
        xp = Math.round(xp * 1.2)
      }

      if (passed) {
        const nextCombo = combo + 1
        setCombo(nextCombo)
        if (nextCombo >= 3) {
          playSound('combo')
        } else {
          playSound('correct')
        }
        buzz('success')
      } else {
        setCombo(0)
        playSound('wrong')
        buzz('error')
      }

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
      setHistory((h) => [...h, { card: current, index: idx, grade: g, xp, passed }])
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
    [cards.length, combo, current, idx, pop, revealed]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      
      // Undo: Cmd+Z or Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undoGrade()
        return
      }

      // Audio replay: R for normal, S for slow
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        playAudio(false)
        return
      }
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        playAudio(true)
        return
      }

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
  }, [grade, playAudio, reveal, revealed, undoGrade])

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
        <SessionComplete
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
  const cefr = current?.word.cefr?.toUpperCase() ?? ''
  const cefrGlow = cefr.startsWith('A')
    ? 'cefr-glow-a'
    : cefr.startsWith('B')
    ? 'cefr-glow-b'
    : cefr.startsWith('C')
    ? 'cefr-glow-c'
    : ''

  return (
    <div className="mx-auto max-w-2xl">
      <XpPopLayer pops={pops} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="label text-primary">Review</div>
          <div className="mt-0.5 text-sm text-muted-foreground num">
            {idx + 1} / {cards.length} due
          </div>
        </div>

        {combo >= 3 ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 combo-fire shadow-xs"
          >
            <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500 animate-pulse" />
            <span>{combo}× Streak Fire (+1.2× XP)</span>
          </motion.div>
        ) : null}

        <div className="flex items-center gap-2">
          {history.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={undoGrade}
              title="Undo last grade (⌘Z)"
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Undo
            </Button>
          ) : null}
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Space to flip · 1–4 to grade</span>
            <span className="sm:hidden">Tap to flip</span>
          </span>
        </div>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Review progress" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${progressPct}%` }}
          transition={t({ duration: 0.3, ease: [0.16, 1, 0.3, 1] })}
        />
      </div>

      <div className="perspective-1000">
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
            className="touch-pan-y preserve-3d"
          >
            <div className={cn('surface p-5 sm:p-6 transition-all duration-300', cefrGlow)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                      {current.word.word}
                    </h1>
                    {current.word.cefr ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-mono text-xs font-semibold px-2 py-0.5 rounded-md',
                          current.word.cefr.startsWith('A') && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                          current.word.cefr.startsWith('B') && 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                          current.word.cefr.startsWith('C') && 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        )}
                      >
                        {current.word.cefr}
                      </Badge>
                    ) : null}
                  </div>
                  {current.word.ipa ? (
                    <p className="mt-1.5 font-mono text-sm text-muted-foreground">{current.word.ipa}</p>
                  ) : null}
                  {current.word.pos ? (
                    <p className="mt-0.5 text-sm italic text-muted-foreground">{current.word.pos}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleBookmark}
                    className={cn(
                      'h-9 w-9 text-muted-foreground hover:text-amber-500 transition-colors cursor-pointer',
                      bookmarked && 'text-amber-500'
                    )}
                    title={bookmarked ? 'Unstar word' : 'Star word'}
                    aria-label={bookmarked ? 'Unstar word' : 'Star word'}
                  >
                    <Star className={cn('h-4 w-4', bookmarked && 'fill-current scale-110')} />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    title="Pronounce slowly (S)"
                    aria-label={`Hear ${current.word.word} slowly`}
                    onClick={() => playAudio(true)}
                  >
                    <Snail className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-lg"
                    variant={speaking ? 'soft' : 'outline'}
                    title="Pronounce (R)"
                    aria-label={`Hear ${current.word.word}`}
                    onClick={() => playAudio(false)}
                    className={cn('relative transition-all cursor-pointer', speaking && 'text-primary border-primary audio-pulse')}
                  >
                    <Volume2 className={cn('h-5 w-5', speaking && 'scale-110')} />
                  </Button>
                </div>
              </div>

              {!revealed ? (
                <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs" aria-hidden="true">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <p className="mt-3.5 text-base font-semibold tracking-tight">Recall it before you reveal</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Say the meaning or picture it clearly in your head, then check yourself.
                  </p>
                  <Button size="lg" onClick={reveal} data-testid="review-reveal" className="mt-5 w-full sm:w-auto sm:px-10 cursor-pointer shadow-sm">
                    Reveal answer
                    <kbd className="ml-2 rounded border border-primary-foreground/30 bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold">
                      Space
                    </kbd>
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
                    <motion.div variants={v(listItem)} transition={t()} className="rounded-lg border border-border/60 bg-muted/40 p-3.5">
                      <div className="label text-muted-foreground">Amharic (አማርኛ)</div>
                      <div className="mt-1 text-[15px] font-medium" lang="am">{current.word.amharic}</div>
                    </motion.div>
                  ) : null}

                  {current.word.examples[0] ? (
                    <motion.blockquote
                      variants={v(listItem)}
                      transition={t()}
                      className="border-l-2 border-primary-line bg-primary-soft rounded-r-lg px-3.5 py-3 text-sm italic leading-relaxed"
                    >
                      “{current.word.examples[0]}”
                    </motion.blockquote>
                  ) : null}

                  <motion.div variants={v(listItem)} transition={t()}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="label text-muted-foreground">How well did you recall it?</div>
                      <span className="text-xs text-muted-foreground hidden sm:inline">Press 1–4</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {GRADES.map((g, i) => {
                        const interval = previewInterval(current.srs, g.grade)
                        return (
                          <button
                            key={g.grade}
                            ref={(el) => {
                              gradeRefs.current[i] = el
                            }}
                            type="button"
                            data-testid={`grade-${g.label.toLowerCase()}`}
                            onClick={(e) => void grade(g.grade, e, i)}
                            className={cn(
                              'group relative flex min-h-[82px] flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-xs transition-all duration-150 cursor-pointer active:scale-[.97]',
                              g.borderCls,
                              g.activeCls
                            )}
                          >
                            <div className="flex items-start justify-between w-full">
                              <span className="text-sm font-bold tracking-tight">{g.label}</span>
                              <kbd className="flex h-5 w-5 items-center justify-center rounded-md border border-border/60 bg-muted/70 font-mono text-[11px] font-semibold text-muted-foreground">
                                {g.key}
                              </kbd>
                            </div>
                            
                            <div className="mt-1">
                              <span className="block text-[11px] text-muted-foreground/90 font-medium">{g.hint}</span>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-primary/90">+{GRADE_XP[g.grade]} XP</span>
                                {interval ? (
                                  <span className={cn('text-[10px] font-medium px-1.5 py-0.2 rounded', g.badgeCls)}>
                                    {interval}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>

                  <motion.div variants={v(listItem)} transition={t()} className="flex justify-center pt-1">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" onClick={() => navigate('coach')}>
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                      Struggling with this one? Fix it with the AI Coach
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Laptop Keyboard HUD Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-4 py-2 text-xs text-muted-foreground backdrop-blur-xs">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              Space
            </kbd>
            <span>{revealed ? 'Next' : 'Reveal'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              1–4
            </kbd>
            <span>Grade</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              R
            </kbd>
            <span>Audio</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              S
            </kbd>
            <span>Slow</span>
          </span>
        </div>
        {history.length > 0 ? (
          <button
            type="button"
            onClick={undoGrade}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Undo previous review (⌘Z / Ctrl+Z)"
          >
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
              ⌘Z
            </kbd>
            <Undo2 className="h-3 w-3" />
            <span>Undo</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
