'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, Check, ChevronRight, GitBranch, History, Lightbulb,
  Loader2, Map, MessageCircle, RotateCcw, Send, Sparkles,
  Target, Trophy, Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { Pressable } from '@/components/feedback/pressable'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { fadeUp, revealBlock, springSoft, useMotionSafe } from '@/lib/motion'
import { buzz, playSend, playSound, typeFeelFromKey } from '@/lib/feel'
import { isMac } from '@/features/coach/lib/keys'
import { speak } from '@/lib/tts'
import { api } from '@/lib/api'
import { isTypingTarget } from '@/hooks/use-shortcuts'

type Branch = { id:string; title:string; focusTag:string; mode:string; difficultyCeiling:number; locked:boolean; createdAt:string }
type Node = { id:string; branchId:string; kind:string; prompt:string; expectedPatterns:string; hints:string; targetTags:string; difficulty:number }
type Feedback = { scores:Record<string,number>; corrections:{wrong:string;right:string;type:string}[]; diff:{text:string;status:'ok'|'error'|'fix';fix?:string}[]; explanation:string; native_version:string; follow_up:string; mastery_delta:Record<string,number> }
type Overview = { project:{id:string;name:string;goal:string|null}; branches:Branch[]; mastery:{tag:string;mastery:number;attempts:number;correct:number}[]; dueErrors:{id:string;tag:string;errorType:string;wrong:string;right:string;context:string}[] }

const MODE_OPTIONS = [
  { id:'drill', label:'Drill', description:'Fast reps on one rule', icon:Target },
  { id:'scenario', label:'Scenario', description:'Roleplay real situations', icon:MessageCircle },
  { id:'exam', label:'Exam', description:'Timed, rubric-based', icon:Trophy },
  { id:'review', label:'Review', description:'Repair recurring mistakes', icon:RotateCcw },
]

export const FOCUS_OPTIONS = [
  { id:'past_tense', label:'Past tense' },
  { id:'articles', label:'Articles' },
  { id:'prepositions', label:'Prepositions' },
  { id:'collocation', label:'Collocations' },
  { id:'word_choice', label:'Word choice' },
  { id:'naturalness', label:'Naturalness' },
  { id:'spelling', label:'Spelling' },
  { id:'pronunciation', label:'Pronunciation' },
  { id:'conditionals', label:'Conditionals' },
  { id:'modals', label:'Modals' },
]

export const CONFIDENCE_OPTIONS = [
  { level: 1, label: 'Guess', emoji: '🎲' },
  { level: 2, label: 'Shaky', emoji: '💭' },
  { level: 3, label: 'Fairly sure', emoji: '🤔' },
  { level: 4, label: 'Confident', emoji: '✨' },
  { level: 5, label: 'Certain', emoji: '🎯' },
]

const THINKING_STATUS = [
  'Reading your history…',
  'Picking the right challenge…',
  'Tuning the difficulty…',
  'Shaping the question…',
]

export const fmtTag = (t:string) => FOCUS_OPTIONS.find(x=>x.id===t)?.label ?? t.replaceAll('_',' ')

function prettyKbd() {
  return isMac() ? '⌘↵' : 'Ctrl+↵'
}

function useThinkingStatus(active:boolean) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setIndex(i => (i + 1) % THINKING_STATUS.length), 2600)
    return () => clearInterval(id)
  }, [active])
  // Derive the display: while inactive always show the first line, instead of
  // resetting state from inside the effect.
  return active ? THINKING_STATUS[index % THINKING_STATUS.length] : THINKING_STATUS[0]
}

/** Tiny conic-gradient mastery ring used in the context strip. */
function MasteryRing({ value }: { value:number }) {
  const pct = Math.round(value*100)
  return (
    <div className="h-7 w-7 rounded-full" style={{ background:`conic-gradient(var(--primary) ${pct*3.6}deg, var(--muted) 0deg)` }} role="img" aria-label={`${pct}% mastery of this branch focus`}>
      <div className="m-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-card text-[10px] font-semibold tabular-nums">{pct}</div>
    </div>
  )
}

export function MentorView() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[]; error?: string } | null>(null)
  const [branchId, setBranchId] = useState('')
  const [node, setNode] = useState<Node | null>(null)
  const [answer, setAnswer] = useState('')
  const [confidence, setConfidence] = useState(3)
  const [hintLevel, setHintLevel] = useState(0)
  const [hint, setHint] = useState('')
  const [hintsList, setHintsList] = useState<{ level: number; text: string }[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [selfCorrecting, setSelfCorrecting] = useState(false)
  const [selfCorrection, setSelfCorrection] = useState('')
  const [diagnosis, setDiagnosis] = useState<any>(null)
  const [attemptId, setAttemptId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showBranchMaker, setShowBranchMaker] = useState(false)
  const [branchTitle, setBranchTitle] = useState('')
  const [focusTag, setFocusTag] = useState('past_tense')
  const [branchMode, setBranchMode] = useState('drill')
  const [difficulty, setDifficulty] = useState('3')
  const [explainMore, setExplainMore] = useState('')
  const [explainLoading, setExplainLoading] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [followUpAnswer, setFollowUpAnswer] = useState('')
  const [followUpSent, setFollowUpSent] = useState(false)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const correctionRef = useRef<HTMLTextAreaElement>(null)
  const { v, t } = useMotionSafe()

  const branch = useMemo(() => overview?.branches.find(b=>b.id===branchId) ?? overview?.branches[0], [overview, branchId])
  const thinkingLine = useThinkingStatus(submitting && !node)

  const answerWords = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const answerChars = answer.length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/lexilearn?action=mentorOverview', { cache:'no-store' })
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to load Mentor')
      const data = await r.json() as Overview
      setOverview(data)
      setBranchId(prev => prev || data.branches[0]?.id || '')
      api.getOllamaStatus().then(setOllamaStatus).catch(() => setOllamaStatus({ available: false, models: [] }))
    } catch (e:any) { toast.error(e.message || 'Could not load Mentor') }
    finally { setLoading(false) }
  }, [])

  const nextQuestion = useCallback(async (id = branchId) => {
    if (!id) return
    setSubmitting(true); setFeedback(null); setDiagnosis(null); setHint(''); setHintLevel(0); setHintsList([]); setAnswer(''); setSelfCorrecting(false); setSelfCorrection(''); setFollowUpAnswer(''); setFollowUpSent(false)
    try {
      const r = await fetch('/api/lexilearn?action=mentorNext', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({branchId:id}) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Could not create next question')
      setNode(data); setTimeout(()=>answerRef.current?.focus(),100)
    } catch(e:any){ toast.error(e.message || 'Mentor could not create a question') }
    finally { setSubmitting(false) }
  }, [branchId])

  // Guards keep the load/fetch side effects to the first mount and the first
  // question per branch, so neither effect sets state synchronously on re-renders.
  const didInitRef = useRef(false)
  const askedBranchRef = useRef('')
  useEffect(()=>{
    if (didInitRef.current) return
    didInitRef.current = true
    load()
  }, [load])
  useEffect(()=>{
    if (!branchId || askedBranchRef.current === branchId) return
    askedBranchRef.current = branchId
    nextQuestion(branchId)
  }, [branchId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Latest render values, mirrored for the keydown listener below without
  // re-subscribing. The old effect had no dep array, so every keystroke in the
  // answer box (each re-render) paid add/removeEventListener plus closure churn.
  const keyStateRef = useRef({ node, feedback, selfCorrecting, requestHint, nextQuestion })
  useEffect(() => {
    keyStateRef.current = { node, feedback, selfCorrecting, requestHint, nextQuestion }
  })

  // 'h' for a hint and 'r' for the next challenge are deliberately ignored while
  // the user is typing in any field, and never fire with modifiers held.
  useEffect(() => {
    const onKey = (e:KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const s = keyStateRef.current
      if (e.key.toLowerCase()==='h' && s.node && !s.feedback && !s.selfCorrecting) { e.preventDefault(); s.requestHint() }
      if (e.key.toLowerCase()==='r' && s.feedback) { e.preventDefault(); s.nextQuestion() }
    }
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (selfCorrecting) setTimeout(()=>correctionRef.current?.focus(), 60)
  }, [selfCorrecting])

  async function requestHint() {
    if (!node) return
    const level = hintLevel + 1
    try {
      const r = await fetch('/api/lexilearn?action=mentorHint', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nodeId:node.id, level}) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Hint failed')
      setHintLevel(d.level); setHint(d.text)
      setHintsList(prev => [...prev.filter(h => h.level !== d.level), { level: d.level, text: d.text }])
      playSound('xp')
    } catch(e:any){ toast.error(e.message || 'Hint failed') }
  }

  async function submit() {
    if (!node || !answer.trim()) return
    if (!selfCorrecting) {
      setSelfCorrection(answer.trim())
      setSelfCorrecting(true)
      buzz('light')
      return
    }
    setSubmitting(true)
    playSend()
    try {
      const r = await fetch('/api/lexilearn?action=mentorAttempt', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nodeId:node.id, answer:answer.trim(), confidence, hintLevel, selfCorrect:selfCorrection.trim() }) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Evaluation failed')
      setAttemptId(d.attemptId); setFeedback(d.feedback); setDiagnosis(d.diagnosis); setSelfCorrecting(false); await load()
      const pct = Math.round((d.score ?? 0)*100)
      if ((d.score ?? 0) >= 0.75) { playSound('correct'); buzz('success') } else { playSound('wrong'); buzz('light') }
      toast.success(`+${d.xpGain ?? 0} XP · ${pct}% learning score`)
    } catch(e:any){ toast.error(e.message || 'Mentor could not evaluate the answer') }
    finally { setSubmitting(false) }
  }

  /** Send the follow-up retrieval answer as a local exchange (no API call). */
  function sendFollowUp() {
    if (!followUpAnswer.trim()) return
    setFollowUpSent(true)
    playSound('correct')
    buzz('success')
  }

  async function createBranch() {
    if (!overview) return
    setCreating(true)
    try {
      const r = await fetch('/api/lexilearn?action=mentorBranch', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ projectId:overview.project.id, title:branchTitle.trim() || `${fmtTag(focusTag)} practice`, focusTag, mode:branchMode, difficultyCeiling:Number(difficulty), locked:true }) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Could not create branch')
      setShowBranchMaker(false); setBranchTitle(''); await load(); setBranchId(d.id)
      playSound('levelup'); toast.success('New learning branch created')
    } catch(e:any){ toast.error(e.message || 'Branch creation failed') }
    finally { setCreating(false) }
  }

  async function explain() {
    if (!explainMore.trim() || !feedback || explainLoading) return
    setExplainLoading(true)
    try {
      const r = await fetch('/api/lexilearn?action=mentorExplain', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ query:explainMore, context:feedback.explanation }) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Explain failed')
      setExplainMore(d.response || '')
    } catch {
      // The endpoint is optional; the conversation simply keeps flowing without it.
      toast.error('Deep explanation is unavailable right now')
    } finally { setExplainLoading(false) }
  }

  const dueWarmup = overview?.dueErrors[0]

  if (loading && !overview) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20"/>
          <Skeleton className="h-7 w-40"/>
          <Skeleton className="h-4 w-80 max-w-full"/>
        </div>
        <Skeleton className="surface h-10 rounded-lg"/>
        <Skeleton className="surface h-[420px] rounded-lg"/>
      </div>
    )
  }

  if (!overview) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Mentor is resting"
        hint="Your AI coach could not be reached. It runs fully on this machine, so check that Ollama is running and try again."
        actionLabel="Try again"
        onAction={() => { load() }}
      />
    )
  }

  if (!branch) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          eyebrow="AI Coach"
          icon={Sparkles}
          title="Mentor"
          description="One question. One mistake. One lesson. Your Mentor remembers what you struggle with."
        />
        <EmptyState
          icon={GitBranch}
          title="Start your first learning branch"
          hint="A branch is a focused training path, like past tense drills or interview scenarios. The Mentor generates every question from your own history."
          actionLabel="Create a branch"
          onAction={() => setShowBranchMaker(true)}
        />
        <BranchMaker
          show={showBranchMaker}
          overview={overview}
          state={{ branchTitle, focusTag, branchMode, difficulty }}
          setters={{ setBranchTitle, setFocusTag, setBranchMode, setDifficulty }}
          creating={creating}
          onCreate={createBranch}
        />
      </div>
    )
  }

  const mastery = overview.mastery.find(m=>m.tag===branch.focusTag)?.mastery ?? 0.5

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="AI Coach"
        icon={Sparkles}
        title="Mentor"
        description="One question. One mistake. One lesson."
        actions={
          <div className="flex items-center gap-2">
            {ollamaStatus ? (
              ollamaStatus.available ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Local AI ({ollamaStatus.models[0] || 'qwen3:8b'})
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground" title="Smart pedagogic heuristics (100% offline).">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Smart Heuristics (Offline)
                </span>
              )
            ) : null}
            <Popover open={memoryOpen} onOpenChange={setMemoryOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="What the Mentor remembers" className="h-8 w-8 relative cursor-pointer">
                  <History className="h-4 w-4"/>
                  {overview.dueErrors.length>0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true"/>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <MemoryPanel overview={overview}/>
              </PopoverContent>
            </Popover>
            <Popover open={mapOpen} onOpenChange={setMapOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Learning map" className="h-8 w-8 cursor-pointer">
                  <Map className="h-4 w-4"/>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <MapPanel overview={overview} activeBranchId={branch.id} onPick={(id)=>{ setBranchId(id); setMapOpen(false); playSound('tap') }} onNew={()=>{ setMapOpen(false); setShowBranchMaker(true) }}/>
              </PopoverContent>
            </Popover>
          </div>
        }
      />

      {/* Redesigned Context & Branch Hub Card */}
      <div className="surface rounded-xl border border-border/80 p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MasteryRing value={mastery}/>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">{branch.title}</span>
                <span className="inline-flex items-center rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                  {fmtTag(branch.focusTag)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="capitalize">{branch.mode} Mode</span>
                <span>•</span>
                <span className="font-mono text-amber-500">
                  {'★'.repeat(branch.difficultyCeiling)}{'☆'.repeat(Math.max(0, 5 - branch.difficultyCeiling))}
                </span>
                <span>(Lv {branch.difficultyCeiling}/5)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMapOpen(true)}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <Map className="h-3.5 w-3.5" />
              <span>Switch</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBranchMaker((v) => !v)}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>New</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Welcome-back hook: only when there is something to repair. */}
      {!feedback && !node && dueWarmup && (
        <motion.button
          onClick={() => { playSound('tap'); buzz('light'); void nextQuestion() }}
          variants={v(fadeUp)} initial="hidden" animate="show"
          className="flex w-full items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-left text-sm transition-colors hover:border-warning/50 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4 shrink-0 text-warning"/>
          <span className="min-w-0 flex-1">Last time: <span className="font-medium line-through decoration-destructive/60">{dueWarmup.wrong}</span> → <span className="font-semibold text-success">{dueWarmup.right}</span>. Warm up with that?</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
        </motion.button>
      )}

      <BranchMaker show={showBranchMaker} overview={overview} state={{ branchTitle, focusTag, branchMode, difficulty }} setters={{ setBranchTitle, setFocusTag, setBranchMode, setDifficulty }} creating={creating} onCreate={createBranch}/>

      <Card className="overflow-hidden border border-border shadow-xs rounded-xl">
        <CardContent className="p-5 sm:p-7">
          {!node ? (
            <div className="space-y-4" aria-live="polite">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary"/>
                <span>{thinkingLine}</span>
              </div>
              <div className="space-y-3 rounded-lg border bg-card p-6 shadow-sm">
                <Skeleton className="h-5 w-full max-w-md"/>
                <Skeleton className="h-5 w-2/3"/>
                <Skeleton className="mt-6 h-24 w-full"/>
                <div className="flex justify-end gap-2 pt-2"><Skeleton className="h-9 w-24"/><Skeleton className="h-9 w-32"/></div>
              </div>
            </div>
          ) : (
            <motion.div
              key={node.id}
              variants={v(fadeUp)}
              initial="hidden"
              animate="show"
              transition={t(springSoft)}
              className="space-y-5"
            >
              {/* Challenge Studio Header with Snapped Step Progress */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
                    <Target className="h-3.5 w-3.5" />
                    Challenge
                  </span>
                  <span className="text-muted-foreground tabular-nums font-medium">Difficulty {node.difficulty}/5</span>

                  {!feedback && (
                    <>
                      <span className="text-border/70 hidden sm:inline" aria-hidden="true">•</span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Progress through this challenge">
                        {['Answer','Self-correct','Diagnosis'].map((label, i) => {
                          const step = selfCorrecting ? 1 : 0
                          return (
                            <div key={label} className="flex items-center gap-1.5">
                              {i > 0 && <span className="h-px w-3 bg-border" aria-hidden="true"/>}
                              <span className={cn(
                                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                                i === step ? 'bg-primary-soft text-primary font-semibold' : i < step ? 'text-success font-semibold' : 'text-muted-foreground'
                              )}>
                                {i < step ? <Check className="h-2.5 w-2.5"/> : <span className="tabular-nums">{i+1}</span>}
                                {label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => speak(node.prompt)}
                  className="gap-1.5 h-8 text-xs font-medium cursor-pointer shrink-0 self-end sm:self-auto"
                  title="Listen to challenge"
                >
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                  <span>Listen</span>
                </Button>
              </div>

              {/* Challenge Prompt */}
              <p className="text-xl sm:text-2xl font-semibold leading-relaxed tracking-tight text-balance text-foreground">
                {node.prompt}
              </p>

              {/* Progressive hints list */}
              <AnimatePresence>
                {hintsList.length > 0 && !feedback && (
                  <motion.div
                    variants={v(revealBlock)}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="space-y-2 overflow-hidden"
                  >
                    {hintsList.map((h) => (
                      <div key={h.level} className="flex gap-3 rounded-lg border border-warning/40 bg-warning-soft/60 p-3.5 text-sm">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-warning-foreground text-xs uppercase tracking-wider">
                            {h.level === 1 ? 'Hint 1 · Direction' : h.level === 2 ? 'Hint 2 · Structure' : `Hint ${h.level} · Clue`}
                          </div>
                          <p className="mt-1 leading-relaxed text-foreground">{h.text}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {!feedback ? (
                <div className="space-y-4">
                  {/* Integrated Editorial Writing Canvas (Container Dissolution) */}
                  <div className="rounded-lg border border-border/80 bg-muted/15 p-3.5 shadow-2xs focus-within:border-primary-line focus-within:bg-card focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/40">
                      <span className="font-medium text-foreground">
                        {selfCorrecting ? 'Your first attempt (read only)' : 'Your response'}
                      </span>
                      <span className="font-mono text-[11px]">
                        {answerWords} {answerWords === 1 ? 'word' : 'words'} · {answerChars} chars
                      </span>
                    </div>

                    {selfCorrecting ? (
                      <div className="mt-2.5 text-sm leading-relaxed text-foreground/90">{answer}</div>
                    ) : (
                      <Textarea
                        ref={answerRef}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          typeFeelFromKey(e)
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault()
                            submit()
                          }
                        }}
                        placeholder="Write your sentence here…"
                        className="mt-2 min-h-[104px] border-0 bg-transparent p-0 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 resize-none"
                        aria-label="Your answer"
                      />
                    )}
                  </div>

                  {selfCorrecting && (
                    <motion.div variants={v(revealBlock)} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
                      <div className="rounded-lg border border-primary-line bg-primary-soft/90 p-3.5">
                        <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Self-Correction — Polish or confirm before evaluation
                        </div>
                        <Textarea
                          ref={correctionRef}
                          value={selfCorrection}
                          onChange={(e) => setSelfCorrection(e.target.value)}
                          onKeyDown={(e) => {
                            typeFeelFromKey(e)
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                              e.preventDefault()
                              submit()
                            }
                          }}
                          placeholder="Correct yourself before the Mentor evaluates…"
                          className="mt-2 min-h-[72px] border-0 bg-transparent p-0 text-base focus-visible:ring-0 resize-none"
                          aria-label="Your corrected answer"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Multi-Edge Anchored Confidence Selector & Action Bar */}
                  <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50">
                    <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        Confidence: <span className="font-semibold text-foreground num">{confidence}</span>
                        <span className="text-muted-foreground/70 text-[11px] hidden sm:inline"> · {CONFIDENCE_OPTIONS.find(o => o.level === confidence)?.label}</span>
                      </span>
                      <div role="radiogroup" aria-label="Confidence" className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5 shrink-0">
                        {CONFIDENCE_OPTIONS.map((opt) => (
                          <button
                            key={opt.level}
                            type="button"
                            role="radio"
                            aria-checked={confidence === opt.level}
                            onClick={() => { setConfidence(opt.level); playSound('tap'); buzz('light') }}
                            title={`${opt.level} — ${opt.label}`}
                            aria-label={`Confidence level ${opt.level}: ${opt.label}`}
                            className={cn(
                              'h-8 w-8 inline-flex items-center justify-center rounded-md font-mono text-xs font-semibold tabular-nums transition-all cursor-pointer select-none',
                              confidence === opt.level
                                ? 'bg-primary text-primary-foreground font-bold shadow-xs ring-1 ring-primary/40'
                                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                            )}
                          >
                            {opt.level}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {!selfCorrecting && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={requestHint}
                          disabled={hintLevel >= 4}
                          className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                        >
                          <Lightbulb className="h-3.5 w-3.5 text-warning" />
                          <span>Hint</span>
                          <kbd className="rounded border border-border/80 bg-muted/60 px-1 py-0.2 font-mono text-[10px]">H</kbd>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={submit}
                        disabled={submitting || !answer.trim() || (selfCorrecting && !selfCorrection.trim())}
                        className="h-8 gap-2 text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        <span>{selfCorrecting ? 'Evaluate' : 'Submit'}</span>
                        <kbd className="rounded border border-primary-foreground/30 bg-primary-foreground/20 px-1 py-0.2 font-mono text-[10px] text-primary-foreground">
                          {prettyKbd()}
                        </kbd>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <FeedbackView
                  feedback={feedback}
                  diagnosis={diagnosis}
                  answer={answer}
                  followUpAnswer={followUpAnswer}
                  setFollowUpAnswer={setFollowUpAnswer}
                  followUpSent={followUpSent}
                  onSendFollowUp={sendFollowUp}
                  onExplain={explain}
                  explainMore={explainMore}
                  setExplainMore={setExplainMore}
                  explainLoading={explainLoading}
                  onNext={() => nextQuestion()}
                  onSpeak={speak}
                />
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MemoryPanel({ overview }: { overview: Overview }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="label text-muted-foreground">Recent mistakes</div>
        {overview.dueErrors.length ? (
          <div className="mt-2 space-y-1.5">
            {overview.dueErrors.slice(0, 5).map(e => (
              <div key={e.id} className="rounded-md bg-muted/50 p-2 text-xs">
                <span className="font-medium line-through decoration-destructive/60">{e.wrong}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span className="font-semibold text-success">{e.right}</span>
                <span className="block text-muted-foreground">{fmtTag(e.errorType)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Nothing waiting for repair. The Mentor saves mistakes here automatically.</p>
        )}
      </div>
      <div>
        <div className="label text-muted-foreground">Skill strengths</div>
        <div className="mt-2 space-y-2">
          {overview.mastery.slice(0, 6).map(m => (
            <div key={m.tag}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{fmtTag(m.tag)}</span>
                <span className="tabular-nums text-muted-foreground">{Math.round(m.mastery*100)}%</span>
              </div>
              <Progress value={m.mastery*100} className="h-1.5"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MapPanel({ overview, activeBranchId, onPick, onNew }: {
  overview: Overview
  activeBranchId: string
  onPick: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="space-y-2">
      {overview.branches.map(b => {
        const pct = Math.round((overview.mastery.find(m=>m.tag===b.focusTag)?.mastery ?? .5)*100)
        const active = b.id === activeBranchId
        return (
          <Pressable
            key={b.id}
            onTap={() => onPick(b.id)}
            ariaLabel={`Switch to ${b.title}`}
            className={cn('w-full rounded-lg border p-3 text-left transition-colors',
              active ? 'border-primary-line bg-primary-soft shadow-xs' : 'border-border hover:border-primary-line/60 hover:bg-muted/50')}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold">{b.title}</span>
              {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary"/> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{fmtTag(b.focusTag)} · {b.mode}</div>
            <Progress value={pct} className="mt-2 h-1.5"/>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums"><span>{pct}% mastery</span><span>Lv {b.difficultyCeiling}</span></div>
          </Pressable>
        )
      })}
      <Button variant="outline" size="sm" onClick={onNew} className="w-full gap-2"><GitBranch className="h-3.5 w-3.5"/>New branch</Button>
    </div>
  )
}

function FeedbackView({
  feedback, diagnosis, answer, followUpAnswer, setFollowUpAnswer, followUpSent, onSendFollowUp, onExplain, explainMore, setExplainMore, explainLoading, onNext, onSpeak,
}: {
  feedback: Feedback
  diagnosis: any
  answer: string
  followUpAnswer: string
  setFollowUpAnswer: (v: string) => void
  followUpSent: boolean
  onSendFollowUp: () => void
  onExplain: () => void
  explainMore: string
  setExplainMore: (v: string) => void
  explainLoading: boolean
  onNext: () => void
  onSpeak: (t: string) => void
}) {
  const scores = Object.values(feedback.scores)
  const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*100) : 0
  const scoreTone = avg >= 85 ? 'text-success bg-success-soft border-success/30' : avg >= 65 ? 'text-primary bg-primary-soft border-primary-line' : 'text-warning bg-warning-soft border-warning/30'
  const ratingLabel = avg >= 90 ? 'Mastery Level · Fluent' : avg >= 75 ? 'Strong Command' : avg >= 50 ? 'Good Effort · Polish Needed' : 'Review & Practice'

  return (
    <div className="space-y-5">
      {/* Hero Score Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-xl font-bold tabular-nums shadow-xs', scoreTone)}>
            {avg}%
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evaluation Result</div>
            <div className="text-base font-semibold text-foreground">{ratingLabel}</div>
          </div>
        </div>
        <Button onClick={onNext} className="gap-2 cursor-pointer shrink-0">
          <span>Next challenge</span>
          <kbd className="rounded border border-primary-foreground/30 bg-primary-foreground/20 px-1 py-0.2 font-mono text-[10px] text-primary-foreground">R</kbd>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Side-by-side or stacked attempts */}
      <div className="space-y-3">
        {/* Your Attempt */}
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your attempt</div>
          <div className="text-sm leading-relaxed text-foreground font-medium">{answer}</div>
        </div>

        {/* Native Polish */}
        {feedback.native_version && (
          <div className="rounded-xl border border-primary-line bg-primary-soft/80 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Native Polish</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSpeak(feedback.native_version)}
                className="h-7 gap-1 px-2 text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                title="Read aloud"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Listen</span>
              </Button>
            </div>
            <p className="text-base font-semibold leading-relaxed text-foreground">{feedback.native_version}</p>
            {feedback.explanation && (
              <p className="text-xs leading-relaxed text-muted-foreground pt-1.5 border-t border-primary/10">{feedback.explanation}</p>
            )}
          </div>
        )}

        {/* Granular correction diffs */}
        {feedback.corrections.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Corrections</div>
            <div className="flex flex-wrap gap-2 pt-1">
              {feedback.corrections.map((c, i) => (
                <div key={i} className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-xs">
                  <span className="line-through text-destructive decoration-destructive/60 font-medium">{c.wrong}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-success">{c.right}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">{c.type.replaceAll('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diagnosis / Root cause */}
        {diagnosis?.root_cause && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-900 dark:text-amber-200">Why this keeps happening: </span>
              <span className="text-amber-800 dark:text-amber-300">{diagnosis.root_cause}</span>
            </div>
          </div>
        )}
      </div>

      {/* Multi-metric skill radar */}
      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="Grammar" value={feedback.scores.grammar ?? 0.8} />
        <Metric label="Naturalness" value={feedback.scores.naturalness ?? 0.8} />
        <Metric label="Task Completion" value={feedback.scores.task_completion ?? 0.8} />
      </div>

      {/* Follow-up retrieval reinforcement */}
      {feedback.follow_up && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-primary" />
            <span>Reinforcement Drill</span>
            {!followUpSent && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{feedback.follow_up}</p>
          {!followUpSent ? (
            <div className="mt-2.5 flex gap-2">
              <Input
                value={followUpAnswer}
                onChange={(e) => setFollowUpAnswer(e.target.value)}
                onKeyDown={(e) => {
                  typeFeelFromKey(e)
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSendFollowUp()
                  }
                }}
                placeholder="Answer in one sentence…"
                className="h-9 text-sm"
                aria-label="Your answer to the follow-up question"
              />
              <Button size="sm" onClick={onSendFollowUp} disabled={!followUpAnswer.trim()} className="shrink-0 gap-1.5 cursor-pointer">
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </Button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-success-soft p-2.5 text-sm text-success font-medium">
              <Check className="h-4 w-4 shrink-0" />
              <span>Reinforcement registered! Active recall cements long-term mastery.</span>
            </div>
          )}
        </div>
      )}

      {/* Deep Q&A with Mentor */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={explainMore}
            onChange={(e) => setExplainMore(e.target.value)}
            onKeyDown={(e) => {
              typeFeelFromKey(e)
              if (e.key === 'Enter') {
                e.preventDefault()
                onExplain()
              }
            }}
            placeholder="Ask the Mentor to explain further…"
            className="h-9 text-sm"
            aria-label="Ask a follow-up question"
          />
          <Button variant="outline" size="sm" onClick={onExplain} disabled={explainLoading || !explainMore.trim()} className="shrink-0 gap-1.5 cursor-pointer">
            {explainLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
            <span>Ask</span>
          </Button>
        </div>
        {explainLoading && <p className="text-xs text-muted-foreground">The Mentor is analyzing your question…</p>}
      </div>
    </div>
  )
}

function Metric({label,value}:{label:string;value:number}) {
  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-semibold">{Math.round(value*100)}%</span>
      </div>
      <Progress value={value*100} className="mt-2 h-1"/>
    </div>
  )
}

function BranchMaker({ show, overview, state, setters, creating, onCreate }: {
  show:boolean
  overview:Overview
  state:{ branchTitle:string; focusTag:string; branchMode:string; difficulty:string }
  setters:{ setBranchTitle:(v:string)=>void; setFocusTag:(v:string)=>void; setBranchMode:(v:string)=>void; setDifficulty:(v:string)=>void }
  creating:boolean
  onCreate:()=>void
}) {
  const { v, t } = useMotionSafe()
  return (
    <AnimatePresence>
      {show && (
        <motion.div variants={v(fadeUp)} initial="hidden" animate="show" exit="exit" transition={t()}>
          <Card className="border-primary-line">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              <div>
                <label className="label text-muted-foreground" htmlFor="branch-name">Branch name <span className="font-normal">(optional)</span></label>
                <Input id="branch-name" value={state.branchTitle} onChange={e=>setters.setBranchTitle(e.target.value)} onKeyDown={typeFeelFromKey} placeholder="Business English interviews" className="mt-1"/>
              </div>
              <div>
                <div className="label text-muted-foreground">What do you want to fix?</div>
                <Select value={state.focusTag} onValueChange={setters.setFocusTag}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue/></SelectTrigger>
                  <SelectContent>{FOCUS_OPTIONS.map(x=><SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <div className="label text-muted-foreground">How should it feel?</div>
                <Select value={state.branchMode} onValueChange={setters.setBranchMode}>
                  <SelectTrigger className="mt-1 w-full" title={MODE_OPTIONS.find(x=>x.id===state.branchMode)?.description}><SelectValue/></SelectTrigger>
                  <SelectContent>{MODE_OPTIONS.map(x=><SelectItem key={x.id} value={x.id}>{x.label} — {x.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <div className="label text-muted-foreground">Hardest level to allow</div>
                <Select value={state.difficulty} onValueChange={setters.setDifficulty}>
                  <SelectTrigger className="mt-1 w-full" title="Harder questions unlock gradually up to this level"><SelectValue/></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={onCreate} disabled={creating} className="gap-2 sm:col-span-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin"/> : <GitBranch className="h-4 w-4"/>}Create branch
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
