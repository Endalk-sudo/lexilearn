'use client'

import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, BrainCircuit, ListChecks, Sparkles, ArrowRight } from 'lucide-react'

const STEPS = [
  { icon: BookOpen, label: 'Learn new words', view: 'learn' as const, desc: 'Start with recall and spelling' },
  { icon: BrainCircuit, label: 'Review due cards', view: 'review' as const, desc: 'Solidify your memory' },
  { icon: ListChecks, label: 'Take a quiz', view: 'quiz' as const, desc: 'Test your knowledge' },
]

export function QuickStartCard() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Quick Start</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.view}>
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col items-center gap-2 py-4"
                  onClick={() => navigate(step.view)}
                >
                  <div className="rounded-full bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-xs">{step.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</div>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
