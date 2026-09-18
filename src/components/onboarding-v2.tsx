'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, Gamepad2, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { speak } from '@/lib/tts'
import { playSound } from '@/lib/feel'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { fadeUp, stagger, listItem, useMotionSafe } from '@/lib/motion'

const KEY = 'lexilearn-onboarding-v2'

const STEPS = [
  {
    icon: BookOpen,
    tone: 'bg-primary-soft text-primary',
    title: 'Learn in five minutes a day',
    desc: 'Recall, listen, spell. Short loops your brain actually keeps.',
  },
  {
    icon: BrainCircuit,
    tone: 'bg-success-soft text-success',
    title: 'Review at the right moment',
    desc: 'Spaced repetition schedules each word just before you would forget it.',
  },
  {
    icon: Gamepad2,
    tone: 'bg-streak-soft text-streak',
    title: 'Play to lock it in',
    desc: 'Quizzes, streaks and XP keep the habit alive without the guilt.',
  },
]

const GOALS = [
  { value: 5, label: 'Light', hint: 'About 2 min' },
  { value: 10, label: 'Steady', hint: 'About 5 min' },
  { value: 20, label: 'Intense', hint: 'About 10 min' },
]

export function OnboardingV2() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(10)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const { v, t } = useMotionSafe()

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY) && !localStorage.getItem('lexilearn-onboarding-dismissed')) {
        const id = window.setTimeout(() => setOpen(true), 600)
        return () => window.clearTimeout(id)
      }
    } catch {
      /* storage unavailable */
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => primaryRef.current?.focus(), 120)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void finish()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function finish() {
    try {
      localStorage.setItem(KEY, '1')
      localStorage.setItem('lexilearn-onboarding-dismissed', 'true')
    } catch {
      /* storage unavailable */
    }
    try {
      await api.updateSettings({ dailyGoal: goal })
    } catch {
      /* offline - the goal can be set later in Settings */
    }
    playSound('levelup')
    setOpen(false)
  }

  if (!open) return null

  const total = STEPS.length + 1
  const pct = ((step + 1) / total) * 100

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to LexiLearn"
    >
      <motion.div
        variants={v(fadeUp)}
        initial="hidden"
        animate="show"
        transition={t()}
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${pct}%` }}
            transition={t({ duration: 0.3, ease: [0.16, 1, 0.3, 1] })}
          />
        </div>

        <div className="p-6 sm:p-7">
          <AnimatePresence mode="wait" initial={false}>
            {step < STEPS.length ? (
              <motion.div
                key={step}
                variants={v(stagger(0.05))}
                initial="hidden"
                animate="show"
                exit="exit"
                className="text-center"
              >
                {(() => {
                  const Icon = STEPS[step].icon
                  return (
                    <motion.div
                      variants={v(listItem)}
                      transition={t()}
                      className={cn(
                        'mx-auto flex h-14 w-14 items-center justify-center rounded-full',
                        STEPS[step].tone
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-6 w-6" />
                    </motion.div>
                  )
                })()}
                <motion.h2 variants={v(listItem)} transition={t()} className="mt-4 text-lg font-semibold tracking-tight">
                  {STEPS[step].title}
                </motion.h2>
                <motion.p
                  variants={v(listItem)}
                  transition={t()}
                  className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground"
                >
                  {STEPS[step].desc}
                </motion.p>
                <motion.div variants={v(listItem)} transition={t()} className="mt-6 flex gap-2">
                  {step > 0 ? (
                    <Button
                      variant="outline"
                      size="lg"
                      aria-label="Previous step"
                      onClick={() => {
                        playSound('tap')
                        setStep((s) => s - 1)
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    ref={primaryRef}
                    size="lg"
                    className="flex-1"
                    onClick={() => {
                      playSound('tap')
                      setStep((s) => s + 1)
                    }}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
                <motion.button
                  variants={v(listItem)}
                  type="button"
                  onClick={() => void finish()}
                  className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Skip the tour
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="goal"
                variants={v(stagger(0.05))}
                initial="hidden"
                animate="show"
                exit="exit"
                className="text-center"
              >
                <motion.div variants={v(listItem)} transition={t()} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
                  <BookOpen className="h-6 w-6" />
                </motion.div>
                <motion.h2 variants={v(listItem)} transition={t()} className="mt-4 text-lg font-semibold tracking-tight">
                  How many words a day?
                </motion.h2>
                <motion.p variants={v(listItem)} transition={t()} className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Small and daily beats big and rare. You can change this any time in Settings.
                </motion.p>
                <motion.div variants={v(listItem)} transition={t()} className="mt-5 grid grid-cols-3 gap-2">
                  {GOALS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={goal === option.value}
                      onClick={() => {
                        setGoal(option.value)
                        playSound('tap')
                      }}
                      className={cn(
                        'min-h-11 rounded-lg border p-3 transition-colors duration-150',
                        goal === option.value
                          ? 'border-primary-line bg-primary-soft text-primary'
                          : 'border-border bg-card hover:border-primary-line'
                      )}
                    >
                      <span className="block text-xl font-semibold leading-none num">{option.value}</span>
                      <span className="label mt-1.5 block text-muted-foreground">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  ))}
                </motion.div>
                <motion.div variants={v(listItem)} transition={t()}>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => {
                      if (!speak('Hello, and welcome to LexiLearn.')) {
                        toast.error('Pronunciation is unavailable in this browser.')
                      }
                    }}
                  >
                    <Volume2 className="h-4 w-4" />
                    Test the pronunciation voice
                  </Button>
                </motion.div>
                <motion.div variants={v(listItem)} transition={t()}>
                  <Button ref={primaryRef} size="lg" className="mt-3 w-full" onClick={() => void finish()}>
                    Start learning
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
