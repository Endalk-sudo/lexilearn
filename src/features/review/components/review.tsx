'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BrainCircuit, Flame, Snail, Sparkles, Star, Undo2, Volume2 } from 'lucide-react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { NextStep } from '@/components/layout/next-step'
import { StudyScopeBanner } from '@/components/study-scope-banner'
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
import { studyColClassName, useFirstCardHints, useStudyPrefs } from '@/features/study/ui/study-scale'

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
  /** Matches the pending-submit queue entry so Undo can cancel the write. */
  key: string
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
  const { focusMode, setFocusMode } = useStudyPrefs()
  // First card of the tab session teaches the keys; reveal/grade dismisses.
  const [showHints, dismissHints] = useFirstCardHints()
  const studyCategory = useAppStore((s) => s.studyCategory)
  const setStudyCategory = useAppStore((s) => s.setStudyCategory)
  const { pops, pop } = useXpPops()
  const { v, t } = useMotionSafe()
  const gradeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const lastSpokenWordIdRef = useRef<string | null>(null)
  // Pending review writes: grading a card queues its submit instead of
  // posting immediately, so Undo can cancel it before anything reaches the
  // server. The queue flushes on session finish (awaited, so the closing
  // stats read includes every card) and best-effort on unmount.
  const pendingSubmits = useRef<{ key: string; wordId: string; grade: Grade }[]>([])
  // Synchronous double-grade guard: state updates don't land before a
  // same-tick second click/keypress, so a ref blocks the re-entry.
  const gradingRef = useRef(false)

  const flushPending = useCallback(async () => {
    const batch = pendingSubmits.current
    pendingSubmits.current = []
    await Promise.allSettled(batch.map((p) => api.submitReview(p.wordId, p.grade, 'review')))
  }, [])

  useEffect(() => {
    const pending = pendingSubmits
    return () => {
      const batch = pending.current
      pending.current = []
      for (const p of batch) void api.submitReview(p.wordId, p.grade, 'review').catch(() => {})
    }
  }, [])

  // Re-sync when the card changes. Deferred past the effect body so it never
  // sets state synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!cards[idx]) return
    const id = window.setTimeout(() => {
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
    }, 0)
    return () => window.clearTimeout(id)
  }, [cards, idx])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The fallback is fired eagerly too: the old code awaited getNewCards
      // only after learning `due` was empty, adding a full round trip to the
      // slowest path (brand-new-account Review). Both reads are independent.
      const [due, fresh, settings, stats] = await Promise.all([
        api.getReviewableCards(null, 30, studyCategory?.id),
        api.getNewCards(null, 30, studyCategory?.id),
        api.getSettings(),
        api.getDashboardStats(),
      ])
      // Nothing due yet (brand-new account) → practice the newest words so
      // Review is never a dead end; real due cards always come first (B1).
      const list = due.length ? due : fresh
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
  }, [studyCategory])

  const lastLoadedScopeRef = useRef<string | null>(null)

  // Initial data fetch on mount and reload when category scope changes
  useEffect(() => {
    const scopeKey = studyCategory?.id ?? '__all__'
    if (lastLoadedScopeRef.current === scopeKey) return
    lastLoadedScopeRef.current = scopeKey
    void load()
  }, [load, studyCategory])

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
    dismissHints()
    setRevealed(true)
  }, [current, dismissHints])

  // F: focus mode — see the same handler on Learn/Quiz. One listener per
  // mounted study page is fine: switching views unmounts the old listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        useAppStore.getState().setFocusMode(!useAppStore.getState().focusMode)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const undoGrade = useCallback(() => {
    if (done || history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    // Cancel the queued server write for this card, if it hasn't flushed.
    pendingSubmits.current = pendingSubmits.current.filter((p) => p.key !== prev.key)
    setIdx(prev.index)
    setRevealed(true)
    if (prev.passed) setCorrectCount((c) => Math.max(0, c - 1))
    setXpEarned((x) => Math.max(0, x - prev.xp))
    setCombo((c) => Math.max(0, c - 1))
    toast.info(`Restored "${prev.card.word.word}" for re-grading`)
    playSound('tap')
  }, [done, history])

  const grade = useCallback(
    async (g: Grade, e?: { clientX: number; clientY: number }, buttonIndex?: number) => {
      if (!current || !revealed || gradingRef.current) return
      gradingRef.current = true
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
      const key = `${idx}:${current.word.id}`
      setHistory((h) => [...h, { card: current, index: idx, grade: g, xp, passed, key }])
      // Queue the write; it flushes on finish (or unmount) so Undo can
      // still cancel it. Nothing has reached the server at this point.
      pendingSubmits.current.push({ key, wordId: current.word.id, grade: g })

      const last = idx + 1 >= cards.length
      if (last) {
        await flushPending()
        try {
          const stats = await api.getDashboardStats()
          setLevelAfter(stats.level.name)
          setStreak(stats.streak)
          setNewAfter(stats.newCount)
        } catch {
          /* offline */
        }
        setDone(true)
        gradingRef.current = false
        return
      }
      const nextIdx = idx + 1
      gradingRef.current = false
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
    [cards.length, combo, current, flushPending, idx, pop, revealed]
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
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          const goodMatch = GRADES.find((g) => g.grade === 4)
          const buttonIndex = goodMatch ? GRADES.indexOf(goodMatch) : 2
          void grade(4, undefined, buttonIndex)
          return
        }
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
        <StudyScopeBanner />
        <EmptyState
          icon={BrainCircuit}
          title={studyCategory ? `Nothing due in “${studyCategory.name}”` : 'Nothing is due right now'}
          hint={
            studyCategory
              ? 'No words in this category are due for review right now. You can clear the category filter to review all due cards.'
              : 'That is the point of spaced repetition — the next batch arrives exactly when you would start forgetting it.'
          }
          actionLabel={studyCategory ? 'Review all categories' : 'Learn new words'}
          onAction={() => {
            if (studyCategory) setStudyCategory(null)
            else navigate('learn')
          }}
          secondary={
            <Button variant="ghost" size="sm" onClick={() => navigate('library', { libraryTab: 'decks' })}>
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
    <div className={studyColClassName('pb-24')}>
      <XpPopLayer pops={pops} />
      <StudyScopeBanner />
      {focusMode ? (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="rounded-full border border-border/70 bg-card/80 px-3.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground cursor-pointer"
          >
            Focus · Esc to exit
          </button>
        </div>
      ) : null}

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
            <div className={cn('surface p-6 sm:p-8 transition-all duration-300', cefrGlow)}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="study-head break-words text-foreground">
                      {current.word.word}
                    </h1>
                    {current.word.cefr ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-mono text-sm font-semibold px-2.5 py-1 rounded-md',
                          current.word.cefr.startsWith('A') && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                          current.word.cefr.startsWith('B') && 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                          current.word.cefr.startsWith('C') && 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        )}
                      >
                        {current.word.cefr}
                      </Badge>
                    ) : null}
                  </div>
                  {current.word.ipa || current.word.pos ? (
                    <p className="study-meta mt-2.5 text-muted-foreground">
                      {current.word.pos ? (
                        <span className="mr-3 font-semibold lowercase italic">{current.word.pos}</span>
                      ) : null}
                      {current.word.ipa ? <span className="font-mono">{current.word.ipa}</span> : null}
                    </p>
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
                <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-7 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs" aria-hidden="true">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-xl font-semibold tracking-tight">Recall it before you reveal</p>
                  <p className="mx-auto mt-1.5 max-w-md text-base leading-relaxed text-muted-foreground">
                    Say the meaning or picture it clearly in your head, then check yourself.
                  </p>
                  <Button size="lg" onClick={reveal} data-testid="review-reveal" className="mt-6 h-12 w-full px-10 text-base cursor-pointer shadow-sm sm:w-auto">
                    Reveal answer
                    <kbd className="ml-2 rounded border border-primary-foreground/30 bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold">
                      Space
                    </kbd>
                  </Button>
                </div>
              ) : (
                <motion.div variants={v(stagger(0.04))} initial="hidden" animate="show" className="mt-6 space-y-[var(--study-gap)] border-t border-border pt-6">
                  {current.word.definitions.length > 0 ? (
                    <motion.div variants={v(listItem)} transition={t()}>
                      <div className="label text-muted-foreground">Meaning</div>
                      <ul className="mt-2.5 space-y-2">
                        {current.word.definitions.map((d, i) => (
                          <li key={i} className="study-body">
                            {d.pos ? <span className="mr-2 text-[0.85em] italic text-muted-foreground">{d.pos}</span> : null}
                            {d.text}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ) : null}

                  {current.word.amharic ? (
                    <motion.div variants={v(listItem)} transition={t()} className="rounded-xl border border-border/60 bg-muted/40 p-4 sm:p-5">
                      <div className="label text-muted-foreground">Amharic (አማርኛ)</div>
                      <div className="study-amharic mt-1.5 font-medium" lang="am">{current.word.amharic}</div>
                    </motion.div>
                  ) : null}

                  {current.word.examples[0] ? (
                    <motion.blockquote
                      variants={v(listItem)}
                      transition={t()}
                      className="border-l-2 border-primary-line bg-primary-soft rounded-r-xl px-4 py-3.5 study-example italic"
                    >
                      “{current.word.examples[0]}”
                    </motion.blockquote>
                  ) : null}

                  <motion.div variants={v(listItem)} transition={t()}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="label text-muted-foreground">How well did you recall it?</div>
                      <span className="text-sm text-muted-foreground">Press 1–4</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                              'group relative flex min-h-[96px] flex-col justify-between rounded-xl border bg-card p-3.5 text-left shadow-xs transition-all duration-150 cursor-pointer active:scale-[.97]',
                              g.borderCls,
                              g.activeCls
                            )}
                          >
                            <div className="flex items-start justify-between w-full">
                              <span className="text-base font-bold tracking-tight">{g.label}</span>
                              <kbd className="flex h-5 w-5 items-center justify-center rounded-md border border-border/60 bg-muted/70 font-mono text-[11px] font-semibold text-muted-foreground">
                                {g.key}
                              </kbd>
                            </div>

                            <div className="mt-1.5">
                              <span className="block text-xs text-muted-foreground/90 font-medium">{g.hint}</span>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-primary/90">+{GRADE_XP[g.grade]} XP</span>
                                {interval ? (
                                  <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded', g.badgeCls)}>
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

      {/* Sticky keyboard HUD: pinned to the viewport bottom so the keys never
          scroll away mid-session. First card shows the full cheat sheet;
          after that it collapses to the essentials. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 backdrop-blur-md">
        <div className="study-col mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-muted-foreground sm:px-6">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                Space
              </kbd>
              <span>{revealed ? 'Good' : 'Reveal'}</span>
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
            {showHints ? (
              <>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    S
                  </kbd>
                  <span>Slow</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    M
                  </kbd>
                  <span>Star</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    ⌘Z
                  </kbd>
                  <span>Undo</span>
                </span>
              </>
            ) : null}
          </div>
          <span className="hidden lg:inline text-xs">Swipe card left to reveal</span>
        </div>
      </div>
    </div>
  )
}
