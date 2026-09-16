'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type QuizQuestion, type QuizMode } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ListChecks, Volume2, Check, X, Clock, FileText, ToggleLeft, Keyboard, Ear, Zap, Flame, ArrowLeft, Trophy, Target } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { cn } from '@/lib/utils'
import { SessionComplete, XpBurst } from '@/components/reward-celebration'

const MODES: { mode: QuizMode; title: string; description: string; icon: React.ElementType; tag: string }[] = [
  { mode: 'mc', title: 'Multiple Choice', description: 'See a word, pick its meaning.', icon: FileText, tag: 'Warm-up' },
  { mode: 'reverse_mc', title: 'Reverse Recall', description: 'See a meaning, retrieve the word.', icon: ToggleLeft, tag: 'Recall' },
  { mode: 'typing', title: 'Typing Test', description: 'Retrieve the word from its definition.', icon: Keyboard, tag: 'Active recall' },
  { mode: 'spelling_bee', title: 'Spelling Bee', description: 'Listen carefully and type what you hear.', icon: Ear, tag: 'Listening' },
  { mode: 'speed_round', title: 'Speed Round', description: '60 seconds. Build a combo and answer fast.', icon: Zap, tag: 'Arcade' },
]

export function QuizView() {
  const [mode, setMode] = useState<QuizMode | null>(null)
  return <div className="mx-auto max-w-4xl space-y-5"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-primary"><ListChecks className="h-3.5 w-3.5" /> Choose your challenge</div><h1 className="mt-2 text-3xl font-black tracking-tight">Quiz Arena</h1><p className="mt-2 text-sm text-muted-foreground">Pick a mode that matches how you want to train your English today.</p></div>{!mode ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{MODES.map((m) => <ModeCard key={m.mode} {...m} onClick={() => setMode(m.mode)} />)}</div> : <QuizRunner mode={mode} onExit={() => setMode(null)} />}</div>
}

function ModeCard({ mode, title, description, icon: Icon, tag, onClick }: { mode: QuizMode; title: string; description: string; icon: React.ElementType; tag: string; onClick: () => void }) {
  return <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .98 }} onClick={onClick} className="game-panel game-hover rounded-3xl p-5 text-left"><div className="flex items-start justify-between gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div><Badge variant="secondary" className="rounded-lg text-[9px] uppercase tracking-wider">{tag}</Badge></div><h2 className="mt-5 text-base font-black">{title}</h2><p className="mt-1 min-h-10 text-sm leading-relaxed text-muted-foreground">{description}</p><div className="mt-5 text-xs font-bold uppercase tracking-wider text-primary">Play now →</div></motion.button>
}

function QuizRunner({ mode, onExit }: { mode: QuizMode; onExit: () => void }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [graded, setGraded] = useState<boolean | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [showXp, setShowXp] = useState(false)
  const [lastXp, setLastXp] = useState(0)
  const [streak, setStreak] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [qs, settings] = await Promise.all([api.generateQuiz(null, mode, mode === 'speed_round' ? 40 : 10), api.getSettings()])
      setQuestions(qs); setTtsVoice(settings.ttsVoice); setTtsRate(settings.ttsRate); setIdx(0); setAnswer(''); setSelected(null); setGraded(null); setCorrectCount(0); setXpEarned(0); setCompleted(false); setTimeLeft(60); setCombo(0); setBestCombo(0); setStreak(0)
    } catch (e) { console.error(e); toast.error('Not enough words to generate this quiz.') } finally { setLoading(false) }
  }, [mode])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (mode === 'spelling_bee' && questions[idx] && graded === null) speak(questions[idx].audioWord!, { voice: ttsVoice, rate: ttsRate })
  }, [idx, mode, questions, graded, ttsVoice, ttsRate])

  const finish = useCallback(async (finalCorrect = correctCount, finalXp = xpEarned, total = questions.length) => {
    if (timerRef.current) clearInterval(timerRef.current)
    await api.submitQuizSession(mode, total, finalCorrect, finalXp).catch(console.error)
    const stats = await api.getDashboardStats().catch(() => null)
    setStreak(stats?.streak ?? 0)
    setCompleted(true)
  }, [mode, correctCount, xpEarned, questions.length])

  useEffect(() => {
    if (mode !== 'speed_round' || completed || loading || graded !== null) return
    timerRef.current = setInterval(() => setTimeLeft((t) => {
      if (t <= 1) {
        if (timerRef.current) clearInterval(timerRef.current)
        finish(correctCount, xpEarned, Math.min(idx + 1, questions.length))
        return 0
      }
      return t - 1
    }), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [mode, completed, loading, graded, idx, finish, correctCount, xpEarned, questions.length])

  const gradeAnswer = useCallback((ok: boolean) => {
    if (graded !== null) return
    const comboNext = ok ? combo + 1 : 0
    const xp = mode === 'speed_round' && ok ? 5 + Math.min(5, Math.max(0, combo)) : ok ? 5 : 0
    setGraded(ok); setSelected(ok ? selected : selected); setCorrectCount((x) => x + (ok ? 1 : 0)); setXpEarned((x) => x + xp); setLastXp(xp); setShowXp(true); setCombo(comboNext); setBestCombo((x) => Math.max(x, comboNext)); window.setTimeout(() => setShowXp(false), 850)
    if (ok) toast.success(mode === 'speed_round' && comboNext > 1 ? `${comboNext}× combo! +${xp} XP` : `Correct! +${xp} XP`)
    else toast.error('Not quite — keep going.')
    if (mode === 'speed_round') window.setTimeout(() => { if (idx + 1 >= questions.length) finish(correctCount + (ok ? 1 : 0), xpEarned + xp, questions.length); else { setIdx((x) => x + 1); setAnswer(''); setSelected(null); setGraded(null) } }, 480)
  }, [graded, combo, mode, selected, idx, questions.length, correctCount, xpEarned, finish])

  const next = useCallback(() => { if (idx + 1 >= questions.length) finish(); else { setIdx((x) => x + 1); setAnswer(''); setSelected(null); setGraded(null) } }, [idx, questions.length, finish])

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>
  if (!questions.length) return <Card className="game-panel rounded-3xl"><CardContent className="p-10 text-center"><p className="text-sm text-muted-foreground">Need at least 4 words to run a quiz.</p><Button variant="outline" className="mt-4 rounded-xl" onClick={onExit}>Back to modes</Button></CardContent></Card>
  if (completed) return <SessionComplete correct={correctCount} total={mode === 'speed_round' ? Math.min(idx + 1, questions.length) : questions.length} xp={xpEarned} streak={streak} title={mode === 'speed_round' ? 'Time! Round complete.' : 'Quiz complete!'} subtitle={bestCombo > 1 ? `Best combo: ${bestCombo}×. You were in the zone.` : 'You tested retrieval instead of just recognizing the answer.'} onAgain={load} onDone={onExit} />

  const current = questions[idx]
  const modeMeta = MODES.find((m) => m.mode === mode)!
  return <div className="space-y-4">
    <XpBurst amount={showXp ? lastXp : 0} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="ghost" size="sm" onClick={onExit} className="w-fit rounded-xl"><ArrowLeft className="mr-1 h-4 w-4" /> Exit</Button><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="rounded-lg">{modeMeta.title}</Badge>{mode === 'speed_round' && <Badge variant={timeLeft <= 10 ? 'destructive' : 'secondary'} className="rounded-lg font-mono"><Clock className="mr-1 h-3 w-3" />{timeLeft}s</Badge>}<Badge variant="outline" className="rounded-lg font-mono">{idx + 1}/{questions.length}</Badge>{mode === 'speed_round' && <Badge variant="outline" className="rounded-lg"><Flame className="mr-1 h-3 w-3 text-orange-500" />{combo}×</Badge>}</div></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div animate={{ width: `${((idx + 1) / questions.length) * 100}%` }} className="h-full rounded-full bg-primary" /></div>

    <AnimatePresence mode="wait"><motion.div key={idx} initial={{ opacity: 0, y: 12, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: .99 }}>
      <Card className={cn('game-panel rounded-[2rem]', mode === 'speed_round' && 'border-primary/25')}>
        <CardHeader className="p-6 pb-3 sm:p-8 sm:pb-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">{mode === 'speed_round' ? <><Zap className="h-3.5 w-3.5" /> Arcade mode</> : modeMeta.tag}</div><CardTitle className="mt-2 text-xl leading-snug sm:text-2xl">{current.prompt}</CardTitle>{current.promptWord && mode !== 'spelling_bee' && <div className="mt-4 flex items-center gap-3"><div className="text-4xl font-black tracking-tight sm:text-5xl">{current.promptWord.word}</div><Button size="icon" variant="outline" className="rounded-xl" onClick={() => speak(current.promptWord!.word, { voice: ttsVoice, rate: ttsRate })}><Volume2 className="h-4 w-4" /></Button></div>}</CardHeader>
        <CardContent className="space-y-4 p-6 pt-4 sm:p-8 sm:pt-5">
          {(mode === 'mc' || mode === 'reverse_mc' || mode === 'speed_round') && current.options && <div className="grid gap-2.5">{current.options.map((opt, i) => { const isCorrect = opt === current.correctAnswer; const isSelected = opt === selected; return <motion.div key={i} whileHover={graded === null ? { x: 2 } : undefined}><Button disabled={graded !== null} variant="outline" className={cn('h-auto min-h-14 w-full justify-start rounded-2xl px-4 py-3 text-left whitespace-normal', graded !== null && isCorrect && 'border-emerald-500/40 bg-emerald-500/10', graded !== null && isSelected && !isCorrect && 'border-rose-500/40 bg-rose-500/10', isSelected && graded === null && 'border-primary bg-primary/5')} onClick={() => { setSelected(opt); gradeAnswer(isCorrect) }}><span className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-xs font-bold">{String.fromCharCode(65 + i)}</span><span className="font-medium">{opt}</span>{graded !== null && isCorrect && <Check className="ml-auto h-4 w-4 text-emerald-600" />}{graded !== null && isSelected && !isCorrect && <X className="ml-auto h-4 w-4 text-rose-600" />}</Button></motion.div> })}</div>}

          {(mode === 'typing' || mode === 'spelling_bee') && <div className="space-y-3">{mode === 'spelling_bee' && <div className="flex justify-center"><Button variant="outline" size="lg" className="rounded-2xl" onClick={() => speak(current.audioWord!, { voice: ttsVoice, rate: ttsRate })}><Volume2 className="mr-2 h-5 w-5" /> Hear again</Button></div>}<input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={graded !== null} autoFocus placeholder={mode === 'spelling_bee' ? 'Type what you hear…' : 'Type the word…'} className="w-full rounded-2xl border bg-background p-5 text-center font-mono text-xl outline-none focus:ring-2 focus:ring-primary" onKeyDown={(e) => { if (e.key === 'Enter' && graded === null && answer.trim()) gradeAnswer(answer.trim().toLowerCase() === current.correctAnswer.toLowerCase()) }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />{graded !== null && <div className={cn('rounded-xl p-3 text-center text-sm font-semibold', graded ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')}>{graded ? 'Correct!' : `Answer: ${current.correctAnswer}`}</div>}</div>}

          {graded !== null && mode !== 'speed_round' && <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center"><div className="text-xs text-muted-foreground">{correctCount} correct so far · +{xpEarned} XP</div><Button onClick={next} className="rounded-xl">{idx + 1 >= questions.length ? 'See results' : 'Next'} <ArrowLeft className="ml-2 h-4 w-4 rotate-180" /></Button></div>}
        </CardContent>
      </Card>
    </motion.div></AnimatePresence>

    {mode === 'speed_round' && <div className="grid grid-cols-3 gap-2"><MiniStat icon={Target} value={correctCount} label="Correct" /><MiniStat icon={Flame} value={`${combo}×`} label="Combo" /><MiniStat icon={Trophy} value={xpEarned} label="XP" /></div>}
  </div>
}

function MiniStat({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) { return <div className="rounded-2xl border bg-card/70 p-3 text-center"><Icon className="mx-auto h-4 w-4 text-primary" /><div className="mt-1 text-lg font-black tabular-nums">{value}</div><div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div></div> }
