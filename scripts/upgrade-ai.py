from pathlib import Path
p=Path('/mnt/data/lexilearn_full')
# schema
f=p/'prisma/schema.prisma'; s=f.read_text()
s += r'''

model MentorWeeklyReport {
  id           String   @id @default(cuid())
  weekKey      String   @unique
  summary      String
  strengths    String
  weaknesses   String
  topErrors    String
  confidence   String
  nextFocus    String
  actionPlan   String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PronunciationAttempt {
  id              String   @id @default(cuid())
  target          String
  transcript      String
  accuracy        Float
  missingWords    String
  extraWords      String
  feedback        String
  createdAt       DateTime @default(now())

  @@index([createdAt])
}

model NaturalnessAttempt {
  id          String   @id @default(cuid())
  input       String
  score       Float
  verdict     String
  native      String
  alternatives String
  explanation String
  createdAt   DateTime @default(now())

  @@index([createdAt])
}
'''
f.write_text(s)

# agent append utilities
f=p/'src/lib/mentor-agent.ts'; s=f.read_text()
s += r'''

export type WeeklyReport = {
  summary: string
  strengths: string[]
  weaknesses: string[]
  top_errors: { pattern: string; count: number; example: string }[]
  confidence: { average: number; calibration: string }
  next_focus: string[]
  action_plan: string[]
}

export async function buildWeeklyCoachReport(): Promise<{ report: WeeklyReport; cached: boolean; weekKey: string }> {
  await ensureMentorSeed()
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  monday.setHours(0,0,0,0)
  const weekKey = monday.toISOString().slice(0,10)
  const cached = await db.mentorWeeklyReport.findUnique({ where: { weekKey } })
  if (cached) {
    return { cached: true, weekKey, report: {
      summary: cached.summary,
      strengths: JSON.parse(cached.strengths || '[]'), weaknesses: JSON.parse(cached.weaknesses || '[]'),
      top_errors: JSON.parse(cached.topErrors || '[]'), confidence: JSON.parse(cached.confidence || '{}'),
      next_focus: JSON.parse(cached.nextFocus || '[]'), action_plan: JSON.parse(cached.actionPlan || '[]')
    } }
  }
  const since = new Date(monday)
  const [attempts, mastery, errors, reviews] = await Promise.all([
    db.mentorAttempt.findMany({ where: { createdAt: { gte: since } }, include: { feedback: true, node: true }, orderBy: { createdAt: 'asc' }, take: 200 }),
    db.mentorSkillMastery.findMany({ orderBy: { mastery: 'asc' }, take: 30 }),
    db.mentorErrorCard.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, take: 100 }),
    db.reviewLog.findMany({ where: { reviewedAt: { gte: since } }, take: 500 }),
  ])
  const evidence = {
    mentorAttempts: attempts.map(a => ({ answer:a.answer, confidence:a.confidence, feedback:a.feedback ? { scores:a.feedback.scores, diagnosis:a.feedback.diagnosis, corrections:a.feedback.corrections } : null, target:a.node.targetTags })),
    mastery: mastery.map(m => ({tag:m.tag, mastery:m.mastery, attempts:m.attempts, correct:m.correct})),
    recurringErrors: errors.map(e => ({tag:e.tag,type:e.errorType,wrong:e.wrong,right:e.right})),
    vocabularyReviews: { count: reviews.length, correct: reviews.filter(r=>r.isCorrect).length },
  }
  const { structured, WeeklyReportSchema, MENTOR_SYSTEM } = await import('@/lib/ollama')
  let report: WeeklyReport
  try {
    report = await structured<any>([{ role:'system', content: MENTOR_SYSTEM }, { role:'user', content:`Create a concise weekly English coach report from the following evidence. Be honest and specific. Identify real strengths, recurring weaknesses, confidence calibration, and 2-3 next focuses. Do not invent data.\n${JSON.stringify(evidence)}` }], WeeklyReportSchema, 0.2)
  } catch {
    const weak = mastery.slice(0,3)
    report = {
      summary: attempts.length ? `You completed ${attempts.length} Mentor attempts this week. Your next gains will come from repairing the weakest repeated patterns.` : 'Not enough Mentor data this week yet.',
      strengths: mastery.filter(m=>m.mastery>=0.75).slice(0,3).map(m=>`${m.tag.replaceAll('_',' ')} is at ${Math.round(m.mastery*100)}% mastery.`),
      weaknesses: weak.map(m=>`${m.tag.replaceAll('_',' ')} needs more retrieval (${Math.round(m.mastery*100)}% mastery).`),
      top_errors: errors.slice(0,5).map(e=>({pattern:e.errorType,count:1,example:`${e.wrong} → ${e.right}`})),
      confidence: { average: attempts.filter(a=>a.confidence).length ? attempts.reduce((n,a)=>n+(a.confidence||0),0)/attempts.filter(a=>a.confidence).length : 0, calibration:'Keep comparing confidence with actual scores.' },
      next_focus: weak.slice(0,2).map(m=>m.tag), action_plan:['Do one focused Mentor session daily.','Review due error cards before learning new material.','Use Speak practice for one sentence you want to make automatic.']
    }
  }
  await db.mentorWeeklyReport.create({ data:{ weekKey, summary:report.summary, strengths:JSON.stringify(report.strengths), weaknesses:JSON.stringify(report.weaknesses), topErrors:JSON.stringify(report.top_errors), confidence:JSON.stringify(report.confidence), nextFocus:JSON.stringify(report.next_focus), actionPlan:JSON.stringify(report.action_plan) } })
  return { cached:false, weekKey, report }
}

export async function evaluatePronunciation(target: string, transcript: string) {
  const norm = (v:string) => v.toLowerCase().replace(/[^a-z' ]+/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean)
  const expected = norm(target), heard = norm(transcript)
  const expectedSet = new Set(expected), heardSet = new Set(heard)
  const missing = expected.filter(w=>!heardSet.has(w)), extra = heard.filter(w=>!expectedSet.has(w))
  const positionMatches = expected.reduce((n,w,i)=>n+(heard[i]===w?1:0),0)
  const accuracy = expected.length ? Math.max(0, Math.min(1, (positionMatches / expected.length) * 0.75 + (1 - missing.length/expected.length) * 0.25)) : 0
  const { structured, PronunciationSchema, MENTOR_SYSTEM } = await import('@/lib/ollama')
  let feedback:any
  try { feedback = await structured<any>([{role:'system',content:MENTOR_SYSTEM},{role:'user',content:`Evaluate pronunciation practice using only this speech-to-text evidence. Target: ${target}\nHeard: ${transcript}\nMissing words: ${JSON.stringify(missing)}\nExtra words: ${JSON.stringify(extra)}\nGive actionable pronunciation feedback without pretending you heard phonemes.`}], PronunciationSchema, 0.2) }
  catch { feedback = { verdict: accuracy>=.9?'Clear':accuracy>=.7?'Mostly clear':'Needs another attempt', feedback: accuracy>=.9?'The transcript closely matches the target. Focus on rhythm and natural stress.':`Try again and aim to say the whole phrase clearly. ${missing.length ? `You may be dropping: ${missing.slice(0,3).join(', ')}.`:''}`, focus: missing[0] || 'stress and rhythm' } }
  const saved = await db.pronunciationAttempt.create({data:{target,transcript,accuracy,missingWords:JSON.stringify(missing),extraWords:JSON.stringify(extra),feedback:JSON.stringify(feedback)}})
  return { id:saved.id, accuracy, missingWords:missing, extraWords:extra, ...feedback }
}

export async function evaluateNaturalness(input: string) {
  const { structured, NaturalnessSchema, MENTOR_SYSTEM } = await import('@/lib/ollama')
  let result:any
  try { result = await structured<any>([{role:'system',content:MENTOR_SYSTEM},{role:'user',content:`Judge how natural this English sentence sounds to a proficient native speaker. Preserve the intended meaning. Score naturalness 0-1. Provide one native version, 2 alternatives, a short explanation, and a verdict. Sentence: ${input}`}], NaturalnessSchema, 0.15) }
  catch { result = { score:0.7, verdict:'Understandable but can sound more natural', native:input, alternatives:[input], explanation:'Try using the common collocation and word order native speakers usually choose.' } }
  const saved = await db.naturalnessAttempt.create({data:{input,score:result.score,verdict:result.verdict,native:result.native,alternatives:JSON.stringify(result.alternatives||[]),explanation:result.explanation}})
  return { id:saved.id, ...result }
}
'''
f.write_text(s)

# ollama schemas
f=p/'src/lib/ollama.ts'; s=f.read_text()
needle="export const FeedbackSchema"
idx=s.find(needle)
insert=r'''
export const WeeklyReportSchema = {
  type:'object', required:['summary','strengths','weaknesses','top_errors','confidence','next_focus','action_plan'], additionalProperties:false,
  properties:{
    summary:{type:'string'}, strengths:{type:'array',items:{type:'string'}}, weaknesses:{type:'array',items:{type:'string'}},
    top_errors:{type:'array',items:{type:'object',required:['pattern','count','example'],additionalProperties:false,properties:{pattern:{type:'string'},count:{type:'integer'},example:{type:'string'}}}},
    confidence:{type:'object',required:['average','calibration'],additionalProperties:false,properties:{average:{type:'number'},calibration:{type:'string'}}},
    next_focus:{type:'array',items:{type:'string'}}, action_plan:{type:'array',items:{type:'string'}}
  }
}
export const PronunciationSchema = { type:'object', required:['verdict','feedback','focus'], additionalProperties:false, properties:{verdict:{type:'string'},feedback:{type:'string'},focus:{type:'string'}} }
export const NaturalnessSchema = { type:'object', required:['score','verdict','native','alternatives','explanation'], additionalProperties:false, properties:{score:{type:'number'},verdict:{type:'string'},native:{type:'string'},alternatives:{type:'array',items:{type:'string'}},explanation:{type:'string'}} }

'''
s=s[:idx]+insert+s[idx:]
f.write_text(s)

# API imports and cases
f=p/'src/app/api/lexilearn/route.ts'; s=f.read_text()
s=s.replace("import { generateNextNode, evaluateAttempt, getMentorOverview, ensureMentorSeed } from '@/lib/mentor-agent'", "import { generateNextNode, evaluateAttempt, getMentorOverview, ensureMentorSeed, buildWeeklyCoachReport, evaluatePronunciation, evaluateNaturalness } from '@/lib/mentor-agent'")
getcase="""      case 'mentorProfile': {\n        await ensureMentorSeed()\n        const [profile, mastery] = await Promise.all([db.mentorProfile.findUnique({ where: { id: 1 } }), db.mentorSkillMastery.findMany({ orderBy: { mastery: 'asc' } })])\n        return NextResponse.json({ profile, mastery })\n      }\n"""
add=getcase+"""\n      case 'mentorWeeklyReport': {\n        const result = await buildWeeklyCoachReport()\n        return NextResponse.json(result)\n      }\n\n      case 'mentorPronunciationHistory': {\n        const items = await db.pronunciationAttempt.findMany({ orderBy:{createdAt:'desc'}, take:20 })\n        return NextResponse.json(items.map(x=>({id:x.id,target:x.target,transcript:x.transcript,accuracy:x.accuracy,missingWords:JSON.parse(x.missingWords||'[]'),extraWords:JSON.parse(x.extraWords||'[]'),feedback:JSON.parse(x.feedback||'{}'),createdAt:x.createdAt})))\n      }\n\n      case 'mentorNaturalnessHistory': {\n        const items = await db.naturalnessAttempt.findMany({ orderBy:{createdAt:'desc'}, take:20 })\n        return NextResponse.json(items.map(x=>({id:x.id,input:x.input,score:x.score,verdict:x.verdict,native:x.native,alternatives:JSON.parse(x.alternatives||'[]'),explanation:x.explanation,createdAt:x.createdAt})))\n      }\n"""
s=s.replace(getcase,add)
postmarker="      case 'mentorAttempt': {"
# insert POST cases before marker
ins="""      case 'mentorWeeklyReport': {\n        const result = await buildWeeklyCoachReport()\n        return NextResponse.json(result)\n      }\n\n      case 'mentorPronunciation': {\n        const { target, transcript } = body as any\n        if (!target?.trim() || !transcript?.trim()) return NextResponse.json({error:'target and transcript required'},{status:400})\n        return NextResponse.json(await evaluatePronunciation(target.trim(), transcript.trim()))\n      }\n\n      case 'mentorNaturalness': {\n        const { input } = body as any\n        if (!input?.trim()) return NextResponse.json({error:'input required'},{status:400})\n        return NextResponse.json(await evaluateNaturalness(input.trim()))\n      }\n\n"""
s=s.replace(postmarker,ins+postmarker)
f.write_text(s)

# store/page/sidebar
f=p/'src/lib/store.ts'; s=f.read_text().replace("  | 'mentor'", "  | 'mentor'\n  | 'coach-lab'"); f.write_text(s)
f=p/'src/app/page.tsx'; s=f.read_text(); s=s.replace("import { MentorView } from '@/components/views/mentor'", "import { MentorView } from '@/components/views/mentor'\nimport { CoachLabView } from '@/components/views/coach-lab'"); s=s.replace("  mentor: 'AI Mentor',", "  mentor: 'AI Mentor',\n  'coach-lab': 'AI Coach Lab',"); s=s.replace("    case 'mentor': return <MentorView />", "    case 'mentor': return <MentorView />\n    case 'coach-lab': return <CoachLabView />"); f.write_text(s)
