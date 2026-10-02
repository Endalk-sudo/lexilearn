'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HelpCircle, Sparkles, Star, Volume2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import { playSound } from '@/lib/feel'
import type { WordDTO } from '@/lib/api'
import { CategoryBadgeList } from '@/features/library/components/category-badge'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { revealBlock, transition, useMotionSafe } from '@/lib/motion'



function subscribeBookmarks(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('lexilearn-bookmarks-changed', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('lexilearn-bookmarks-changed', callback)
    window.removeEventListener('storage', callback)
  }
}

function isWordBookmarked(word: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('lexilearn-bookmarked-words')
    if (!raw) return false
    const list: string[] = JSON.parse(raw)
    return Array.isArray(list) && list.includes(word.toLowerCase())
  } catch {
    return false
  }
}

function setWordBookmarked(word: string, bookmarked: boolean) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem('lexilearn-bookmarked-words')
    let list: string[] = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) list = []
    const lower = word.toLowerCase()
    if (bookmarked && !list.includes(lower)) {
      list.push(lower)
    } else if (!bookmarked) {
      list = list.filter((w) => w !== lower)
    }
    localStorage.setItem('lexilearn-bookmarked-words', JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('lexilearn-bookmarks-changed'))
  } catch {}
}

const CEFR_STYLES: Record<string, string> = {
  A1: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  A2: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  B1: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  B2: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  C1: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
  C2: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
}

/**
 * WordCard: Scannable Micro-Layout implementation
 * Strict edge alignment, container dissolution, quiet default contrast, zero text bloat.
 */
export function WordCard({
  word,
  ttsVoice,
  ttsRate,
  showDefinition = true,
  hideWord = false,
  autoSpeak: propAutoSpeak,
  onReveal,
}: {
  word: WordDTO
  ttsVoice?: string
  ttsRate?: number
  showDefinition?: boolean
  hideWord?: boolean
  autoSpeak?: boolean
  onReveal?: () => void
}) {
  const storeAutoSpeak = useAppStore((s) => s.autoSpeak)
  const autoSpeak = propAutoSpeak ?? storeAutoSpeak
  const [hint, setHint] = useState(false)
  const [localRevealedWordId, setLocalRevealedWordId] = useState<string | null>(null)
  const revealed = showDefinition || localRevealedWordId === word.id
  const [speaking, setSpeaking] = useState(false)
  const getSnapshot = useCallback(() => isWordBookmarked(word.word), [word.word])
  const bookmarked = useSyncExternalStore(subscribeBookmarks, getSnapshot, () => false)
  const { v, t } = useMotionSafe()
  const lastSpokenIdRef = useRef<string | null>(null)

  // Auto-pronounce word when WordCard opens/updates if autoSpeak is active
  useEffect(() => {
    if (!autoSpeak || hideWord) return
    if (lastSpokenIdRef.current === word.id) return
    lastSpokenIdRef.current = word.id
    const id = window.setTimeout(() => {
      setSpeaking(true)
      setTimeout(() => setSpeaking(false), 1400)
      speak(word.word, { voice: ttsVoice, rate: ttsRate })
    }, 200)
    return () => window.clearTimeout(id)
  }, [autoSpeak, hideWord, word.id, word.word, ttsVoice, ttsRate])

  const hear = () => {
    playSound('tap')
    setSpeaking(true)
    setTimeout(() => setSpeaking(false), 1400)
    if (!speak(word.word, { voice: ttsVoice, rate: ttsRate })) {
      toast.error('Pronunciation is unavailable in this browser.')
    }
  }

  const toggleBookmark = () => {
    playSound('tap')
    const next = !bookmarked
    setWordBookmarked(word.word, next)
    toast.success(next ? `Saved "${word.word}" to favorites` : `Removed "${word.word}" from favorites`)
  }

  const cefrStyle = word.cefr ? CEFR_STYLES[word.cefr] ?? 'border-border bg-muted/40 text-muted-foreground' : null

  return (
    <Card className="overflow-hidden border border-border/80 bg-card/95 shadow-xs">
      <div className="p-5 sm:p-7">
        {!hideWord ? (
          <>
            {/* Word head + metadata (left) | larger touch targets (right) */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <h2 className="study-head break-words text-foreground">
                    {word.word}
                  </h2>
                  {word.cefr ? (
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 font-mono text-xs font-bold tracking-wider uppercase border',
                        cefrStyle
                      )}
                    >
                      {word.cefr}
                    </span>
                  ) : null}
                  {word.categories && word.categories.length > 0 ? (
                    <CategoryBadgeList categories={word.categories} max={3} />
                  ) : null}
                </div>

                {/* One readable meta line: part of speech · phonetics · syllables */}
                <div className="study-meta mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground">
                  {word.pos ? (
                    <span className="font-semibold lowercase italic tracking-wide">
                      {word.pos}
                    </span>
                  ) : null}
                  {word.ipa ? <span className="font-mono">{word.ipa}</span> : null}
                  {word.syllables && word.syllables.length > 1 ? (
                    <span className="font-mono tracking-widest text-muted-foreground/70" title="Syllable structure">
                      {word.syllables.join(' · ')}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-start">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setHint((v) => !v)}
                  className={cn(
                    'h-10 w-10 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer',
                    hint && 'text-amber-500 bg-amber-500/10'
                  )}
                  title={hint ? 'Hide hint' : 'Show structural hint'}
                  aria-label="Toggle word hint"
                  aria-expanded={hint}
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleBookmark}
                  className={cn(
                    'h-10 w-10 text-muted-foreground/70 hover:text-amber-500 transition-colors cursor-pointer',
                    bookmarked && 'text-amber-500'
                  )}
                  title={bookmarked ? 'Remove from favorites' : 'Save to favorites'}
                  aria-label={bookmarked ? 'Unstar word' : 'Star word'}
                >
                  <Star className={cn('h-5 w-5', bookmarked && 'fill-current scale-105')} />
                </Button>

                <Button
                  size="icon"
                  variant={speaking ? 'soft' : 'outline'}
                  onClick={hear}
                  className={cn(
                    'h-10 w-10 transition-all cursor-pointer',
                    speaking && 'text-primary border-primary bg-primary/10'
                  )}
                  aria-label={`Pronounce ${word.word}`}
                >
                  <Volume2 className={cn('h-5 w-5', speaking && 'scale-110')} />
                </Button>
              </div>
            </div>

            {/* Structural hint drawer */}
            <AnimatePresence initial={false}>
              {hint ? (
                <motion.div
                  variants={v(revealBlock)}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  transition={t()}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
                      Starts with <strong className="font-semibold text-foreground uppercase">{word.word[0]}</strong>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground/80">
                      {word.word.length} letters
                    </span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-sm font-medium tracking-wide uppercase text-muted-foreground">Audio Prompt</span>
            <Button size="sm" variant="outline" onClick={hear} className="h-9 text-sm px-3.5 cursor-pointer">
              <Volume2 className="h-4 w-4 mr-1.5" />
              Listen
            </Button>
          </div>
        )}

        {/* Revealed Content: everything stacked — meaning, examples, Amharic,
            then synonyms / antonyms / origin. No tabs: on a desktop you read
            with your eyes, and the global study scale keeps it legible. */}
        <AnimatePresence mode="wait" initial={false}>
          {revealed ? (
            <motion.div
              key="answer"
              variants={v(revealBlock)}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={t(transition.base)}
              className="overflow-hidden"
            >
              <div className="mt-5 space-y-[var(--study-gap)] border-t border-border/60 pt-5">
                {word.definitions.length ? (
                  <section aria-label="Meaning">
                    <h3 className="label text-muted-foreground">Meaning</h3>
                    <ol className="mt-2.5 space-y-2">
                      {word.definitions.map((definition, i) => (
                        <li key={i} className="grid grid-cols-[2.5rem_1fr] items-start study-body">
                          <span className="font-mono text-base font-semibold tabular-nums text-muted-foreground/60 select-none pt-0.5">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div className="text-foreground/90">
                            {definition.pos ? (
                              <span className="mr-2 text-[0.85em] italic text-muted-foreground">[{definition.pos}]</span>
                            ) : null}
                            {definition.text}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {word.examples.length ? (
                  <section aria-label="Examples" className="border-l-2 border-primary-line bg-primary-soft/40 rounded-r-xl px-5 py-4">
                    <h3 className="label text-muted-foreground">In context</h3>
                    <div className="mt-2 space-y-2.5">
                      {word.examples.slice(0, 3).map((example, i) => (
                        <p key={i} className="study-example italic text-foreground/85">
                          “{example}”
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}

                {word.amharic ? (
                  <section aria-label="Amharic translation">
                    <h3 className="label text-muted-foreground">አማርኛ</h3>
                    <p className="study-amharic mt-2 text-foreground font-medium" lang="am">
                      {word.amharic}
                    </p>
                  </section>
                ) : null}

                {word.synonyms.length > 0 || word.antonyms.length > 0 || word.etymology ? (
                  <section aria-label="Word relations" className="space-y-3 border-t border-border/50 pt-4">
                    {word.synonyms.length > 0 ? (
                      <div className="grid grid-cols-[92px_1fr] items-baseline gap-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Synonyms
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {word.synonyms.map((s) => (
                            <span
                              key={s}
                              className="rounded-md bg-muted/60 px-2 py-1 text-sm text-foreground/90 font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {word.antonyms.length > 0 ? (
                      <div className="grid grid-cols-[92px_1fr] items-baseline gap-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Antonyms
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {word.antonyms.map((a) => (
                            <span
                              key={a}
                              className="rounded-md border border-border/60 px-2 py-1 text-sm text-muted-foreground font-mono"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {word.etymology ? (
                      <div className="grid grid-cols-[92px_1fr] items-baseline gap-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          Origin
                        </span>
                        <p className="study-body text-muted-foreground">{word.etymology}</p>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {!showDefinition ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setLocalRevealedWordId(null)}
                    >
                      Hide answer
                    </Button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hidden"
              variants={v(fadeInish)}
              initial="hidden"
              animate="show"
              className="overflow-hidden"
            >
              <Button
                variant="outline"
                onClick={() => {
                  setLocalRevealedWordId(word.id)
                  onReveal?.()
                }}
                data-testid="wordcard-reveal"
                className="mt-5 h-12 w-full text-sm font-semibold cursor-pointer border-border hover:bg-muted/40 transition-colors"
              >
                Reveal meaning
                <span className="ml-auto hidden font-mono text-xs text-muted-foreground sm:inline">SPACE</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}

const fadeInish = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.fast },
}
