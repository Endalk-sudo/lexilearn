'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, type CardWithWord } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { WordCard } from '@/components/word/word-card'
import { SpellingInput } from '@/components/word/spelling-input'
import { Volume2, Check, X, ArrowRight, Sparkles, ArrowLeft, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { speak } from '@/lib/tts'
import { SessionComplete, XpBurst } from '@/components/reward-celebration'

export function LearnView() {
  const [cards, setCards] = useState<CardWithWord[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [stage, setStage] = useState<'recall' | 'spelling' | 'graded'>('recall')
  const [spelling, setSpelling] = useState('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsRate, setTtsRate] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpEarned, setXpEarned] = useState(0)
  const [showXp, setShowXp] = useState(false)
  const [levelBefore, setLevelBefore] = useState('')
  const [levelAfter, setLevelAfter] = useState('')
  const [streakAfter, setStreakAfter] = useState(0)
  const navigate = useAppStore((s) => s.navigate)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const [list, settings, stats] = await Promise.all([api.getNewCards(null, 10), api.getSettings(), api.getDashboardStats()])
      setCards(list); setTtsVoice(settings.ttsVoice); setTtsRate(settings.ttsRate); setLevelBefore(stats.level.name)
      setIdx(0); setStage('recall'); setSpelling(''); setIsCorrect(false); setCompleted(false); setCorrectCount(0); setXpEarned(0)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])
  useEffect(() => { loadCards() }, [loadCards])

  const current = cards[idx]

  const handleReveal = useCallback(() => {
    setStage('spelling'); setSpelling('')
    if (current && !speak(current.word.word, { voice: ttsVoice, rate: ttsRate })) toast.error('TTS not available in this browser.')
  }, [current, ttsVoice, ttsRate])

  const handleSpellingSubmit = useCallback(async () => {
    if (!current || !spelling.trim() || stage !== 'spelling') return
    const correct = spelling.trim().toLowerCase() === current.word.word.toLowerCase()
    setIsCorrect(correct); setStage('graded'); setCorrectCount((x) => x + (correct ? 1 : 0)); setXpEarned((x) => x + (correct ? 5 : 1)); setShowXp(true)
    window.setTimeout(() => setShowXp(false), 1000)
    try { await api.submitReview(current.word.id, correct ? 4 : 0, 'learn') } catch (e) { console.error(e) }
  }, [current, spelling, stage])

  const finish = useCallback(async () => {
    const stats = await api.getDashboardStats().catch(() => null)
    setLevelAfter(stats?.level.name ?? levelBefore)
    setStreakAfter(stats?.streak ?? 0)
    setCompleted(true)
  }, [levelBefore])

  const next = useCallback(() => {
    if (idx + 1 >= cards.length) { finish(); return }
    setIdx((x) => x + 1); setStage('recall'); setSpelling(''); setIsCorrect(false)
  }, [idx, cards.length, finish])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if ((e.key === ' ' || e.key === 'Enter') && stage === 'recall') { e.preventDefault(); handleReveal() }
      if (e.key === 'Enter' && stage === 'graded') { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [stage, handleReveal, next])

  if (loading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-80 w-full" /><Skeleton className="h-28 w-full" /></div>
  if (!cards.length) return <Card className="game-panel rounded-3xl"><CardContent className="p-10 text-center"><Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" /><h3 className="text-lg font-bold">You&apos;ve learned every available new word.</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">That&apos;s a good place to be. Switch to review to strengthen your memory, or build a bigger deck.</p><div className="mt-5 flex justify-center gap-2"><Button variant="outline" className="rounded-xl" onClick={() => navigate('decks')}>Browse decks</Button><Button className="rounded-xl" onClick={() => navigate('review')}>Review</Button></div></CardContent></Card>
  if (completed) return <SessionComplete correct={correctCount} total={cards.length} xp={xpEarned} streak={streakAfter} title="New words unlocked" subtitle={levelAfter !== levelBefore ? `Level up: ${levelBefore} → ${levelAfter}` : 'You added fresh words to your long-term memory.'} levelUp={levelAfter !== levelBefore} onAgain={loadCards} onDone={() => navigate('dashboard')} />

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <XpBurst amount={showXp ? (isCorrect ? 5 : 1) : 0} />
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => navigate('dashboard')} className="-ml-2 rounded-xl"><ArrowLeft className="h-4 w-4" /></Button><div><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">New word quest</div><h1 className="text-2xl font-black tracking-tight">Learn & lock it in</h1></div></div><Badge variant="secondary" className="font-mono">{idx + 1}/{cards.length}</Badge></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((idx + (stage === 'graded' ? 1 : 0)) / cards.length) * 100}%` }} /></div>
      <div className="grid grid-cols-3 gap-2">{['Recall', 'Listen', 'Spell'].map((label, i) => <div key={label} className={`rounded-xl border px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider ${((stage === 'recall' && i === 0) || (stage === 'spelling' && i > 0) || (stage === 'graded' && i === 2)) ? 'border-primary/30 bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground'}`}>{i + 1}. {label}</div>)}</div>

      <AnimatePresence mode="wait"><motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: .22 }}><WordCard word={current.word} ttsVoice={ttsVoice} ttsRate={ttsRate} showDefinition={stage !== 'recall'} hideWord={stage === 'spelling'} /></motion.div></AnimatePresence>

      {stage === 'recall' && <Card className="game-panel rounded-3xl"><CardContent className="p-6 text-center sm:p-8"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Keyboard className="h-5 w-5" /></div><h2 className="font-bold">Can you remember it?</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Pause for a second and recall the meaning before you reveal the answer.</p><Button onClick={handleReveal} size="lg" className="mt-5 w-full rounded-xl sm:w-auto">Reveal & listen <ArrowRight className="ml-2 h-4 w-4" /></Button><p className="mt-3 text-[10px] text-muted-foreground">SPACE / ENTER</p></CardContent></Card>}

      {stage === 'spelling' && <Card className="game-panel rounded-3xl"><CardHeader><CardTitle className="flex items-center justify-between text-base">Listen & spell <Button size="sm" variant="outline" className="rounded-xl" onClick={() => speak(current.word.word, { voice: ttsVoice, rate: ttsRate })}><Volume2 className="mr-1.5 h-4 w-4" /> Play</Button></CardTitle></CardHeader><CardContent className="space-y-4"><SpellingInput value={spelling} onChange={setSpelling} target={current.word.word} autoFocus onSubmit={handleSpellingSubmit} placeholder="Type the word you hear…" /><Button onClick={handleSpellingSubmit} disabled={!spelling.trim()} className="w-full rounded-xl">Check answer <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>}

      {stage === 'graded' && <Card className="game-panel rounded-3xl"><CardContent className="p-6 sm:p-8"><div className="flex items-start gap-3"><div className={`rounded-2xl p-3 ${isCorrect ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-600'}`}>{isCorrect ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}</div><div><div className="text-lg font-black">{isCorrect ? 'Perfect. +5 XP' : 'Keep it in the rotation. +1 XP'}</div><p className="mt-1 text-sm text-muted-foreground">{isCorrect ? `You spelled “${current.word.word}” correctly.` : `The correct spelling is “${current.word.word}”.`}</p></div></div><Button onClick={next} className="mt-6 w-full rounded-xl">{idx + 1 >= cards.length ? 'Finish quest' : 'Next word'} <ArrowRight className="ml-2 h-4 w-4" /></Button><p className="mt-3 text-center text-[10px] text-muted-foreground">ENTER to continue</p></CardContent></Card>}
    </div>
  )
}

