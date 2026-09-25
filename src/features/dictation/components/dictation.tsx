'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, AudioLines, Check, ChevronDown, Ear,
  Keyboard, Lightbulb, Play, Settings2, Snail, Volume2, X,
} from 'lucide-react'
import {
  accuracyOf, buildItems, DICTATION_XP, diffWords, gradeFor, groupDiff,
  loadRung, MIN_SESSION_ITEMS, nextRung, RUNG_LABELS, saveRung, tokenize,
  type DictationGrade, type DictationItem, type DiffSegment, type Rung,
} from '@/features/dictation/lib/dictation'
import {
  createDictationPlayer, PRESET_RATES, useAudioReadiness,
  type AudioProbe, type DictationPlayer, type DictationPreset,
} from '@/features/dictation/lib/dictation-audio'
import { api, type CardWithWord, type WordDTO } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/page-header'
import { NextStep } from '@/components/layout/next-step'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SessionCompleteV2 } from '@/components/feedback/session-complete-v2'
import { EmptyState } from '@/components/feedback/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkmark } from '@/components/feedback/checkmark'
import { XpPopLayer, popXpFromElement, useXpPops } from '@/components/feedback/xp-pop'
import { buzz, playSound, typeFeelFromKey } from '@/lib/feel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { fadeUp, gradeEnter, gradeExit, listItem, stagger, useMotionSafe } from '@/lib/motion'

export interface DictationSessionData {
  items: DictationItem[]
  requestedTotal: number
  rungUsed: Rung
}

export interface DictationSummary {
  accuracy: number
  xp: number
  correct: number
  total: number
  levelUp: boolean
  streak: number
  rungFrom: Rung
  rungTo: Rung
}

type Phase = 'start' | 'loading' | 'session' | 'done'

export function DictationView({ deckId }: { deckId?: string | null }) {
  const [phase, setPhase] = useState<Phase>('start')
  const [preset, setPreset] = useState<DictationPreset>('normal')
  // Rung is persisted client-side (localStorage): read it lazily as the
  // initial state instead of syncing it with setState inside a mount effect.
  const [rung, setRung] = useState<Rung>(() => loadRung())
  const [rungOverride, setRungOverride] = useState<Rung | null>(null)
  const [session, setSession] = useState<DictationSessionData | null>(null)
  const [summary, setSummary] = useState<DictationSummary | null>(null)
  const navigate = useAppStore((s) => s.navigate)
  const { v, t } = useMotionSafe()
  const readiness = useAudioReadiness(true)

  // Lazily created once: the player only touches browser audio APIs when its
  // methods run, so constructing it during render is side-effect free.
  const [player] = useState<DictationPlayer>(() => createDictationPlayer())
  useEffect(() => () => player.stop(), [player])

  const start = useCallback(
    async (override?: Rung | null) => {
      const picked: Rung = override ?? rungOverride ?? rung
      setPhase('loading')
      player.stop()
      try {
        const [reviewable, fresh] = await Promise.all([
          api.getReviewableCards(deckId ?? null, 50),
          api.getNewCards(deckId ?? null, 10),
        ])
        const words: WordDTO[] = [...reviewable, ...fresh].map((c: CardWithWord) => c.word)
        const built = buildItems(words, picked)
        if (built.items.length < MIN_SESSION_ITEMS) {
          setPhase('start')
          toast.error('Not enough words here yet — add a few words first.')
          return
        }
        setSummary(null)
        setSession({ items: built.items, requestedTotal: built.requestedTotal, rungUsed: picked })
        setPhase('session')
      } catch {
        toast.error('Could not load words for dictation.')
        setPhase('start')
      }
    },
    [deckId, player, rung, rungOverride]
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div variants={v(fadeUp)} initial="hidden" animate="show" transition={t()}>
        <PageHeader
          eyebrow="Dictation"
          icon={Ear}
          title="Hear it. Type it."
          description="A word, then a phrase, then a full sentence — all played aloud. Slow and fair is the point."
        />
      </motion.div>

      {phase === 'start' ? (
        <DictationStart
          readiness={readiness}
          preset={preset}
          onPreset={setPreset}
          rung={rung}
          rungOverride={rungOverride}
          onRungOverride={setRungOverride}
          onStart={() => void start()}
          onBrowse={() => navigate('library')}
          onOpenVoiceSettings={() => navigate('progress', { progressTab: 'settings' })}
        />
      ) : null}

      {phase === 'loading' ? (
        <div className="space-y-4" aria-busy="true" aria-label="Preparing dictation">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : null}

      {phase === 'session' && session ? (
        <DictationSession
          key={session.items.map((i) => i.wordId + i.kind).join('|')}
          items={session.items}
          rungUsed={session.rungUsed}
          player={player}
          preset={preset}
          onPreset={setPreset}
          audioReady={readiness.status === 'ready'}
          onFinish={(result) => {
            const rungTo = nextRung(session.rungUsed, result.accuracy)
            saveRung(rungTo)
            setRung(rungTo)
            setSummary({ ...result, rungFrom: session.rungUsed, rungTo })
            setPhase('done')
          }}
          onExit={() => {
            player.stop()
            setPhase('start')
          }}
        />
      ) : null}

      {phase === 'done' && session && summary ? (
        <DictationComplete
          session={session}
          summary={summary}
          onAgain={() => void start()}
          onDone={() => navigate('today')}
        />
      ) : null}
    </div>
  )
}

function DictationStart({
  readiness,
  preset,
  onPreset,
  rung,
  rungOverride,
  onRungOverride,
  onStart,
  onBrowse,
  onOpenVoiceSettings,
}: {
  readiness: { status: 'probing' | 'ready' | 'unavailable'; probe?: AudioProbe }
  preset: DictationPreset
  onPreset: (p: DictationPreset) => void
  rung: Rung
  rungOverride: Rung | null
  onRungOverride: (r: Rung | null) => void
  onStart: () => void
  onBrowse: () => void
  onOpenVoiceSettings: () => void
}) {
  const { v, t } = useMotionSafe()
  const available = readiness.status !== 'unavailable'

  return (
    <motion.div variants={v(stagger(0.05))} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={v(listItem)} transition={t()} className="surface p-5">
        <div className="flex items-center gap-3">
          {readiness.status === 'ready' ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-success-soft text-success" aria-hidden="true">
              <AudioLines className="h-5 w-5" />
            </span>
          ) : readiness.status === 'unavailable' ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-warning-soft text-warning" aria-hidden="true">
              <AlertTriangle className="h-5 w-5" />
            </span>
          ) : (
            <span className="h-10 w-10 animate-pulse rounded-md bg-muted" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {readiness.status === 'ready'
                ? 'Voice ready'
                : readiness.status === 'unavailable'
                  ? 'No voice available'
                  : 'Checking for a voice…'}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {readiness.status === 'ready' && readiness.probe?.ok
                ? `${readiness.probe.voices} English voice${readiness.probe.voices === 1 ? '' : 's'} on this device`
                : readiness.status === 'unavailable'
                  ? 'Dictation needs a voice to speak — see below'
                  : 'Making sure your device can speak'}
            </p>
          </div>
        </div>

        {readiness.status === 'unavailable' ? (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft p-3.5 text-sm leading-relaxed">
            <span className="font-semibold text-warning">Dictation cannot run without audio.</span>{' '}
            <span className="text-muted-foreground">
              Your browser reported no English speech voice. Try Firefox, install a system voice, or pick one
              in Progress → Settings → Voice. Your words and progress are untouched.
            </span>
          </div>
        ) : null}
      </motion.div>

      <motion.div variants={v(listItem)} transition={t()} className="surface p-5 sm:p-6 space-y-5">
        <div>
          <div className="label text-muted-foreground">Playback speed</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Playback speed">
            {(['normal', 'slow'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={preset === option}
                onClick={() => {
                  onPreset(option)
                  playSound('tap')
                }}
                className={cn(
                  'flex min-h-12 items-center justify-center gap-2.5 rounded-xl border px-3 text-sm font-semibold transition-all duration-150 cursor-pointer active:scale-[.98]',
                  preset === option
                    ? 'border-primary-line bg-primary-soft text-primary shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:border-primary-line/50 hover:text-foreground'
                )}
              >
                {option === 'slow' ? <Snail className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                {option === 'slow' ? `Slow (${PRESET_RATES.slow.toFixed(1)}×)` : 'Normal (1.0×)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label text-muted-foreground">Target training rung</div>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Starting difficulty">
            {(['auto', 0, 1, 2] as const).map((option) => {
              const isAuto = option === 'auto'
              const value = isAuto ? null : (option as Rung)
              const selected = rungOverride === value
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    onRungOverride(value)
                    playSound('tap')
                  }}
                  className={cn(
                    'min-h-18 rounded-xl border p-3 text-center transition-all duration-150 cursor-pointer active:scale-[.98] flex flex-col justify-center items-center',
                    selected
                      ? 'border-primary-line bg-primary-soft shadow-xs text-primary'
                      : 'border-border bg-card hover:border-primary-line/50'
                  )}
                >
                  <span className={cn('block text-sm font-bold', selected ? 'text-primary' : 'text-foreground')}>
                    {isAuto ? 'Adaptive' : RUNG_LABELS[option as Rung]}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground font-medium">
                    {isAuto ? `Starts at ${RUNG_LABELS[rung]}` : ['Words first', 'Phrases', 'Full sentences'][option as Rung]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {available ? (
          <Button size="lg" onClick={onStart} data-testid="dictation-start" className="mt-2 w-full shadow-sm cursor-pointer active:scale-[.98] font-medium">
            <Ear className="h-4 w-4 mr-1" />
            Start dictation
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <>
            {/* No voice: say so plainly and offer the one action that fixes it */}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row" data-testid="dictation-unavailable">
              <Button size="lg" disabled className="flex-1">
                <AlertTriangle className="h-4 w-4" />
                Dictation needs a voice
              </Button>
              <Button size="lg" variant="outline" onClick={onOpenVoiceSettings} className="sm:w-auto cursor-pointer">
                <Settings2 className="h-4 w-4" />
                Open voice settings
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Everything else keeps working — your words, streak and progress are untouched.
            </p>
          </>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          8 items · words, then phrases, then sentences · grades your review queue
        </p>
      </motion.div>

      <motion.div variants={v(listItem)} transition={t()}>
        <EmptyState
          icon={Keyboard}
          title="How a round works"
          hint="Listen as often as you like, type what you hear, then see exactly which words you nailed and which you missed."
          actionLabel="Browse the library first"
          onAction={onBrowse}
        />
      </motion.div>
    </motion.div>
  )
}

function DictationSession({
  items,
  rungUsed,
  player,
  preset,
  onPreset,
  audioReady,
  onFinish,
  onExit,
}: {
  items: DictationItem[]
  rungUsed: Rung
  player: DictationPlayer
  preset: DictationPreset
  onPreset: (p: DictationPreset) => void
  audioReady: boolean
  onFinish: (result: { accuracy: number; xp: number; correct: number; total: number; levelUp: boolean; streak: number }) => void
  onExit: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [replays, setReplays] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [accSum, setAccSum] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [result, setResult] = useState<{
    tokens: ReturnType<typeof diffWords>
    accuracy: number
    grade: DictationGrade
    xp: number
  } | null>(null)
  const finishingRef = useRef(false)
  const { pops } = useXpPops()
  const { v, t } = useMotionSafe()

  const item = items[idx]
  const targetWords = tokenize(item.text).length

  const speakNow = useCallback(
    async (text: string, forceSlow = false) => {
      setPlaying(true)
      try {
        await player.play(text, { preset: forceSlow ? 'slow' : preset })
      } catch {
        toast.error('Audio failed to play. Check your voice in Settings.')
      } finally {
        setPlaying(false)
      }
    },
    [player, preset]
  )

  // Fresh item: only side effects (audio + focus) run here. The per-item
  // answer state (typed/attempts/hint/result) resets via the keyed child
  // <AnimatePresence>/<motion.div key=...> below, which remounts on each item —
  // syncing derived state with setState inside an effect causes cascading
  // renders.
  useEffect(() => {
    let playId = 0
    if (audioReady) {
      playId = window.setTimeout(() => {
        void speakNow(items[idx].text)
      }, 400)
    }
    const focusId = window.setTimeout(
      () => document.getElementById('dictation-input')?.focus({ preventScroll: true } as FocusOptions),
      500
    )
    return () => {
      window.clearTimeout(playId)
      window.clearTimeout(focusId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const replay = useCallback(() => {
    if (!audioReady || playing) return
    setReplays((r) => r + 1)
    void speakNow(item.text)
  }, [audioReady, item.text, playing, speakNow])

  const recordPerfect = useCallback(
    (r: { tokens: ReturnType<typeof diffWords>; accuracy: number; grade: DictationGrade; xp: number }) => {
      setResult(r)
      setAccSum((s) => s + r.accuracy)
      setAnswered((a) => a + 1)
      setXpEarned((x) => x + r.xp)
    },
    []
  )


  const next = useCallback(async () => {
    if (finishingRef.current || !result) return
    if (idx + 1 >= items.length) {
      finishingRef.current = true
      const avg = Math.round(accSum / Math.max(1, answered))
      const correct = Math.round((accSum / 100) * Math.max(1, answered))
      try {
        const stats = await api.getDashboardStats()
        onFinish({ accuracy: avg, xp: xpEarned, correct, total: items.length, levelUp: false, streak: stats.streak })
      } catch {
        onFinish({ accuracy: avg, xp: xpEarned, correct, total: items.length, levelUp: false, streak: 0 })
      }
      return
    }
    setIdx((i) => i + 1)
  }, [accSum, answered, idx, items.length, onFinish, result, xpEarned])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if (e.key === ' ' && !result) {
        e.preventDefault()
        replay()
      }
      if (e.key === 'Enter' && result) {
        e.preventDefault()
        void next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, replay, result])

  const progressPct = ((idx + (result ? 1 : 0)) / items.length) * 100
  const segments: DiffSegment[] = result ? groupDiff(result.tokens) : []
  const perfect = !!result && result.accuracy === 100
  const verdict = !result
    ? null
    : perfect
      ? `Perfect — +${result.xp} XP`
      : result.accuracy >= 85
        ? `Nearly — +${result.xp} XP`
        : result.accuracy >= 60
          ? `Getting there — +${result.xp} XP`
          : `Logged for review — +${result.xp} XP`

  return (
    <div>
      <XpPopLayer pops={pops} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="label text-primary">Dictation · {KIND_TITLES[item.kind]}</h1>
          <div className="mt-1 text-sm text-muted-foreground num">
            {idx + 1} / {items.length} · {RUNG_LABELS[rungUsed]}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">
          <X className="h-4 w-4" />
          End session
        </Button>
      </div>

      <DictationProgressBar value={progressPct} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`dictation-item-${idx}-${item.wordId}-${item.kind}`}
          initial={gradeEnter(4).initial}
          animate={gradeEnter(4).animate}
          exit={gradeExit(4).exit}
          transition={t()}
          className="space-y-4"
        >
          <div className="surface p-5 text-center sm:p-6">
            <div className="label text-muted-foreground">
              {item.kind === 'word' ? 'One word' : item.kind === 'phrase' ? 'A short phrase' : 'A full sentence'} · {targetWords} word{targetWords === 1 ? '' : 's'}
            </div>
            <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center">
              <Button
                size="icon-lg"
                onClick={replay}
                disabled={playing || !audioReady}
                aria-label={playing ? 'Playing audio' : 'Play the audio again'}
                className={cn('h-20 w-20 rounded-full shadow-md', playing && 'animate-pulse')}
              >
                {playing ? <Volume2 className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8" />}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground num">
              Played {replays} time{replays === 1 ? '' : 's'} · replays are free
            </p>
            <div className="mt-4 flex justify-center gap-2" role="radiogroup" aria-label="Playback speed">
              {(['normal', 'slow'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={preset === option}
                  onClick={() => onPreset(option)}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors duration-150',
                    preset === option ? 'border-primary-line bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option === 'slow' ? <Snail className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  {option === 'slow' ? 'Slow' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          {!result ? (
            <DictationItemAnswer
              key={`answer-${idx}-${item.wordId}-${item.kind}`}
              item={item}
              shakeKey={shakeKey}
              speakNow={speakNow}
              onPerfect={recordPerfect}
              onWrongAttempt={() => setShakeKey((k) => k + 1)}
            />
          ) : (
            <motion.div variants={v(stagger(0.04))} initial="hidden" animate="show" className="surface p-5 sm:p-6">
              <motion.div variants={v(listItem)} transition={t()} className="flex flex-col items-center text-center">
                <Checkmark size={44} tone={perfect ? 'success' : 'error'} />
                <div className="mt-3 text-base font-semibold">{verdict}</div>
                <p className="mt-1 text-sm text-muted-foreground num">{result.accuracy}% of the words right</p>
              </motion.div>
              <motion.div variants={v(listItem)} transition={t()} className="mt-4 rounded-md border border-border bg-muted/30 p-4" aria-live="polite">
                <div className="label text-muted-foreground">Your version</div>
                <p className="mt-2 text-[15px] leading-loose">
                  {segments.map((seg, i) =>
                    seg.kind === 'ok' ? (
                      <span key={i} className="text-foreground">{seg.expected} </span>
                    ) : seg.kind === 'skip' ? (
                      <span key={i} className="rounded bg-warning/20 px-1 font-medium text-warning" title="Missed">{seg.expected} </span>
                    ) : (
                      <span key={i}>
                        {seg.typed ? <span className="rounded bg-destructive/15 px-1 font-medium text-destructive line-through" title="What you typed">{seg.typed}</span> : null}{' '}
                        {seg.expected ? <span className="rounded bg-success/15 px-1 font-medium text-success" title="What it was">{seg.expected}</span> : null}{' '}
                      </span>
                    )
                  )}
                </p>
              </motion.div>
              <motion.div variants={v(listItem)} transition={t()} className="mt-3 rounded-md bg-muted/40 p-4">
                <div className="label text-muted-foreground">What it was</div>
                <p className="mt-1.5 text-[15px] leading-relaxed">“{item.text}”</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {item.word}{item.ipa ? <span className="font-mono"> {item.ipa}</span> : null} — {item.meaning}
                </p>
              </motion.div>
              <motion.div variants={v(listItem)} transition={t()}>
                <Button onClick={() => void next()} data-testid="dictation-next" className="mt-4 w-full">
                  {idx + 1 >= items.length ? 'Finish session' : 'Next one'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">Enter for the next one</p>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * Session progress bar — kept outside DictationSession so the session body can
 * focus on per-item state without extra motion glue.
 */
function DictationProgressBar({ value }: { value: number }) {
  const { t } = useMotionSafe()
  return (
    <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Dictation progress" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full bg-primary"
        animate={{ width: `${value}%` }}
        transition={t({ duration: 0.3, ease: [0.16, 1, 0.3, 1] })}
      />
    </div>
  )
}

function DictationItemAnswer({
  item,
  shakeKey,
  speakNow,
  onPerfect,
  onWrongAttempt,
}: {
  item: DictationItem
  shakeKey: number
  speakNow: (text: string, forceSlow?: boolean) => void
  onPerfect: (r: { tokens: ReturnType<typeof diffWords>; accuracy: number; grade: DictationGrade; xp: number }) => void
  onWrongAttempt: () => void
}) {
  const [typed, setTyped] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [hintStage, setHintStage] = useState(0)
  const targetWords = tokenize(item.text).length
  const { pop } = useXpPops()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Autofocus the fresh card (the parent also focuses by id; this covers
  // remount races where the element is not in the DOM yet).
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    return () => window.clearTimeout(id)
  }, [])

  const handleCheck = useCallback(() => {
    if (!typed.trim()) return
    const tokens = diffWords(item.text, typed)
    const accuracy = accuracyOf(tokens, targetWords)
    if (accuracy === 100) {
      const grade = gradeFor(100, attempts, false)
      const xp = DICTATION_XP[grade]
      onPerfect({ tokens, accuracy, grade, xp })
      playSound('correct')
      buzz('success')
      popXpFromElement(xp, primaryRef.current, pop)
      void api.submitReview(item.wordId, grade, 'dictation').catch(() => {})
      return
    }
    setAttempts((a) => a + 1)
    onWrongAttempt()
    playSound('wrong')
    buzz('error')
    void speakNow(item.text, true)
  }, [attempts, item, onPerfect, onWrongAttempt, pop, speakNow, targetWords, typed])

  const handleHint = useCallback(() => {
    if (hintStage >= 2) {
      const tokens = diffWords(item.text, typed)
      const accuracy = accuracyOf(tokens, targetWords)
      onPerfect({ tokens, accuracy, grade: 0, xp: DICTATION_XP[0] })
      playSound('wrong')
      buzz('error')
      void api.submitReview(item.wordId, 0, 'dictation').catch(() => {})
      return
    }
    setHintStage((s) => s + 1)
    playSound('tap')
  }, [hintStage, item, onPerfect, targetWords, typed])

  return (
    <div className="surface p-5 sm:p-6">
      <label htmlFor="dictation-input" className="label text-muted-foreground">
        Type exactly what you hear
      </label>
      <div key={shakeKey} className={cn(attempts > 0 && 'shake')}>
        <textarea
          ref={inputRef}
          id="dictation-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={item.kind === 'word' ? 'Type the word…' : 'Type it word for word…'}
          rows={item.kind === 'sentence' ? 3 : 2}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby="dictation-hint"
          className="mt-2 min-h-20 w-full rounded-md border border-input bg-card p-4 text-base leading-relaxed outline-none transition-colors focus-visible:border-primary-line md:text-[15px]"
          onKeyDown={(e) => {
            typeFeelFromKey(e)
            if (e.key === 'Enter' && !e.shiftKey && typed.trim()) {
              e.preventDefault()
              handleCheck()
            }
          }}
        />
      </div>
      {attempts > 0 ? (
        <p role="status" aria-live="polite" className="mt-3 rounded-md border border-warning/30 bg-warning-soft p-3 text-center text-sm font-medium text-warning">
          Not quite — listen once more and compare. Replays are always free.
        </p>
      ) : null}
      {hintStage > 0 ? (
        <p id="dictation-hint" className="mt-3 rounded-md bg-muted/50 p-3 font-mono text-sm leading-relaxed text-muted-foreground">
          {hintPreview(item.text, hintStage)}{' '}
          <span className="font-sans">— hints are free, grades stay fair</span>
        </p>
      ) : (
        <p id="dictation-hint" className="mt-2 text-xs text-muted-foreground">
          Capital letters and punctuation don&apos;t count — only the words do.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button ref={primaryRef} onClick={handleCheck} disabled={!typed.trim()} data-testid="dictation-check" className="flex-1">
          <Check className="h-4 w-4" />
          Check it
        </Button>
        <Button variant="outline" onClick={handleHint} className="sm:w-auto">
          <Lightbulb className="h-4 w-4" />
          {hintStage === 0 ? 'Need a hint?' : hintStage === 1 ? 'One more hint?' : 'Show me the answer'}
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Enter to check · Space replays the audio</p>
    </div>
  )
}

function hintPreview(text: string, stage: number): string {
  const words = tokenize(text)
  if (words.length === 0 || stage <= 0) return ''
  if (stage === 1) return words.map((w) => `${w[0] ?? ''}···`).join(' ')
  return words.map((w) => `${w.slice(0, 2)}···`).join(' ')
}

function DictationComplete({
  session,
  summary,
  onAgain,
  onDone,
}: {
  session: DictationSessionData
  summary: DictationSummary
  onAgain: () => void
  onDone: () => void
}) {
  const navigate = useAppStore((s) => s.navigate)
  const [dueAfter, setDueAfter] = useState(0)
  useEffect(() => {
    let live = true
    void api
      .getDashboardStats()
      .then((stats) => {
        if (live) setDueAfter(stats.dueCount)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const rungMessage =
    summary.rungTo > summary.rungFrom
      ? `${RUNG_LABELS[summary.rungTo]} unlocked — your next session starts harder.`
      : summary.rungTo < summary.rungFrom
        ? `Back to ${RUNG_LABELS[summary.rungTo]} — shorter, easier, and that is exactly right for now.`
        : `Holding at ${RUNG_LABELS[summary.rungTo]}.`

  return (
    <div className="space-y-4">
      <SessionCompleteV2
        title="Dictation complete"
        subtitle={rungMessage}
        correct={summary.correct}
        total={summary.total}
        xp={summary.xp}
        streak={summary.streak}
        levelUp={summary.levelUp}
        onAgain={() => {
          playSound('tap')
          onAgain()
        }}
        onDone={onDone}
      />
      <div className="surface flex items-center justify-between gap-3 p-4">
        <div>
          <div className="label text-muted-foreground">Average accuracy</div>
          <div className="mt-1 text-2xl font-semibold num">{summary.accuracy}%</div>
        </div>
        <div className="text-right">
          <Badge variant="soft" className="capitalize">{RUNG_LABELS[summary.rungTo]}</Badge>
          <p className="mt-1 text-xs text-muted-foreground">next session starts here</p>
        </div>
      </div>
      {dueAfter > 0 ? (
        <NextStep
          title="Keep the momentum"
          hint={`${dueAfter} review${dueAfter === 1 ? '' : 's'} are due — the words you just heard are freshest right now.`}
          actionLabel={`Review ${dueAfter}`}
          onAction={() => navigate('review')}
        />
      ) : (
        <NextStep
          title="All caught up"
          hint="Nothing is due. A fresh dictation round tomorrow will climb the ladder further."
          actionLabel="Back to today"
          onAction={() => navigate('today')}
        />
      )}
      <details className="surface group p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            What you transcribed ({session.items.length})
          </span>
          <span className="text-xs text-muted-foreground">tap to expand</span>
        </summary>
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {session.items.map((item) => (
            <li key={item.wordId + item.kind} className="text-sm leading-relaxed">
              <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs capitalize text-muted-foreground">
                {item.kind}
              </span>
              {item.text} <span className="text-muted-foreground">— {item.word}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

const KIND_TITLES: Record<DictationItem['kind'], string> = {
  word: 'Word',
  phrase: 'Phrase',
  sentence: 'Sentence',
}
