'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Languages, Lightbulb, Volume2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { speak } from '@/lib/tts'
import { toast } from 'sonner'
import { playSound } from '@/lib/feel'
import type { WordDTO } from '@/lib/api'
import { cn } from '@/lib/utils'
import { revealBlock, transition, useMotionSafe } from '@/lib/motion'

type Tab = 'meaning' | 'example' | 'amharic'

/**
 * The word detail card used by Learn, the palette and the dictionary.
 * Progressive disclosure: meaning first, everything else on demand.
 */
export function WordCardV2({
  word,
  ttsVoice,
  ttsRate,
  showDefinition = true,
  hideWord = false,
}: {
  word: WordDTO
  ttsVoice?: string
  ttsRate?: number
  showDefinition?: boolean
  hideWord?: boolean
}) {
  const [tab, setTab] = useState<Tab>('meaning')
  const [details, setDetails] = useState(false)
  const [hint, setHint] = useState(false)
  const [revealed, setRevealed] = useState(showDefinition)
  const { v, t } = useMotionSafe()

  const hear = () => {
    playSound('tap')
    if (!speak(word.word, { voice: ttsVoice, rate: ttsRate })) {
      toast.error('Pronunciation is unavailable in this browser.')
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'meaning', label: 'Meaning' },
    { id: 'example', label: 'Example' },
    { id: 'amharic', label: 'አማር' },
  ]

  return (
    <Card className="overflow-hidden">
      <div className="p-5 sm:p-6">
        {!hideWord ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{word.word}</h2>
                  {word.pos ? <span className="text-sm italic text-muted-foreground">{word.pos}</span> : null}
                </div>
                {word.ipa ? <p className="mt-1.5 font-mono text-sm text-muted-foreground">{word.ipa}</p> : null}
              </div>
              <Button size="icon-lg" variant="outline" onClick={hear} aria-label={`Hear ${word.word}`}>
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {word.cefr ? (
                <Badge variant="outline" className="font-mono">
                  {word.cefr}
                </Badge>
              ) : null}
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setHint((value) => !value)} aria-expanded={hint}>
                <Lightbulb className="h-3.5 w-3.5 text-warning" />
                {hint ? 'Hide hint' : 'Need a hint?'}
              </Button>
            </div>

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
                  <div className="mt-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Starts with <b className="font-semibold text-foreground">{word.word[0]?.toUpperCase()}</b> ·{' '}
                    {word.word.length} letters
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="label text-muted-foreground">Listen carefully</span>
            <Button size="sm" variant="outline" onClick={hear}>
              <Volume2 className="h-3.5 w-3.5" />
              Play
            </Button>
          </div>
        )}

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
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex gap-1 rounded-md border border-border bg-muted/40 p-1" role="tablist" aria-label="Word details">
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === item.id}
                      onClick={() => setTab(item.id)}
                      className={cn(
                        'h-8 flex-1 rounded font-medium transition-colors duration-150',
                        tab === item.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 min-h-16">
                  {tab === 'meaning' ? (
                    word.definitions.length ? (
                      <ul className="space-y-1.5">
                        {word.definitions.map((definition, i) => (
                          <li key={i} className="text-[15px] leading-relaxed">
                            {definition.pos ? (
                              <span className="mr-1.5 italic text-muted-foreground">{definition.pos}</span>
                            ) : null}
                            {definition.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No definition yet.</p>
                    )
                  ) : null}

                  {tab === 'example' ? (
                    word.examples.length ? (
                      <div className="space-y-2">
                        {word.examples.slice(0, 2).map((example, i) => (
                          <blockquote
                            key={i}
                            className="border-l-2 border-primary-line bg-primary-soft px-3.5 py-2.5 text-sm italic leading-relaxed"
                          >
                            “{example}”
                          </blockquote>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No example yet.</p>
                    )
                  ) : null}

                  {tab === 'amharic' ? (
                    word.amharic ? (
                      <p className="rounded-md bg-muted/50 p-3.5 text-[15px]">{word.amharic}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No Amharic translation yet.</p>
                    )
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setDetails((value) => !value)}
                  aria-expanded={details}
                  className="mt-3 flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                    More details
                  </span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', details && 'rotate-180')} aria-hidden="true" />
                </button>

                <AnimatePresence initial={false}>
                  {details ? (
                    <motion.div
                      variants={v(revealBlock)}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      transition={t()}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-3">
                        {word.syllables?.length > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            Syllables:{' '}
                            <span className="font-medium text-foreground">{word.syllables.join(' · ')}</span>
                          </div>
                        ) : null}
                        {word.synonyms.length > 0 ? (
                          <div>
                            <div className="label text-muted-foreground">Synonyms</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {word.synonyms.map((synonym) => (
                                <Badge key={synonym} variant="secondary" className="font-normal">
                                  {synonym}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {word.antonyms.length > 0 ? (
                          <div>
                            <div className="label text-muted-foreground">Antonyms</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {word.antonyms.map((antonym) => (
                                <Badge key={antonym} variant="outline" className="font-normal">
                                  {antonym}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {word.etymology ? (
                          <div>
                            <div className="label text-muted-foreground">Origin</div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{word.etymology}</p>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {!showDefinition ? (
                  <Button size="sm" variant="ghost" className="mt-3" onClick={() => setRevealed(false)}>
                    Hide answer
                  </Button>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div key="hidden" variants={v(fadeInish)} initial="hidden" animate="show" className="overflow-hidden">
              <Button variant="outline" onClick={() => setRevealed(true)} data-testid="wordcard-reveal" className="mt-5 h-12 w-full text-sm font-medium">
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
