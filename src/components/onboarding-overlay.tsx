'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { BookOpen, BrainCircuit, ListChecks, Sparkles } from 'lucide-react'

const ONBOARDING_KEY = 'lexilearn-onboarding-dismissed'

export function OnboardingOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_KEY)
    if (!dismissed) {
      const t = setTimeout(() => setOpen(true), 400)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">
            L
          </div>
          <h2 className="text-xl font-bold tracking-tight">Welcome to LexiLearn</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            A private, offline-first vocabulary app using <strong>spaced repetition</strong> to help you remember words long-term.
          </p>
        </div>

        <div className="space-y-3 my-6">
          <Step icon={BookOpen} color="text-emerald-500" title="Learn" description="Discover new words with recall prompts and spelling practice." />
          <Step icon={BrainCircuit} color="text-orange-500" title="Review" description="SM-2 algorithm schedules reviews at optimal intervals." />
          <Step icon={ListChecks} color="text-sky-500" title="Quiz" description="Test yourself with 5 modes: multiple choice, typing, speed round & more." />
        </div>

        <p className="text-xs text-muted-foreground text-center mb-4">
          All data is stored locally in SQLite. Never uploaded. Always yours.
        </p>

        <Button onClick={dismiss} className="w-full" size="lg">
          <Sparkles className="h-4 w-4 mr-2" /> Get started
        </Button>
      </div>
    </div>
  )
}

function Step({ icon: Icon, color, title, description }: { icon: React.ElementType; color: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`rounded-lg bg-muted p-2 mt-0.5 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}
