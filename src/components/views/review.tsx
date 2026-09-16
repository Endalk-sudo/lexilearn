'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Volume2, Sparkles, ArrowLeft, Clock3 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { GRADE_LABELS, type Grade } from '@/lib/srs'
import { SessionComplete, XpBurst } from '@/components/reward-celebration'

const GRADES: { grade: Grade; key: string; label: string; hint: string; xp: number; tone: string }[] = [
  { grade: 0, key: '1', label: 'Again', hint: 'I forgot', xp: 1, tone: 'rose' },
  { grade: 3, key: '2', label: 'Hard', hint: 'It was difficult', xp: 3, tone: 'amber' },
  { grade: 4, key: '3', label: 'Good', hint: 'I knew it', xp: 5, tone: 'emerald' },
  { grade: 5, key: '4', label: 'Easy', hint: 'Instant recall', xp: 8, tone: 'sky' },
]

export function ReviewView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [showXp, setShowXp] = useState(false)
  const [lastXp, setLastXp] = useState(0)
  const [streak, setStreak] = useState(0)
  const [levelBefore, setLevelBefore] = useState('')
  const [levelAfter, setLevelAfter] = useState('')
  const gradeRef = useRef<HTMLDivElement>(null)
  const navigate = useAppStore((s) => s.navigate)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const [list, settings, stats] = await Promise.all([api.getReviewableCards(null, 30), api.getSettings(), api.getDashboardStats()])
      setCards(list); setTtsVoice(settings.ttsVoice); setTtsRate(settings.ttsRate); setLevelBefore(stats.level.name)
      setIdx(0); setRevealed(false); setCompleted(false); setCorrectCount(0); setXpEarned(0)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])
  useEffect(() => { loadCards() }, [loadCards])

  const current = cards[idx]
  const grade = useCallback(async (g: Grade) => {
    if (!current || !revealed) return
    const bonus = g === 5 ? 8 : g === 4 ? 5 : g === 3 ? 3 : 1
    setCorrectCount((x) => x + (g >= 3 ? 1 : 0)); setXpEarned((x) => x + bonus); setLastXp(bonus); setShowXp(true); window.setTimeout(() => setShowXp(false), 900)
    try { await api.submitReview(current.word.id, g, 'review') } catch (e) { console.error(e) }
    if (idx + 1 >= cards.length) {
      const stats = await api.getDashboardStats().catch(() => null)
      setStreak(stats?.streak ?? 0); setLevelAfter(stats?.level.name ?? levelBefore); setCompleted(true); return
    }
    setIdx((x) => x + 1); setRevealed(false)
    if (g >= 3) toast.success(`${GRADE_LABELS[g]} · +${bonus} XP`)
    else toast(`${GRADE_LABELS[g]} · keep this one in rotation`)
  }, [current, revealed, idx, cards.length, levelBefore])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || loading || completed) return
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) { e.preventDefault(); setRevealed(true); return }
      const found = GRADES.find((x) => x.key === e.key)
      if (revealed && found) { e.preventDefault(); grade(found.grade) }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [revealed, grade, loading, completed])

  useEffect(() => { if (revealed) gradeRef.current?.querySelector('button')?.focus() }, [revealed])

  if (loading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /><Skeleton className="h-28 w-full" /></div>
  if (!cards.length) return <Card className="game-panel rounded-3xl"><CardContent className="p-10 text-center"><Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" /><h3 className="text-lg font-bold">All caught up.</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Nothing is due right now. Keep your streak alive with a Daily Challenge or learn some new words.</p><div className="mt-5 flex justify-center gap-2"><Button variant="outline" className="rounded-xl" onClick={() => navigate('learn')}>Learn new</Button><Button className="rounded-xl" onClick={() => navigate('quiz')}>Play quiz</Button></div></CardContent></Card>
  if (completed) return <SessionComplete correct={correctCount} total={cards.length} xp={xpEarned} streak={streak} title="Review streak secured" subtitle={levelAfter !== levelBefore ? `Level up: ${levelBefore} → ${levelAfter}` : 'You just gave your memory another repetition that matters.'} levelUp={levelAfter !== levelBefore} onAgain={loadCards} onDone={() => navigate('dashboard')} />

  return <div className="mx-auto max-w-3xl space-y-5">
    <XpBurst amount={showXp ? lastXp : 0} />
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => navigate('dashboard')} className="-ml-2 rounded-xl"><ArrowLeft className="h-4 w-4" /></Button><div><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">Memory round</div><h1 className="text-2xl font-black tracking-tight">Review & remember</h1></div></div><Badge variant="secondary" className="font-mono">{idx + 1}/{cards.length}</Badge></div>
    <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div animate={{ width: `${(idx / cards.length) * 100}%` }} className="h-full rounded-full bg-primary" /></div>

    <AnimatePresence mode="wait"><motion.div key={idx} initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }} transition={{ duration: .2 }}>
      <Card className="game-panel rounded-[2rem] overflow-hidden"><CardContent className="p-6 sm:p-9">
        <div className="flex items-center justify-between"><Badge variant={current.srs?.status ? 'outline' : 'secondary'} className="capitalize">{current.srs?.status ?? 'New'}</Badge>{current.word.cefr && <Badge variant="outline" className="font-mono">{current.word.cefr}</Badge>}</div>
        <div className="py-12 text-center sm:py-16"><div className="flex items-center justify-center gap-2"><h2 className="text-5xl font-black tracking-tight sm:text-6xl">{current.word.word}</h2><Button size="icon" variant="ghost" className="rounded-xl" onClick={() => speak(current.word.word, { voice: ttsVoice, rate: ttsRate })}><Volume2 className="h-5 w-5" /></Button></div>{current.word.ipa && <p className="mt-2 font-mono text-sm text-muted-foreground">{current.word.ipa}</p>}{current.word.pos && <p className="mt-1 text-sm italic text-muted-foreground">{current.word.pos}</p>}</div>
        {!revealed ? <div className="rounded-3xl border border-dashed bg-muted/25 p-7 text-center sm:p-9"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BrainIcon /></div><h3 className="font-bold">Recall before you reveal</h3><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Say the meaning in your head, then check yourself.</p><Button size="lg" onClick={() => setRevealed(true)} className="mt-5 w-full rounded-xl sm:w-auto">Reveal answer</Button><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Space / Enter</p></div> : <motion.div ref={gradeRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 border-t pt-6">{current.word.definitions.length > 0 && <div className="rounded-2xl bg-muted/35 p-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meaning</div>{current.word.definitions.map((d, i) => <p key={i} className="text-sm leading-relaxed"><span className="mr-2 italic text-muted-foreground">{d.pos}</span>{d.text}</p>)}</div>}{current.word.amharic && <div className="rounded-2xl border p-4 text-sm"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">አማርኛ</div>{current.word.amharic}</div>}{current.word.examples[0] && <div className="rounded-2xl border-l-2 border-primary/40 bg-primary/[.04] p-4 text-sm italic">“{current.word.examples[0]}”</div>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{GRADES.map((g) => <Button key={g.grade} onClick={() => grade(g.grade)} className={`h-auto min-h-20 rounded-2xl border px-3 py-3 text-left text-foreground hover:border-primary/30 ${g.tone === 'rose' ? 'bg-rose-500/8' : g.tone === 'amber' ? 'bg-amber-500/8' : g.tone === 'emerald' ? 'bg-emerald-500/8' : 'bg-sky-500/8'}`} variant="outline"><span><span className="block text-sm font-black">{g.label}</span><span className="mt-1 block text-[10px] font-normal text-muted-foreground">{g.hint}</span></span><span className="ml-auto self-start rounded-md border bg-background/70 px-1.5 py-0.5 text-[9px] font-bold">{g.key}</span></Button>)}</div></motion.div>}
      </CardContent></Card>
    </motion.div></AnimatePresence>
  </div>
}

function BrainIcon() { return <span className="text-lg">🧠</span> }
