'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, ArrowRight, Brain, Check, ChevronRight, GitBranch, Flame, HelpCircle,
  Lightbulb, Loader2, MessageCircle, PenLine, RefreshCw, RotateCcw, Send, Sparkles,
  Target, Trophy, Volume2, X, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type Branch = { id:string; title:string; focusTag:string; mode:string; difficultyCeiling:number; locked:boolean; createdAt:string }
type Node = { id:string; branchId:string; kind:string; prompt:string; expectedPatterns:string; hints:string; targetTags:string; difficulty:number }
type Feedback = { scores:Record<string,number>; corrections:{wrong:string;right:string;type:string}[]; diff:{text:string;status:'ok'|'error'|'fix';fix?:string}[]; explanation:string; native_version:string; follow_up:string; mastery_delta:Record<string,number> }
type Overview = { project:{id:string;name:string;goal:string|null}; branches:Branch[]; mastery:{tag:string;mastery:number;attempts:number;correct:number}[]; dueErrors:{id:string;tag:string;errorType:string;wrong:string;right:string;context:string}[] }

const MODE_OPTIONS = [
  { id:'drill', label:'Drill', description:'Fast single-focus practice', icon:Target },
  { id:'scenario', label:'Scenario', description:'Roleplay & real situations', icon:MessageCircle },
  { id:'exam', label:'Exam', description:'Timed, rubric-based', icon:Trophy },
  { id:'review', label:'Review', description:'Repair recurring mistakes', icon:RotateCcw },
]

const FOCUS_OPTIONS = ['past_tense','articles','prepositions','collocation','word_choice','naturalness','spelling','pronunciation','conditionals','modals']

export function MentorView() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [branchId, setBranchId] = useState('')
  const [node, setNode] = useState<Node | null>(null)
  const [answer, setAnswer] = useState('')
  const [confidence, setConfidence] = useState(3)
  const [hintLevel, setHintLevel] = useState(0)
  const [hint, setHint] = useState('')
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
  const [explainMore, setExplainMore] = useState('')
  const answerRef = useRef<HTMLTextAreaElement>(null)

  const branch = useMemo(() => overview?.branches.find(b=>b.id===branchId) ?? overview?.branches[0], [overview, branchId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/lexilearn?action=mentorOverview', { cache:'no-store' })
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to load Mentor')
      const data = await r.json() as Overview
      setOverview(data)
      setBranchId(prev => prev || data.branches[0]?.id || '')
    } catch (e:any) { toast.error(e.message || 'Could not load Mentor') }
    finally { setLoading(false) }
  }, [])

  const nextQuestion = useCallback(async (id = branchId) => {
    if (!id) return
    setSubmitting(true); setFeedback(null); setDiagnosis(null); setHint(''); setHintLevel(0); setAnswer(''); setSelfCorrecting(false); setSelfCorrection('')
    try {
      const r = await fetch('/api/lexilearn?action=mentorNext', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({branchId:id}) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Could not create next question')
      setNode(data); setTimeout(()=>answerRef.current?.focus(),100)
    } catch(e:any){ toast.error(e.message || 'Mentor could not create a question') }
    finally { setSubmitting(false) }
  }, [branchId])

  useEffect(()=>{ load() }, [load])
  useEffect(()=>{ if(branchId) nextQuestion(branchId) }, [branchId])

  useEffect(() => {
    const onKey = (e:KeyboardEvent) => {
      if (e.key.toLowerCase()==='h' && node && !feedback) { e.preventDefault(); requestHint() }
      if (e.key.toLowerCase()==='r' && feedback) { e.preventDefault(); nextQuestion() }
    }
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey)
  })

  async function requestHint() {
    if (!node) return
    const level = hintLevel + 1
    try {
      const r = await fetch('/api/lexilearn?action=mentorHint', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nodeId:node.id, level}) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Hint failed')
      setHintLevel(d.level); setHint(d.text)
    } catch(e:any){ toast.error(e.message || 'Hint failed') }
  }

  async function submit() {
    if (!node || !answer.trim()) return
    if (!selfCorrecting) {
      setSelfCorrection(answer.trim())
      setSelfCorrecting(true)
      setSubmitting(false)
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/lexilearn?action=mentorAttempt', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nodeId:node.id, answer:answer.trim(), confidence, hintLevel, selfCorrect:selfCorrection.trim() }) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Evaluation failed')
      setAttemptId(d.attemptId); setFeedback(d.feedback); setDiagnosis(d.diagnosis); setSelfCorrecting(false); await load()
      toast.success(`+${d.xpGain ?? 0} XP · ${Math.round((d.score ?? 0)*100)}% learning score`)
    } catch(e:any){ toast.error(e.message || 'Mentor could not evaluate the answer') }
    finally { setSubmitting(false) }
  }

  async function createBranch() {
    if (!overview) return
    setCreating(true)
    try {
      const r = await fetch('/api/lexilearn?action=mentorBranch', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ projectId:overview.project.id, title:branchTitle.trim() || `${focusTag.replace('_',' ')} practice`, focusTag, mode:branchMode, difficultyCeiling:3, locked:true }) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Could not create branch')
      setShowBranchMaker(false); setBranchTitle(''); await load(); setBranchId(d.id)
      toast.success('New learning branch created')
    } catch(e:any){ toast.error(e.message || 'Branch creation failed') }
    finally { setCreating(false) }
  }

  async function explain() {
    if (!explainMore.trim() || !feedback) return
    try {
      const r = await fetch('/api/lexilearn?action=mentorExplain', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ query:explainMore, context:feedback.explanation }) })
      const d = await r.json(); if(!r.ok) throw new Error(d.error || 'Explain failed')
      setExplainMore(d.response || '')
    } catch {
      // endpoint is optional; keep the right pane useful if unavailable
      toast.error('Deep explanation is unavailable right now')
    }
  }

  function speak(text:string){ try { const u=new SpeechSynthesisUtterance(text); u.rate=0.92; window.speechSynthesis.speak(u) } catch {} }

  if (loading && !overview) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary"/></div>
  if (!overview || !branch) return <div className="p-8 text-center text-muted-foreground">Mentor is not ready yet.</div>

  const mastery = overview.mastery.find(m=>m.tag===branch.focusTag)?.mastery ?? 0.5
  const dueCount = overview.dueErrors.filter(e=>e.tag===branch.focusTag || branch.focusTag==='naturalness').length

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles className="h-3.5 w-3.5"/>AI learning gym</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Mentor</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">One question. One mistake. One lesson. Your Mentor remembers what you struggle with.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4"/>Refresh</Button>
          <Button size="sm" onClick={()=>setShowBranchMaker(v=>!v)} className="gap-2"><GitBranch className="h-4 w-4"/>New branch</Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_330px]">
        <Card className="h-fit overflow-hidden">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Learning map</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0">
            {overview.branches.map((b)=>{
              const pct=Math.round((overview.mastery.find(m=>m.tag===b.focusTag)?.mastery ?? .5)*100)
              return <button key={b.id} onClick={()=>setBranchId(b.id)} className={cn('w-full rounded-xl border p-3 text-left transition-all',b.id===branchId?'border-primary/40 bg-primary/5 shadow-sm':'hover:border-primary/20 hover:bg-muted/50')}>
                <div className="flex items-start justify-between gap-2"><span className="font-semibold text-sm">{b.title}</span><ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground"/></div>
                <div className="mt-1 text-xs text-muted-foreground">{b.focusTag.replaceAll('_',' ')} · {b.mode}</div>
                <Progress value={pct} className="mt-3 h-1.5"/>
                <div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span>{pct}% mastery</span><span>Lv {b.difficultyCeiling}</span></div>
              </button>
            })}
            <Separator/>
            <div className="rounded-xl bg-muted/50 p-3"><div className="flex items-center gap-2 text-xs font-semibold"><Brain className="h-3.5 w-3.5 text-primary"/>Due repairs</div><div className="mt-1 text-2xl font-bold">{dueCount}</div><p className="text-xs text-muted-foreground">Recurring mistakes waiting for another rep.</p></div>
          </CardContent>
        </Card>

        <Card className="min-h-[560px] overflow-hidden">
          <div className="border-b bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Badge variant="secondary">{branch.mode}</Badge><Badge variant="outline">Focus: {branch.focusTag.replaceAll('_',' ')}</Badge>{dueCount>0 && <Badge className="gap-1"><RotateCcw className="h-3 w-3"/>{dueCount} due</Badge>}</div>
              <div className="text-right"><div className="text-xs text-muted-foreground">Mastery</div><div className="font-bold">{Math.round(mastery*100)}%</div></div>
            </div>
            <Progress value={mastery*100} className="mt-4 h-2"/>
          </div>
          <CardContent className="p-5 sm:p-8">
            {!node ? <div className="flex min-h-[380px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div> : (
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">QUESTION · difficulty {node.difficulty}/5</span><Button variant="ghost" size="icon" onClick={()=>speak(node.prompt)} title="Read aloud"><Volume2 className="h-4 w-4"/></Button></div>
                <motion.div key={node.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
                  <p className="text-xl font-semibold leading-relaxed sm:text-2xl">{node.prompt}</p>
                  {hint && !feedback && <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/40 bg-amber-50/60 p-4 text-sm dark:bg-amber-950/20"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/><div><div className="font-semibold">Hint {hintLevel}</div><div className="text-muted-foreground">{hint}</div></div></div>}
                  {!feedback ? (
                    <div className="mt-6 space-y-3">
                      <Textarea
                        ref={answerRef}
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }}
                        placeholder="Type your answer…"
                        className="min-h-[150px] resize-y text-base leading-relaxed"
                        disabled={selfCorrecting}
                      />
                      {selfCorrecting && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Brain className="h-4 w-4 text-primary"/>Self-correct before seeing the diagnosis</div><p className="mt-1 text-xs text-muted-foreground">Look again. What would you change in your answer? This attempt is intentionally not graded yet.</p><Textarea value={selfCorrection} onChange={e=>setSelfCorrection(e.target.value)} className="mt-3 min-h-[90px] bg-background" placeholder="Write your corrected version…" autoFocus/></div>}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">How confident are you?</div>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(v => <button key={v} onClick={() => setConfidence(v)} className={cn('flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold', confidence === v ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{v}</button>)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={requestHint} disabled={hintLevel >= 4} className="gap-2"><Lightbulb className="h-4 w-4"/>Hint <span className="text-xs opacity-60">H</span></Button>
                          <Button onClick={submit} disabled={submitting || !answer.trim() || (selfCorrecting && !selfCorrection.trim())} className="gap-2">{submitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}Submit <span className="text-xs opacity-70">⌘↵</span></Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <FeedbackView feedback={feedback} diagnosis={diagnosis} answer={answer} onNext={() => nextQuestion()} onSpeak={speak} attemptId={attemptId} />
                  )}
                </motion.div>
                {feedback && <div className="flex flex-wrap gap-2"><Badge variant="outline" className="gap-1"><Zap className="h-3 w-3"/>Feedback stored</Badge><Badge variant="outline" className="gap-1"><Brain className="h-3 w-3"/>Mastery updated</Badge><Badge variant="outline" className="gap-1"><RotateCcw className="h-3 w-3"/>Error saved to review</Badge></div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit overflow-hidden">
          <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm">Mentor memory</CardTitle><Badge variant="outline" className="gap-1"><Flame className="h-3 w-3"/>{overview.mastery.length} skills</Badge></div></CardHeader>
          <CardContent className="space-y-4 pt-0">
            {overview.dueErrors.length>0 && <div className="rounded-2xl border border-amber-400/30 bg-amber-50/50 p-3 dark:bg-amber-950/15"><div className="flex items-center gap-2 text-xs font-semibold"><RotateCcw className="h-3.5 w-3.5 text-amber-500"/>Recent mistakes</div><div className="mt-2 space-y-2">{overview.dueErrors.slice(0,4).map(e=><div key={e.id} className="rounded-xl bg-background/80 p-2.5 text-xs"><span className="font-medium line-through decoration-destructive/60">{e.wrong}</span><span className="mx-1 text-muted-foreground">→</span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{e.right}</span><div className="mt-1 text-xs text-muted-foreground">{e.errorType}</div></div>)}</div></div>}
            <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Weakest skills</div><div className="space-y-2">{overview.mastery.slice(0,6).map(m=><div key={m.tag}><div className="mb-1 flex justify-between text-xs"><span>{m.tag.replaceAll('_',' ')}</span><span>{Math.round(m.mastery*100)}%</span></div><Progress value={m.mastery*100} className="h-1.5"/></div>)}</div></div>
            <div className="rounded-2xl bg-primary/5 p-3"><div className="text-xs font-semibold">How the Mentor works</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">It asks before explaining, stays inside your focus, diagnoses the root cause, and schedules your mistakes for repair.</p></div>
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>{showBranchMaker && <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}><Card className="border-primary/20"><CardContent className="grid gap-3 p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end"><div><label className="text-xs font-medium">Branch name</label><Input value={branchTitle} onChange={e=>setBranchTitle(e.target.value)} placeholder="Business English interviews"/></div><div><label className="text-xs font-medium">Focus</label><select value={focusTag} onChange={e=>setFocusTag(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">{FOCUS_OPTIONS.map(x=><option key={x}>{x}</option>)}</select></div><div><label className="text-xs font-medium">Mode</label><select value={branchMode} onChange={e=>setBranchMode(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">{MODE_OPTIONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div><Button onClick={createBranch} disabled={creating||!overview.project.id}>{creating?<Loader2 className="h-4 w-4 animate-spin"/>:<GitBranch className="h-4 w-4"/>}Create</Button></CardContent></Card></motion.div>}</AnimatePresence>
    </div>
  )
}

function FeedbackView({ feedback, diagnosis, answer, onNext, onSpeak }: { feedback:Feedback; diagnosis:any; answer:string; onNext:()=>void; onSpeak:(x:string)=>void; attemptId:string }) {
  const avg=Math.round(Object.values(feedback.scores).reduce((a,b)=>a+b,0)/Object.values(feedback.scores).length*100)
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-medium text-muted-foreground">RESULT</div><div className="mt-1 text-3xl font-bold">{avg}% <span className="text-base font-normal text-muted-foreground">learning score</span></div></div><Button onClick={onNext} className="gap-2">Next challenge<ArrowRight className="h-4 w-4"/></Button></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Grammar" value={feedback.scores.grammar}/><Metric label="Naturalness" value={feedback.scores.naturalness}/><Metric label="Task" value={feedback.scores.task_completion}/></div>
    <div className="rounded-2xl border bg-muted/20 p-4"><div className="mb-3 text-xs font-semibold text-muted-foreground">YOUR ANSWER</div><div className="text-sm leading-relaxed">{answer}</div></div>
    {feedback.corrections.length>0 && <div className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">CORRECTIONS</div>{feedback.corrections.map((c,i)=><div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm"><span className="rounded-md bg-destructive/10 px-2 py-1 line-through">{c.wrong}</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground"/><span className="rounded-md bg-emerald-500/10 px-2 py-1 font-semibold">{c.right}</span><Badge variant="outline" className="ml-auto text-xs">{c.type}</Badge></div>)}</div>}
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-primary"><Lightbulb className="h-4 w-4"/>One lesson</div><p className="mt-2 text-sm leading-relaxed">{feedback.explanation}</p></div>
    <div><div className="mb-2 text-xs font-semibold text-muted-foreground">NATIVE VERSION</div><div className="flex gap-2 rounded-xl bg-card p-3 text-sm leading-relaxed border"><div className="flex-1">{feedback.native_version}</div><Button variant="ghost" size="icon" onClick={()=>onSpeak(feedback.native_version)}><Volume2 className="h-4 w-4"/></Button></div></div>
    {diagnosis?.root_cause && <div className="rounded-xl border p-3 text-xs"><span className="font-semibold">Root cause:</span> <span className="text-muted-foreground">{diagnosis.root_cause}</span></div>}
    <div className="rounded-xl border border-dashed p-3"><div className="text-xs font-semibold">Now retrieve the fix</div><div className="mt-1 text-sm text-muted-foreground">{feedback.follow_up}</div></div>
  </div>
}

function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-xl border p-3"><div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>{Math.round(value*100)}%</span></div><Progress value={value*100} className="mt-2 h-1.5"/></div> }
