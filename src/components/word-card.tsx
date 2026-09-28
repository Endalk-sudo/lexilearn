'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, HelpCircle, Sparkles, Star, Volume2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import { playSound } from '@/lib/feel'
import type { WordDTO } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { revealBlock, transition, useMotionSafe } from '@/lib/motion'

type Tab = 'meaning' | 'example' | 'amharic'

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
}: {
  word: WordDTO
  ttsVoice?: string
  ttsRate?: number
  showDefinition?: boolean
  hideWord?: boolean
  autoSpeak?: boolean
}) {
  const storeAutoSpeak = useAppStore((s) => s.autoSpeak)
  const autoSpeak = propAutoSpeak ?? storeAutoSpeak
  const [tab, setTab] = useState<Tab>('meaning')
  const [details, setDetails] = useState(false)
  const [hint, setHint] = useState(false)
  const [revealed, setRevealed] = useState(showDefinition)
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'meaning', label: 'Definition' },
    { id: 'example', label: 'In Context' },
    { id: 'amharic', label: 'አማርኛ' },
  ]

  const cefrStyle = word.cefr ? CEFR_STYLES[word.cefr] ?? 'border-border bg-muted/40 text-muted-foreground' : null

  return (
    <Card className="overflow-hidden border border-border/80 bg-card/95 shadow-xs">
      <div className="p-4 sm:p-5">
        {!hideWord ? (
          <>
            {/* Primary Multi-Edge Row: Word + Metadata (Left) | Action Cluster (Right) */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Structural Line 1: Word Name + Tags */}
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h2 className="break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {word.word}
                  </h2>
                  {word.pos ? (
                    <span className="text-xs font-semibold lowercase tracking-wide text-muted-foreground/80">
                      /{word.pos}/
                    </span>
                  ) : null}
                  {word.cefr ? (
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.2 font-mono text-[10px] font-bold tracking-wider uppercase border',
                        cefrStyle
                      )}
                    >
                      {word.cefr}
                    </span>
                  ) : null}
                </div>

                {/* Structural Line 2: Phonetics & Syllable Edge */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground font-mono">
                  {word.ipa ? <span>{word.ipa}</span> : null}
                  {word.ipa && word.syllables && word.syllables.length > 1 ? (
                    <span className="text-border" aria-hidden="true">•</span>
                  ) : null}
                  {word.syllables && word.syllables.length > 1 ? (
                    <span className="tracking-widest text-muted-foreground/70" title="Syllable structure">
                      {word.syllables.join(' · ')}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Edge-Anchored Action Cluster */}
              <div className="flex items-center gap-1 shrink-0 self-start">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setHint((v) => !v)}
                  className={cn(
                    'h-8 w-8 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer',
                    hint && 'text-amber-500 bg-amber-500/10'
                  )}
                  title={hint ? 'Hide hint' : 'Show structural hint'}
                  aria-label="Toggle word hint"
                  aria-expanded={hint}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleBookmark}
                  className={cn(
                    'h-8 w-8 text-muted-foreground/70 hover:text-amber-500 transition-colors cursor-pointer',
                    bookmarked && 'text-amber-500'
                  )}
                  title={bookmarked ? 'Remove from favorites' : 'Save to favorites'}
                  aria-label={bookmarked ? 'Unstar word' : 'Star word'}
                >
                  <Star className={cn('h-4 w-4', bookmarked && 'fill-current scale-105')} />
                </Button>

                <Button
                  size="icon"
                  variant={speaking ? 'soft' : 'outline'}
                  onClick={hear}
                  className={cn(
                    'h-8 w-8 transition-all cursor-pointer',
                    speaking && 'text-primary border-primary bg-primary/10'
                  )}
                  aria-label={`Pronounce ${word.word}`}
                >
                  <Volume2 className={cn('h-4 w-4', speaking && 'scale-110')} />
                </Button>
              </div>
            </div>

            {/* Micro-Hint Inline Drawer (Dissolved Container) */}
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
                  <div className="mt-2.5 flex items-center justify-between rounded border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-amber-500 shrink-0" aria-hidden="true" />
                      Starts with <strong className="font-semibold text-foreground uppercase">{word.word[0]}</strong>
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80">
                      {word.word.length} letters
                    </span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Audio Prompt</span>
            <Button size="sm" variant="outline" onClick={hear} className="h-7 text-xs px-2.5 cursor-pointer">
              <Volume2 className="h-3.5 w-3.5 mr-1" />
              Listen
            </Button>
          </div>
        )}

        {/* Revealed Content: Dissolved Tab Layout */}
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
              <div className="mt-4 pt-2">
                {/* Hairline Edge-Anchored Tab Bar (Zero Card Chrome) */}
                <div
                  className="flex items-center gap-5 border-b border-border/60"
                  role="tablist"
                  aria-label="Word views"
                >
                  {tabs.map((item) => {
                    const active = tab === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTab(item.id)}
                        className={cn(
                          'relative pb-2 text-xs transition-colors duration-150 cursor-pointer',
                          active
                            ? 'font-semibold text-foreground border-b-2 border-primary -mb-px'
                            : 'font-medium text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {item.label}
                      </button>
                    )
                  })}

                  {/* Micro-Disclosure Toggle Aligned to Right Edge */}
                  <button
                    type="button"
                    onClick={() => setDetails((prev) => !prev)}
                    aria-expanded={details}
                    className="ml-auto pb-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>More</span>
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 transition-transform duration-200', details && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {/* Tab Panels */}
                <div className="py-3">
                  {tab === 'meaning' ? (
                    word.definitions.length ? (
                      <ol className="space-y-1.5">
                        {word.definitions.map((definition, i) => (
                          <li key={i} className="grid grid-cols-[1.5rem_1fr] items-start text-sm leading-snug">
                            <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground/60 select-none">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div className="text-foreground/90">
                              {definition.pos ? (
                                <span className="mr-1.5 text-xs italic text-muted-foreground">[{definition.pos}]</span>
                              ) : null}
                              {definition.text}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic">—</div>
                    )
                  ) : null}

                  {tab === 'example' ? (
                    word.examples.length ? (
                      <div className="space-y-2 border-l border-border/80 pl-3">
                        {word.examples.slice(0, 2).map((example, i) => (
                          <p key={i} className="text-sm italic text-foreground/80 leading-relaxed">
                            “{example}”
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic">—</div>
                    )
                  ) : null}

                  {tab === 'amharic' ? (
                    word.amharic ? (
                      <p className="text-base text-foreground font-medium py-1" lang="am">
                        {word.amharic}
                      </p>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic">—</div>
                    )
                  ) : null}
                </div>

                {/* Secondary Micro-Details Drawer (Zero Outer Card Wrapper) */}
                <AnimatePresence initial={false}>
                  {details ? (
                    <motion.div
                      variants={v(revealBlock)}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      transition={t()}
                      className="overflow-hidden border-t border-border/50 pt-2.5 mt-1"
                    >
                      <div className="space-y-2 text-xs">
                        {word.synonyms.length > 0 ? (
                          <div className="grid grid-cols-[68px_1fr] items-baseline gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Synonyms
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {word.synonyms.map((s) => (
                                <span
                                  key={s}
                                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-foreground/90 font-mono"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {word.antonyms.length > 0 ? (
                          <div className="grid grid-cols-[68px_1fr] items-baseline gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Antonyms
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {word.antonyms.map((a) => (
                                <span
                                  key={a}
                                  className="rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground font-mono"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {word.etymology ? (
                          <div className="grid grid-cols-[68px_1fr] items-baseline gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Origin
                            </span>
                            <p className="text-muted-foreground leading-relaxed">{word.etymology}</p>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {!showDefinition ? (
                  <div className="mt-2 pt-2 border-t border-border/40 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setRevealed(false)}
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
                onClick={() => setRevealed(true)}
                data-testid="wordcard-reveal"
                className="mt-4 h-10 w-full text-xs font-semibold cursor-pointer border-border hover:bg-muted/40 transition-colors"
              >
                Reveal meaning
                <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:inline">SPACE</span>
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
