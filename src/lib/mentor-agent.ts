import { z } from 'zod'
import { db } from '@/lib/db'
import { ollamaChat, ollamaEmbed, MENTOR_SYSTEM } from '@/lib/ollama'

const QuestionSchema = z.object({
  action: z.literal('question'),
  node: z.object({
    kind: z.enum(['question', 'scenario', 'challenge', 'review']),
    prompt: z.string().min(1),
    target_tags: z.array(z.string()).min(1).max(4),
    difficulty: z.number().int().min(1).max(5),
    expected_patterns: z.array(z.string()).min(1).max(8),
    hints: z.array(z.string()).min(1).max(4),
  }),
  focus: z.string().min(1),
  reason: z.string().min(1),
})

const DiagnosisSchema = z.object({
  error_types: z.array(z.string()),
  root_cause: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).max(5),
  recommended_action: z.enum(['drill', 'review', 'new_question', 'branch', 'feedback']),
})

const FeedbackSchema = z.object({
  action: z.literal('feedback'),
  scores: z.object({
    grammar: z.number().min(0).max(1),
    spelling: z.number().min(0).max(1),
    naturalness: z.number().min(0).max(1),
    register: z.number().min(0).max(1),
    pragmatics: z.number().min(0).max(1),
    task_completion: z.number().min(0).max(1),
  }),
  corrections: z.array(z.object({ wrong: z.string(), right: z.string(), type: z.string() })).max(8),
  diff: z.array(z.object({ text: z.string(), status: z.enum(['ok', 'error', 'fix']), fix: z.string().optional() })),
  explanation: z.string(),
  native_version: z.string(),
  follow_up: z.string(),
  mastery_delta: z.record(z.string(), z.number()),
})

const HintSchema = z.object({ action: z.literal('hint'), level: z.number().int().min(1).max(4), text: z.string() })

const WeeklyReportSchema = z.object({
  summary:z.string(), strengths:z.array(z.string()), weaknesses:z.array(z.string()),
  top_errors:z.array(z.object({pattern:z.string(),count:z.number().int(),example:z.string()})),
  confidence:z.object({average:z.number(),calibration:z.string()}),
  next_focus:z.array(z.string()), action_plan:z.array(z.string())
})
const PronunciationSchema = z.object({ verdict:z.string(), feedback:z.string(), focus:z.string() })
const NaturalnessSchema = z.object({ score:z.number().min(0).max(1), verdict:z.string(), native:z.string(), alternatives:z.array(z.string()), explanation:z.string() })

function jsonSchema(schema: z.ZodType) {
  // Ollama accepts JSON Schema in `format`. Zod's JSON-schema package varies by version,
  // so we keep a compact explicit schema per contract below.
  return schema === QuestionSchema ? {
    type: 'object', required: ['action', 'node', 'focus', 'reason'], properties: {
      action: { type: 'string', enum: ['question'] }, focus: { type: 'string' }, reason: { type: 'string' },
      node: { type: 'object', required: ['kind', 'prompt', 'target_tags', 'difficulty', 'expected_patterns', 'hints'], properties: {
        kind: { type: 'string' }, prompt: { type: 'string' }, target_tags: { type: 'array', items: { type: 'string' } },
        difficulty: { type: 'integer' }, expected_patterns: { type: 'array', items: { type: 'string' } }, hints: { type: 'array', items: { type: 'string' } },
      } }
    }
  } : schema === DiagnosisSchema ? {
    type: 'object', required: ['error_types', 'root_cause', 'confidence', 'evidence', 'recommended_action'], properties: {
      error_types: { type: 'array', items: { type: 'string' } }, root_cause: { type: 'string' }, confidence: { type: 'number' },
      evidence: { type: 'array', items: { type: 'string' } }, recommended_action: { type: 'string' },
    }
  } : schema === FeedbackSchema ? {
    type: 'object', required: ['action','scores','corrections','diff','explanation','native_version','follow_up','mastery_delta'], properties: {
      action: { type: 'string' },
      scores: { type: 'object', required: ['grammar','spelling','naturalness','register','pragmatics','task_completion'], properties: Object.fromEntries(['grammar','spelling','naturalness','register','pragmatics','task_completion'].map(k => [k, { type: 'number' }])) },
      corrections: { type: 'array', items: { type: 'object', required: ['wrong','right','type'], properties: { wrong:{type:'string'}, right:{type:'string'}, type:{type:'string'} } } },
      diff: { type: 'array', items: { type:'object', required:['text','status'], properties:{ text:{type:'string'}, status:{type:'string'}, fix:{type:'string'} } } },
      explanation:{type:'string'}, native_version:{type:'string'}, follow_up:{type:'string'}, mastery_delta:{type:'object', additionalProperties:{type:'number'}}
    }
  } : schema === WeeklyReportSchema ? {
    type:'object', required:['summary','strengths','weaknesses','top_errors','confidence','next_focus','action_plan'], properties:{
      summary:{type:'string'}, strengths:{type:'array',items:{type:'string'}}, weaknesses:{type:'array',items:{type:'string'}},
      top_errors:{type:'array',items:{type:'object',required:['pattern','count','example'],properties:{pattern:{type:'string'},count:{type:'integer'},example:{type:'string'}}}},
      confidence:{type:'object',required:['average','calibration'],properties:{average:{type:'number'},calibration:{type:'string'}}}, next_focus:{type:'array',items:{type:'string'}}, action_plan:{type:'array',items:{type:'string'}}
    }
  } : schema === PronunciationSchema ? { type:'object',required:['verdict','feedback','focus'],properties:{verdict:{type:'string'},feedback:{type:'string'},focus:{type:'string'}} }
  : schema === NaturalnessSchema ? { type:'object',required:['score','verdict','native','alternatives','explanation'],properties:{score:{type:'number'},verdict:{type:'string'},native:{type:'string'},alternatives:{type:'array',items:{type:'string'}},explanation:{type:'string'}} }
  : { type:'object', required:['action','level','text'], properties:{ action:{type:'string'}, level:{type:'integer'}, text:{type:'string'} } }
}

function cleanJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
  const raw = fenced || text
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first >= 0 && last > first) return raw.slice(first, last + 1)
  return raw
}

async function structured<T>(messages: { role: 'system'|'user'|'assistant', content: string }[], schema: z.ZodType<T>, temperature = 0.2): Promise<T> {
  const schemaJson = JSON.stringify(jsonSchema(schema))
  const enhanced = [...messages, { role: 'user' as const, content: `Return ONLY valid JSON matching this schema. Do not use markdown.\nSCHEMA:\n${schemaJson}` }]
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await ollamaChat(enhanced, { temperature, format: jsonSchema(schema) as any })
      const parsed = schema.parse(JSON.parse(cleanJson(raw)))
      return parsed
    } catch (error) {
      if (attempt === 1) throw error
      enhanced.push({ role: 'user', content: 'Your previous response was invalid. Repair it and return only the JSON object.' })
    }
  }
  throw new Error('Structured generation failed')
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export async function retrieveKnowledge(query: string, tag?: string, limit = 4) {
  const chunks = await db.mentorKnowledge.findMany({ where: tag ? { tag } : undefined, take: 80 })
  if (!chunks.length) return []
  try {
    const [q] = await ollamaEmbed(query)
    const scored = chunks.map(c => ({ ...c, score: c.embedding ? cosine(q, JSON.parse(c.embedding)) : 0 })).sort((a,b)=>b.score-a.score)
    return scored.slice(0, limit)
  } catch {
    return chunks.slice(0, limit).map(c => ({ ...c, score: 0 }))
  }
}

export async function ensureMentorSeed() {
  const profile = await db.mentorProfile.findUnique({ where: { id: 1 } })
  if (!profile) await db.mentorProfile.create({ data: { id: 1, goals: JSON.stringify(['Improve English accuracy and fluency']), preferences: JSON.stringify({ tone:'direct', variant:'international' }), notes:'' } })
  const count = await db.mentorKnowledge.count()
  if (count > 0) return
  const rules = [
    ['past_tense','Simple past','Use the simple past for completed actions at a finished time in the past. Irregular verbs must be memorized: see → saw → seen.'],
    ['articles','Articles','Use a/an for a non-specific singular countable noun and the for a specific or already identified noun.'],
    ['collocation','Collocations','Prefer natural word partnerships such as make a decision, take a photo, and heavy rain.'],
    ['prepositions','Prepositions','Many verbs and adjectives select conventional prepositions: interested in, depend on, good at.'],
    ['word_choice','Word choice','Choose words by meaning, register, and collocation, not by dictionary similarity alone.'],
    ['naturalness','Natural English','Natural English often uses shorter, conventional phrases rather than literal translations.'],
  ]
  for (const [tag,title,content] of rules) {
    const embedding: string | null = null
    await db.mentorKnowledge.create({ data: { tag, title, content, embedding, source: 'LexiLearn built-in grammar notes' } })
  }
}

async function learnerContext(focusTag: string) {
  const [profile, mastery, errors] = await Promise.all([
    db.mentorProfile.findUnique({ where: { id: 1 } }),
    db.mentorSkillMastery.findMany({ orderBy: { mastery: 'asc' }, take: 12 }),
    db.mentorErrorCard.findMany({ where: { dueAt: { lte: new Date() } }, orderBy: { dueAt: 'asc' }, take: 8 }),
  ])
  const focused = mastery.find(m => m.tag === focusTag)
  return { profile, mastery, focused, errors }
}

export async function generateNextNode(branchId: string) {
  await ensureMentorSeed()
  const branch = await db.mentorBranch.findUnique({ where: { id: branchId }, include: { project: true } })
  if (!branch) throw new Error('Branch not found')
  const latest = await db.mentorNode.findFirst({ where: { branchId }, orderBy: { createdAt: 'desc' }, include: { attempts: { include: { feedback: true }, orderBy: { createdAt:'desc' }, take: 1 } } })
  const ctx = await learnerContext(branch.focusTag)
  const rules = await retrieveKnowledge(`English learning rule for ${branch.focusTag}`, branch.focusTag, 3)
  const prompt = `Create the NEXT single focused learning node. Branch focus: ${branch.focusTag}. Mode: ${branch.mode}. Difficulty ceiling: ${branch.difficultyCeiling}.
Learner focus mastery: ${ctx.focused?.mastery ?? 0.5}. Due errors: ${JSON.stringify(ctx.errors.map(e=>({tag:e.tag,errorType:e.errorType,wrong:e.wrong,right:e.right})))}.
Recent node: ${latest ? JSON.stringify({prompt:latest.prompt,attempt:latest.attempts[0]?.answer,feedback:latest.attempts[0]?.feedback?.explanation}) : 'none'}.
Relevant grammar notes: ${rules.map(r=>r.content).join('\n')}
Rules: one question only; do not reveal the answer; target 1-2 skills; aim for ~80-85% success; vary context; interleave up to 30% due-error review.`
  let result: any
  try {
    result = await structured<any>([{ role:'system', content: MENTOR_SYSTEM }, { role:'user', content: prompt }], QuestionSchema, 0.35)
  } catch {
    const fallback = {
      past_tense: ['Yesterday I ___ (go) to the market.', ['went'], ['Think about a completed action.','This verb is irregular.','It starts with w.']],
      articles: ['I bought ___ new laptop yesterday.', ['a new laptop'], ['It is singular and not previously identified.','Choose the indefinite article.']],
      prepositions: ['I am interested ___ software engineering.', ['in'], ['This adjective has a common partner.','It is a two-letter preposition.']],
      collocation: ['Please ___ a decision before Friday.', ['make a decision'], ['Think of the natural verb used with decision.']],
      naturalness: ['Rewrite naturally: “I very like this idea.”', ['I really like this idea.'], ['English usually does not say “very like”.']],
    }[branch.focusTag as keyof typeof fallback] ?? ['Write one natural sentence using the target skill.', [''], ['Start with a short, clear sentence.','Focus only on the branch skill.']]
    result = { action:'question', node:{ kind:'question', prompt:fallback[0], target_tags:[branch.focusTag], difficulty:Math.min(branch.difficultyCeiling, Math.max(1, Math.round((ctx.focused?.mastery ?? .5)*5))), expected_patterns:fallback[1], hints:fallback[2] }, focus:branch.focusTag, reason:'Local fallback question because the model response could not be validated.' }
  }
  const node = await db.mentorNode.create({ data: {
    branchId, kind: result.node.kind, prompt: result.node.prompt,
    expectedPatterns: JSON.stringify(result.node.expected_patterns), hints: JSON.stringify(result.node.hints),
    targetTags: JSON.stringify(result.node.target_tags), difficulty: result.node.difficulty,
  } })
  await db.mentorTurn.create({ data: { branchId, nodeId: node.id, role:'mentor', content:result.node.prompt, meta:JSON.stringify({ action:'question', focus:result.focus }) } })
  return node
}

async function getStatLocal(key:string, fallback=''){ const row=await db.appStat.findUnique({where:{key}}); return row?.value ?? fallback }
async function setStatLocal(key:string, value:string){ await db.appStat.upsert({where:{key},update:{value},create:{key,value}}) }

export async function evaluateAttempt(attemptId: string) {
  const attempt = await db.mentorAttempt.findUnique({ where: { id: attemptId }, include: { node:true, branch:true } })
  if (!attempt) throw new Error('Attempt not found')
  await ensureMentorSeed()
  const patterns = JSON.parse(attempt.node.expectedPatterns || '[]')
  const tags = JSON.parse(attempt.node.targetTags || '[]')
  const rules = await retrieveKnowledge(`${tags.join(', ')} ${attempt.answer}`, tags[0], 3)
  let diagnosis:any
  let feedback:any
  try {
    diagnosis = await structured<any>([{ role:'system', content: MENTOR_SYSTEM }, { role:'user', content:`Diagnose this English attempt. Question: ${attempt.node.prompt}\nExpected patterns: ${JSON.stringify(patterns)}\nLearner answer: ${attempt.answer}\nSelf-correction: ${attempt.selfCorrect || 'none'}\nHint level: ${attempt.hintLevel}\nRelevant rules: ${rules.map(r=>r.content).join('\n')}` }], DiagnosisSchema, 0.15)
    feedback = await structured<any>([{ role:'system', content: MENTOR_SYSTEM }, { role:'user', content:`Evaluate the learner answer and teach ONE main lesson. Question: ${attempt.node.prompt}\nExpected patterns: ${JSON.stringify(patterns)}\nAnswer: ${attempt.answer}\nSelf-correction: ${attempt.selfCorrect || 'none'}\nDiagnosis: ${JSON.stringify(diagnosis)}\nRules: ${rules.map(r=>r.content).join('\n')}\nCreate a side-by-side correction. Keep explanation under 3 sentences.` }], FeedbackSchema, 0.1)
  } catch {
    const expected = patterns[0] || ''
    const correct = expected && attempt.answer.trim().toLowerCase() === String(expected).trim().toLowerCase()
    diagnosis = { error_types: correct ? [] : ['needs_review'], root_cause: correct ? 'Pattern appears understood.' : 'The target pattern was not reproduced accurately.', confidence: 0.65, evidence: [attempt.answer], recommended_action: correct ? 'new_question' : 'drill' }
    feedback = { action:'feedback', scores:{ grammar:correct?1:.5, spelling:correct?1:.8, naturalness:correct?1:.6, register:1, pragmatics:1, task_completion:correct?1:.5 }, corrections:correct?[]:[{wrong:attempt.answer,right:String(expected),type:tags[0]||'target_skill'}], diff:[{text:attempt.answer,status:correct?'ok':'error',fix:correct?undefined:String(expected)}], explanation:correct?'The target pattern is correct. Next, use the same skill in a new context.':`The target answer is “${expected}”. Compare it with your self-correction and notice the pattern.`, native_version:String(correct?attempt.answer:expected), follow_up:`Try another example using ${tags[0]||'this skill'}.`, mastery_delta:{[tags[0]||'general'] : correct ? 0.05 : -0.03} }
  }
  await db.mentorFeedback.create({ data:{ attemptId, scores:JSON.stringify(feedback.scores), corrections:JSON.stringify(feedback.corrections), explanation:feedback.explanation, nativeVersion:feedback.native_version, followUp:feedback.follow_up, diff:JSON.stringify(feedback.diff), masteryDelta:JSON.stringify(feedback.mastery_delta), diagnosis:JSON.stringify(diagnosis), rawJson:JSON.stringify(feedback) } })
  const scoreValues = Object.values(feedback.scores) as number[]
  const score = scoreValues.reduce((a,b)=>a+b,0) / Math.max(1, scoreValues.length)
  const mentorGrade = score >= 0.88 ? 5 : score >= 0.72 ? 4 : score >= 0.5 ? 3 : 0
  const xpGain = mentorGrade === 5 ? 10 : mentorGrade === 4 ? 7 : mentorGrade === 3 ? 4 : 1
  const currentXp = parseInt(await getStatLocal('totalXp', '0'), 10) || 0
  await setStatLocal('totalXp', String(currentXp + xpGain))
  const today = new Date().toISOString().slice(0, 10)
  const lastSession = await getStatLocal('lastSessionDate', '')
  if (lastSession !== today) {
    let streak = parseInt(await getStatLocal('streak', '0'),10) || 0
    if (!lastSession) streak = 1
    else { const diff=Math.round((new Date(today+'T00:00:00').getTime()-new Date(lastSession+'T00:00:00').getTime())/86400000); streak = diff===1 ? streak+1 : 1 }
    await setStatLocal('streak', String(streak)); await setStatLocal('lastSessionDate', today)
  }
  for (const tag of tags.length ? tags : Object.keys(feedback.mastery_delta)) {
    const delta = feedback.mastery_delta[tag] ?? (score >= 0.75 ? 0.05 : -0.03)
    const existing = await db.mentorSkillMastery.findUnique({ where:{tag} })
    const mastery = Math.max(0, Math.min(1, (existing?.mastery ?? 0.5) + delta))
    await db.mentorSkillMastery.upsert({ where:{tag}, update:{ mastery, attempts:{increment:1}, correct:{increment: score >= 0.75 ? 1 : 0}, lastSeen:new Date(), nextReview:new Date(Date.now()+Math.max(1, Math.round((score>=0.75?3:1))*86400000)) }, create:{tag, mastery, attempts:1, correct:score>=0.75?1:0, lastSeen:new Date(), nextReview:new Date(Date.now()+86400000)} })
  }
  for (const c of feedback.corrections.slice(0, 5)) {
    await db.mentorErrorCard.create({ data:{ tag:tags[0] || c.type, errorType:c.type, wrong:c.wrong, right:c.right, context:attempt.node.prompt, dueAt:new Date(Date.now()+86400000) } })
  }
  await db.mentorTurn.create({ data:{ branchId:attempt.branchId, nodeId:attempt.nodeId, role:'learner', content:attempt.answer, meta:JSON.stringify({ attemptId }) } })
  await db.mentorTurn.create({ data:{ branchId:attempt.branchId, nodeId:attempt.nodeId, role:'mentor', content:feedback.explanation, meta:JSON.stringify({ action:'feedback', attemptId }) } })
  return { diagnosis, feedback, score, xpGain, grade: mentorGrade }
}

export async function getMentorOverview() {
  await ensureMentorSeed()
  let project = await db.mentorProject.findFirst({ orderBy:{createdAt:'asc'} })
  if (!project) {
    project = await db.mentorProject.create({ data:{ name:'English Mastery', goal:'Build accurate, natural English through focused practice.' } })
    await db.mentorBranch.create({ data:{ projectId:project.id, title:'Grammar Core', focusTag:'past_tense', mode:'drill', difficultyCeiling:3, locked:true } })
  }
  const branches = await db.mentorBranch.findMany({ where:{projectId:project.id}, orderBy:{createdAt:'asc'} })
  const mastery = await db.mentorSkillMastery.findMany({ orderBy:{mastery:'asc'}, take:20 })
  const dueErrors = await db.mentorErrorCard.findMany({ where:{dueAt:{lte:new Date()}}, orderBy:{dueAt:'asc'}, take:12 })
  const profile = await db.mentorProfile.findUnique({ where:{id:1} })
  return { project, branches, mastery, dueErrors, profile }
}


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
  const { MENTOR_SYSTEM } = await import('@/lib/ollama')
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
  const { MENTOR_SYSTEM } = await import('@/lib/ollama')
  let feedback:any
  try { feedback = await structured<any>([{role:'system',content:MENTOR_SYSTEM},{role:'user',content:`Evaluate pronunciation practice using only this speech-to-text evidence. Target: ${target}\nHeard: ${transcript}\nMissing words: ${JSON.stringify(missing)}\nExtra words: ${JSON.stringify(extra)}\nGive actionable pronunciation feedback without pretending you heard phonemes.`}], PronunciationSchema, 0.2) }
  catch { feedback = { verdict: accuracy>=.9?'Clear':accuracy>=.7?'Mostly clear':'Needs another attempt', feedback: accuracy>=.9?'The transcript closely matches the target. Focus on rhythm and natural stress.':`Try again and aim to say the whole phrase clearly. ${missing.length ? `You may be dropping: ${missing.slice(0,3).join(', ')}.`:''}`, focus: missing[0] || 'stress and rhythm' } }
  const saved = await db.pronunciationAttempt.create({data:{target,transcript,accuracy,missingWords:JSON.stringify(missing),extraWords:JSON.stringify(extra),feedback:JSON.stringify(feedback)}})
  return { id:saved.id, accuracy, missingWords:missing, extraWords:extra, ...feedback }
}

export async function evaluateNaturalness(input: string) {
  const { MENTOR_SYSTEM } = await import('@/lib/ollama')
  let result:any
  try { result = await structured<any>([{role:'system',content:MENTOR_SYSTEM},{role:'user',content:`Judge how natural this English sentence sounds to a proficient native speaker. Preserve the intended meaning. Score naturalness 0-1. Provide one native version, 2 alternatives, a short explanation, and a verdict. Sentence: ${input}`}], NaturalnessSchema, 0.15) }
  catch { result = { score:0.7, verdict:'Understandable but can sound more natural', native:input, alternatives:[input], explanation:'Try using the common collocation and word order native speakers usually choose.' } }
  const saved = await db.naturalnessAttempt.create({data:{input,score:result.score,verdict:result.verdict,native:result.native,alternatives:JSON.stringify(result.alternatives||[]),explanation:result.explanation}})
  return { id:saved.id, ...result }
}
