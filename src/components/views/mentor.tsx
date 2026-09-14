'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  PenLine,
  MessageCircle,
  BookOpen,
  HelpCircle,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

type MentorMode = 'practice' | 'writing' | 'conversation' | 'explain' | 'reading'

type OllamaStatus = {
  available: boolean
  models: string[]
  error?: string
}

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const PRACTICE_TYPES = [
  { value: 'cloze', label: 'Cloze / Fill-in-blank' },
  { value: 'rewrite', label: 'Rewrite naturally' },
  { value: 'error_correction', label: 'Error correction' },
  { value: 'use_in_paragraph', label: 'Use in a paragraph' },
  { value: 'discussion', label: 'Discussion questions' },
] as const

const SCENARIOS = [
  'Casual coffee chat with a friend',
  'Job interview for a tech role',
  'University seminar discussion',
  'Explaining a problem to a colleague',
  'Travel and asking for directions',
  'Debating a current topic politely',
]

export function MentorView() {
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<MentorMode>('practice')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [streaming, setStreaming] = useState(false)

  // Practice
  const [practiceType, setPracticeType] = useState<string>('cloze')
  const [wordInput, setWordInput] = useState('')

  // Writing
  const [writingText, setWritingText] = useState('')

  // Conversation
  const [scenario, setScenario] = useState(SCENARIOS[0])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userMsg, setUserMsg] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Explain
  const [explainQuery, setExplainQuery] = useState('')

  const checkStatus = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/lexilearn?action=ollamaStatus')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ available: false, models: [], error: 'Could not reach API' })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function callMentor(body: Record<string, any>) {
    setLoading(true)
    setResponse('')
    setStreaming(true)
    try {
      const res = await fetch('/api/lexilearn?action=mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setResponse(data.response || '')
      return data.response as string
    } catch (e: any) {
      toast.error(e.message || 'Mentor request failed')
      setResponse('')
      return null
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  async function handlePractice() {
    const words = wordInput
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 12)
    if (words.length === 0) {
      toast.error('Enter at least one word')
      return
    }
    await callMentor({
      mode: 'practice',
      practiceType,
      words: words.map((w) => ({ word: w })),
    })
  }

  async function handleWriting() {
    if (!writingText.trim() || writingText.trim().length < 20) {
      toast.error('Write at least a short paragraph')
      return
    }
    await callMentor({
      mode: 'writing',
      text: writingText.trim(),
    })
  }

  async function handleExplain() {
    if (!explainQuery.trim()) {
      toast.error('Ask a question')
      return
    }
    await callMentor({
      mode: 'explain',
      query: explainQuery.trim(),
    })
  }

  async function startConversation() {
    setMessages([])
    setResponse('')
    const res = await callMentor({
      mode: 'conversation',
      scenario,
      messages: [],
      start: true,
    })
    if (res) {
      setMessages([{ role: 'assistant', content: res }])
    }
  }

  async function sendConversationMessage() {
    if (!userMsg.trim()) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: userMsg.trim() }]
    setMessages(next)
    setUserMsg('')
    setLoading(true)
    try {
      const res = await fetch('/api/lexilearn?action=mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'conversation',
          scenario,
          messages: next,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (e: any) {
      toast.error(e.message || 'Failed to get reply')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking local AI status…</p>
      </div>
    )
  }

  if (!status?.available) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Mentor</h1>
          <p className="text-muted-foreground">
            Local Ollama is not running or unreachable.
          </p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              How to enable the Mentor
            </CardTitle>
            <CardDescription>
              The rest of LexiLearn works fully offline without AI. Mentor is optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Install <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-primary underline">Ollama</a> on this machine.</li>
              <li>Pull a model: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">ollama pull llama3.1</code> (or qwen2.5, gemma2, etc.)</li>
              <li>Make sure Ollama is running (usually automatic).</li>
              <li>Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">OLLAMA_MODEL</code> in <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env</code> if you use a different model.</li>
            </ol>
            <div className="pt-2">
              <Button onClick={checkStatus} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Check again
              </Button>
            </div>
            {status?.error && (
              <p className="text-xs text-destructive mt-2">Last error: {status.error}</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Mentor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Local Ollama · {status.models[0] || 'ready'} · Private & offline-capable
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Connected
        </Badge>
      </motion.div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as MentorMode)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1">
          <TabsTrigger value="practice" className="gap-1.5 py-2">
            <Wand2 className="h-3.5 w-3.5" />
            Practice
          </TabsTrigger>
          <TabsTrigger value="writing" className="gap-1.5 py-2">
            <PenLine className="h-3.5 w-3.5" />
            Writing
          </TabsTrigger>
          <TabsTrigger value="conversation" className="gap-1.5 py-2">
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="explain" className="gap-1.5 py-2">
            <HelpCircle className="h-3.5 w-3.5" />
            Explain
          </TabsTrigger>
        </TabsList>

        {/* PRACTICE */}
        <TabsContent value="practice" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generate practice material</CardTitle>
              <CardDescription>
                Enter target words (comma or newline separated). The mentor will create exercises that force real use.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Exercise type</label>
                  <Select value={practiceType} onValueChange={setPracticeType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                placeholder="analyze, comprehensive, significant,&#10;hypothesis, correlate…"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                rows={4}
                className="resize-none font-mono text-sm"
              />
              <Button onClick={handlePractice} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate practice
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WRITING */}
        <TabsContent value="writing" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Writing Coach</CardTitle>
              <CardDescription>
                Write a paragraph or short text. The mentor will correct, explain, and suggest better phrasing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Write your paragraph here…"
                value={writingText}
                onChange={(e) => setWritingText(e.target.value)}
                rows={8}
                className="resize-y text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{writingText.trim().split(/\s+/).filter(Boolean).length} words</span>
                <Button onClick={handleWriting} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Get feedback
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONVERSATION */}
        <TabsContent value="conversation" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversation practice</CardTitle>
              <CardDescription>Role-play with a patient English mentor. Corrections come gently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENARIOS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={startConversation} disabled={loading} variant="secondary" className="gap-2 shrink-0">
                  {loading && messages.length === 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Start
                </Button>
              </div>

              {messages.length > 0 && (
                <div className="border rounded-xl bg-muted/30 overflow-hidden">
                  <ScrollArea className="h-[340px] p-4">
                    <div className="space-y-3">
                      {messages.map((m, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'flex',
                            m.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                              m.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-card border rounded-bl-md'
                            )}
                          >
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        </motion.div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="border-t p-3 flex gap-2">
                    <Textarea
                      placeholder="Your reply…"
                      value={userMsg}
                      onChange={(e) => setUserMsg(e.target.value)}
                      rows={1}
                      className="min-h-[40px] resize-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendConversationMessage()
                        }
                      }}
                    />
                    <Button size="icon" onClick={sendConversationMessage} disabled={loading || !userMsg.trim()}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPLAIN */}
        <TabsContent value="explain" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Deep Explainer</CardTitle>
              <CardDescription>
                Ask about differences, usage, grammar points, or “why is this wrong?”
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='e.g. “What’s the difference between ‘affect’ and ‘effect’?” or “Why can’t I say ‘make a photo’?”'
                value={explainQuery}
                onChange={(e) => setExplainQuery(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <Button onClick={handleExplain} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />}
                Explain
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared response area (except live conversation) */}
      <AnimatePresence>
        {response && mode !== 'conversation' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="pb-2 bg-primary/5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Mentor response
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{response}</ReactMarkdown>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
