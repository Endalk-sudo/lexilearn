'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, BookOpenText, Brain, Check, ChevronRight, CircleDot, Flame,
  Loader2, Mic, MicOff, RotateCcw, Sparkles, Target, Trophy, Volume2, WandSparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { speak } from '@/lib/tts'
import { typeFeelFromKey } from '@/lib/feel'
import { fadeUp, stagger, useMotionSafe } from '@/lib/motion'
import { fmtTag } from '@/components/views/mentor'

type Mastery = { tag:string; mastery:number; attempts:number; correct:number; lastSeen?:string|null }
type Branch = { id:string; title:string; focusTag:string; mode:string; difficultyCeiling:number; locked:boolean; parentBranchId?:string|null; parentNodeId?:string|null }
type Report = { summary:string; strengths:string[]; weaknesses:string[]; top_errors:{pattern:string;count:number;example:string}[]; confidence:{average:number;calibration:string}; next_focus:string[]; action_plan:string[] }
type PronResult = { accuracy:number; missingWords:string[]; extraWords:string[]; verdict:string; feedback:string; focus:string }
type NaturalResult = { score:number; verdict:string; native:string; alternatives:string[]; explanation:string }

const GROUPS = [
  { name:'Grammar', tags:['past_tense','articles','prepositions','conditionals','modals'] },
  { name:'Vocabulary', tags:['collocation','word_choice','spelling'] },
  { name:'Fluency', tags:['naturalness','pronunciation'] },
]

const SPEAK_PROMPTS = [
  'I have been learning software engineering because I want to build useful products.',
  'Yesterday I finished my work early, so I went for a walk in the evening.',
  'In my opinion, the best way to improve English is to practice a little every day.',
  'I would like to work with ambitious people and learn from real projects.',
]

export function CoachLabView() {
  const setCoachTab = useAppStore(s=>s.setCoachTab)
  const [mastery,setMastery]=useState<Mastery[]>([])
  const [branches,setBranches]=useState<Branch[]>([])
  const [report,setReport]=useState<Report|null>(null)
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [reportLoading,setReportLoading]=useState(false)
  const [natural,setNatural]=useState<NaturalResult|null>(null)
  const [naturalInput,setNaturalInput]=useState('')
  const [naturalLoading,setNaturalLoading]=useState(false)
  const [target,setTarget]=useState(SPEAK_PROMPTS[0])
  const [transcript,setTranscript]=useState('')
  const [listening,setListening]=useState(false)
  const [pron,setPron]=useState<PronResult|null>(null)
  const [pronLoading,setPronLoading]=useState(false)
  const { v, t } = useMotionSafe()

  const load = useCallback(async()=>{
    setLoading(true); setLoadError('')
    try {
      const r=await fetch('/api/lexilearn?action=mentorOverview',{cache:'no-store'})
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not load Insights')
      setMastery(d.mastery||[]); setBranches(d.branches||[])
    } catch(e:any){ toast.error(e.message||'Could not load Insights'); setLoadError(e.message||'Could not load Insights') }
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  async function generateReport(){
    setReportLoading(true)
    try {
      const r=await fetch('/api/lexilearn?action=mentorWeeklyReport',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Could not generate report')
      setReport(d.report); toast.success(d.cached?'Loaded this week’s report':'Weekly report generated')
    }
    catch(e:any){ toast.error(e.message||'Report generation failed') }
    finally{setReportLoading(false)}
  }

  function startListening(){
    const w=window as any
    const Recognition=w.SpeechRecognition||w.webkitSpeechRecognition
    if(!Recognition){toast.error('Speech recognition is not supported in this browser. Try Chrome or Edge.'); return}
    const rec=new Recognition()
    rec.lang='en-US'; rec.interimResults=true; rec.continuous=false
    rec.onstart=()=>{setListening(true); setPron(null)}
    rec.onresult=(event:any)=>{ let final=''; let interim=''; for(let i=event.resultIndex;i<event.results.length;i++){const tr=event.results[i][0].transcript; event.results[i].isFinal?final+=tr:interim+=tr} setTranscript(prev=>final ? final : interim) }
    rec.onerror=()=>{setListening(false);toast.error('I could not hear that clearly. Try again in a quiet place.')}
    rec.onend=()=>setListening(false)
    rec.start()
  }

  async function evaluatePron(){
    if(!target.trim()||!transcript.trim()) return
    setPronLoading(true)
    try{const r=await fetch('/api/lexilearn?action=mentorPronunciation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,transcript})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Pronunciation evaluation failed'); setPron(d)}catch(e:any){toast.error(e.message||'Pronunciation evaluation failed')}finally{setPronLoading(false)}
  }

  async function evaluateNatural(){
    if(!naturalInput.trim()) return
    setNaturalLoading(true)
    try{const r=await fetch('/api/lexilearn?action=mentorNaturalness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:naturalInput})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'Naturalness check failed'); setNatural(d)}catch(e:any){toast.error(e.message||'Naturalness check failed')}finally{setNaturalLoading(false)}
  }

  const get = (tag:string)=>mastery.find(x=>x.tag===tag)?.mastery ?? 0.5
  const overall = useMemo(()=>mastery.length?Math.round(mastery.reduce((a,b)=>a+b.mastery,0)/mastery.length*100):0,[mastery])
  const sorted = [...mastery].sort((a,b)=>a.mastery-b.mastery)

  if(loading) return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24"/>
        <Skeleton className="h-7 w-72 max-w-full"/>
        <Skeleton className="h-4 w-96 max-w-full"/>
        <Skeleton className="h-3 w-40"/>
      </div>
      <Skeleton className="surface h-36 rounded-lg"/>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="surface h-64 rounded-lg"/>
        <Skeleton className="surface h-64 rounded-lg"/>
        <Skeleton className="surface h-64 rounded-lg"/>
        <Skeleton className="surface h-64 rounded-lg"/>
        <Skeleton className="surface h-64 rounded-lg"/>
        <Skeleton className="surface h-64 rounded-lg"/>
      </div>
    </div>
  )

  if(loadError || (!mastery.length && !branches.length)) return (
    <EmptyState
      icon={Sparkles}
      title="Insights is not ready yet"
      hint={loadError || 'Once you have practiced with the Mentor, your skill map, weekly report and speaking tools appear here.'}
      actionLabel="Try again"
      onAction={load}
      secondary={loadError ? undefined : <Button variant="outline" size="sm" onClick={()=>setCoachTab('coach')}>Start with Mentor</Button>}
    />
  )

  return <div className="space-y-6">
    <PageHeader
      eyebrow="AI Coach"
      icon={Sparkles}
      title="Insights"
      description="Your skill map, weekly coaching report, speaking practice, and naturalness engine — all connected to Mentor memory."
      actions={<Button variant="outline" size="sm" onClick={load} className="gap-2"><RotateCcw className="h-4 w-4"/>Refresh</Button>}
    />

    <div className="surface p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="label text-muted-foreground">English mastery</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{overall}%</div>
          <p className="mt-1 text-sm text-muted-foreground">Across {mastery.length || 0} tracked skills</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[500px]">
          <MiniStat icon={Target} label="Weakest" value={sorted[0]?.tag ? fmtTag(sorted[0].tag) : '—'}/>
          <MiniStat icon={Trophy} label="Strongest" value={sorted.at(-1)?.tag ? fmtTag(sorted.at(-1)!.tag) : '—'}/>
          <MiniStat icon={Flame} label="Branches" value={String(branches.length)}/>
          <MiniStat icon={Brain} label="Attempts" value={String(mastery.reduce((n,m)=>n+m.attempts,0))}/>
        </div>
      </div>
    </div>

    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Skill map</h2>
        <p className="mt-1 text-sm text-muted-foreground">Weaknesses become training paths. Stronger skills unlock harder work.</p>
      </div>
      <motion.div variants={v(stagger(0.05))} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-3">
        {GROUPS.map(group=>(
          <motion.div key={group.name} variants={v(fadeUp)}>
            <Card className="h-full">
              <CardHeader className="pb-3"><CardTitle className="text-sm">{group.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-0">
                {group.tags.map((tag,i)=>{
                  const pct=Math.round(get(tag)*100)
                  const unlocked=pct>=75 || i===0
                  return (
                    <button
                      key={tag}
                      onClick={()=>setCoachTab('coach')}
                      aria-label={`${fmtTag(tag)} — ${pct}% mastery. Practice in Mentor.`}
                      className={cn('w-full rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm', !unlocked&&'opacity-75')}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md',pct>=75?'bg-success-soft text-success':'bg-primary-soft text-primary')}>
                          <CircleDot className="h-3.5 w-3.5"/>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{fmtTag(tag)}</span>
                            {unlocked?<Check className="h-3.5 w-3.5 shrink-0 text-success"/>:<Badge variant="outline" className="shrink-0 text-xs">Locked</Badge>}
                          </div>
                          <Progress value={pct} className="mt-2 h-1.5"/>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums"><span>{pct}% mastery</span><span>{mastery.find(x=>x.tag===tag)?.attempts||0} attempts</span></div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>

    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><CircleDot className="h-4 w-4 text-primary"/>Learning paths</CardTitle>
            <CardDescription>Every Mentor branch becomes a path you can resume or fork. Harder paths visually unlock as mastery rises.</CardDescription>
          </div>
          <Button onClick={()=>setCoachTab('coach')} className="shrink-0 gap-2">Open Mentor <ArrowRight className="h-4 w-4"/></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {branches.length ? branches.map((b, i) => {
            const pct=Math.round(get(b.focusTag)*100); const gated=b.difficultyCeiling>=4 && pct<75
            return (
              <button key={b.id} onClick={()=>setCoachTab('coach')} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary-line hover:bg-primary-soft/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary text-xs font-semibold tabular-nums">{i+1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{b.title}</span>
                    {gated&&<Badge variant="outline" className="shrink-0 text-xs">Mastery gate</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{fmtTag(b.focusTag)} · {b.mode} · level {b.difficultyCeiling}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{width:`${pct}%`}}/></div>
</div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
              </button>
            )
          }) : <p className="text-sm text-muted-foreground">Create your first Mentor path to start building the map.</p>}
        </div>
      </CardContent>
    </Card>

    <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><WandSparkles className="h-4 w-4 text-primary"/>Weekly coach report</CardTitle>
              <CardDescription>Mentor analyzes the week instead of just counting activity.</CardDescription>
            </div>
            <Button onClick={generateReport} disabled={reportLoading} className="shrink-0 gap-2">{reportLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}{report?'Refresh report':'Generate'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!report ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <BookOpenText className="mx-auto h-8 w-8 text-muted-foreground"/>
              <p className="mt-3 font-semibold">No report for this week yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">Generate one after a few Mentor sessions. It will be cached for the week.</p>
            </div>
          ) : (
            <div className="space-y-5" aria-live="polite">
              <div className="rounded-lg bg-primary-soft p-4 text-sm leading-relaxed">{report.summary}</div>
              <div className="grid gap-4 sm:grid-cols-2"><ReportList title="What is improving" items={report.strengths}/><ReportList title="What needs work" items={report.weaknesses}/></div>
              <div>
                <div className="label mb-2 text-muted-foreground">Recurring errors</div>
                <div className="space-y-2">
                  {report.top_errors.length?report.top_errors.map((e,i)=>(
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Badge variant="outline" className="tabular-nums">{e.count}×</Badge>
                      <span className="font-semibold">{e.pattern}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{e.example}</span>
                    </div>
                  )):<p className="text-sm text-muted-foreground">No recurring Mentor errors recorded this week.</p>}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between text-xs"><span className="font-semibold">Confidence</span><span className="tabular-nums">{report.confidence.average?report.confidence.average.toFixed(1):'—'} / 5</span></div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.confidence.calibration}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2"><ReportList title="Next focus" items={report.next_focus}/><ReportList title="This week's action plan" items={report.action_plan}/></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Mic className="h-4 w-4 text-primary"/>Pronunciation Gym</CardTitle>
            <CardDescription>Speak a target sentence. We compare the transcript and coach what to retry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="label text-muted-foreground">Target</div>
              <p className="mt-2 text-lg font-semibold leading-relaxed">{target}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={()=>speak(target)} className="gap-2"><Volume2 className="h-4 w-4"/>Listen</Button>
                <Button variant="ghost" size="sm" onClick={()=>setTarget(SPEAK_PROMPTS[Math.floor(Math.random()*SPEAK_PROMPTS.length)])}>New sentence</Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={startListening} disabled={listening} className="gap-2 flex-1">{listening?<><MicOff className="h-4 w-4 animate-pulse"/>Listening…</>:<><Mic className="h-4 w-4"/>Speak now</>}</Button>
              <Button variant="outline" onClick={evaluatePron} disabled={pronLoading||!transcript.trim()} className="gap-2">{pronLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}<span>{pronLoading?'Evaluating…':'Evaluate'}</span></Button>
            </div>
            <Textarea value={transcript} onChange={e=>setTranscript(e.target.value)} onKeyDown={typeFeelFromKey} placeholder="Your speech transcript appears here…" className="min-h-[80px]" aria-label="Speech transcript"/>
            {pron&&(
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Speech match</div>
                    <div className="text-3xl font-semibold tabular-nums">{Math.round(pron.accuracy*100)}%</div>
                  </div>
                  <Badge>{pron.verdict}</Badge>
                </div>
                <Progress value={pron.accuracy*100}/>
                <p className="text-sm leading-relaxed">{pron.feedback}</p>
                {pron.focus&&<div className="text-xs text-muted-foreground">Focus next: <span className="font-semibold text-foreground">{pron.focus}</span></div>}
              </motion.div>
            )}
            {typeof window !== 'undefined' && !(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition && <p className="text-xs text-muted-foreground">Speech recognition is unavailable in this browser. Chrome or Edge is recommended for the full speaking loop.</p>}
          </CardContent>
</Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><WandSparkles className="h-4 w-4 text-primary"/>Naturalness Engine</CardTitle>
            <CardDescription>Go beyond “grammatically correct” and learn what sounds natural.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={naturalInput} onChange={e=>{setNaturalInput(e.target.value);setNatural(null)}} onKeyDown={typeFeelFromKey} placeholder="Write a sentence you would actually say…" className="min-h-[100px]" aria-label="Sentence to check for naturalness"/>
            <Button onClick={evaluateNatural} disabled={naturalLoading||!naturalInput.trim()} className="w-full gap-2">{naturalLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}Check naturalness</Button>
            {natural&&(
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="space-y-3 rounded-lg border bg-muted/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-semibold tabular-nums">{Math.round(natural.score*100)}%</div>
                  <Badge variant="outline">{natural.verdict}</Badge>
                </div>
                <div>
                  <div className="label text-muted-foreground">Native version</div>
                  <p className="mt-1 text-sm font-semibold">{natural.native}</p>
                </div>
                <div>
                  <div className="label text-muted-foreground">Why</div>
                  <p className="mt-1 text-sm text-muted-foreground">{natural.explanation}</p>
                </div>
                {natural.alternatives?.length>0&&(
                  <div>
                    <div className="label text-muted-foreground">Alternatives</div>
                    <div className="mt-1 space-y-1">
                      {natural.alternatives.map((x,i)=><div key={i} className="rounded-md bg-background px-3 py-2 text-sm">{x}</div>)}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>

    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">Ready to turn a weakness into a skill?</div>
          <p className="text-sm text-muted-foreground">Mentor can start a focused branch from your current map.</p>
        </div>
        <Button onClick={()=>setCoachTab('coach')} className="gap-2">Open Mentor <ArrowRight className="h-4 w-4"/></Button>
      </CardContent>
    </Card>
  </div>
}

function MiniStat({icon:Icon,label,value}:{icon:any;label:string;value:string}){
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <Icon className="h-4 w-4 text-primary"/>
      <div className="mt-2 truncate text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function ReportList({title,items}:{title:string;items:string[]}){
  return (
    <div>
      <div className="label mb-2 text-muted-foreground">{title}</div>
      {items.length?(
        <div className="space-y-1.5">
          {items.map((x,i)=>(
            <div key={i} className="flex gap-2 text-sm"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><span>{x}</span></div>
          ))}
        </div>
      ):<div className="text-sm text-muted-foreground">Nothing recorded yet.</div>}
    </div>
  )
}
