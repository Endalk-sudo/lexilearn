'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { isMac } from '@/features/coach/lib/keys'
import { Keyboard, Sparkles } from 'lucide-react'

interface ShortcutGroup {
  category: string
  items: {
    keys: string[]
    description: string
    note?: string
  }[]
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mac = typeof window !== 'undefined' ? isMac() : false
  const modKey = mac ? '⌘' : 'Ctrl'
  const altKey = mac ? '⌥' : 'Alt'

  const GROUPS: ShortcutGroup[] = [
    {
      category: 'Global & Navigation',
      items: [
        { keys: ['?'], description: 'Show keyboard shortcuts' },
        { keys: [modKey, 'K'], description: 'Open search palette' },
        { keys: ['['], description: 'Toggle navigation sidebar' },
        { keys: ['m'], description: 'Toggle sound mute' },
        { keys: ['g', 'then', 't'], description: 'Go to Today (Dashboard)' },
        { keys: ['g', 'then', 'r'], description: 'Go to Review (SRS)' },
        { keys: ['g', 'then', 'l'], description: 'Go to Learn' },
        { keys: ['g', 'then', 'd'], description: 'Go to Dictation' },
        { keys: ['g', 'then', 'v'], description: 'Go to Study deck' },
        { keys: ['g', 'then', 'b'], description: 'Go to Library' },
        { keys: ['g', 'then', 'p'], description: 'Go to Progress' },
        { keys: ['g', 'then', 'c'], description: 'Go to AI Coach' },
        { keys: ['f'], description: 'Toggle focus mode (Learn / Review / Progress)' },
      ],
    },
    {
      category: 'Today Dashboard',
      items: [
        { keys: ['Space', 'or', 'Enter'], description: 'Start the daily mission' },
        { keys: ['r'], description: 'Resume the last study session' },
      ],
    },
    {
      category: 'AI Coach & Mentor',
      items: [
        { keys: ['h'], description: 'Request a hint (while answering)' },
        { keys: ['r'], description: 'Next challenge, after a question is answered' },
        { keys: [modKey, 'Enter'], description: 'Submit your coach answer', note: 'in the AI Coach text box' },
      ],
    },
    {
      category: 'Review (SRS Flashcards)',
      items: [
        { keys: ['Space', 'or', 'Enter'], description: 'Reveal card / Quick "Good" grade' },
        { keys: ['1'], description: 'Grade: Again (Failed recall)' },
        { keys: ['2'], description: 'Grade: Hard (Tough recall)' },
        { keys: ['3'], description: 'Grade: Good (Clean recall)' },
        { keys: ['4'], description: 'Grade: Easy (Instant recall)' },
        { keys: ['r'], description: 'Replay audio (normal speed)' },
        { keys: ['s'], description: 'Replay audio (slow speed)' },
        { keys: [modKey, 'Z'], description: 'Undo last review' },
      ],
    },
    {
      category: 'Learn Mode',
      items: [
        { keys: ['Space', 'or', 'Enter'], description: '1st hit: Reveal meaning → 2nd hit: Start spelling → 3rd hit: Next word' },
        { keys: ['r'], description: 'Replay audio in Recall or Meaning stage' },
        { keys: [altKey, 'R'], description: 'Replay audio while typing spelling', note: `or Ctrl+Space` },
        { keys: [altKey, 'H'], description: 'Get a hint while spelling', note: `or Ctrl+H` },
        { keys: ['Enter'], description: 'Submit spelling / Advance' },
      ],
    },
    {
      category: 'Dictation Mode',
      items: [
        { keys: [altKey, 'R'], description: 'Replay audio while typing', note: `or Ctrl+Space` },
        { keys: [altKey, 'S'], description: 'Replay slow audio while typing', note: 'or Ctrl+Shift+Space' },
        { keys: [altKey, 'H'], description: 'Show hint / give up', note: `or Ctrl+H` },
        { keys: ['Enter'], description: 'Submit what you typed' },
        { keys: ['Space', 'or', 'Enter'], description: 'Advance to next dictation item' },
        { keys: ['r', 'or', 's'], description: 'Replay / replay slow (between items, not typing)' },
        { keys: ['1', '–', '4'], description: 'Select dictation difficulty rung' },
      ],
    },
    {
      category: 'Session Complete & Library',
      items: [
        { keys: ['Enter', 'or', 'Space'], description: 'Continue to next step on completion screen' },
        { keys: ['r'], description: 'Study again from completion screen' },
        { keys: ['/'], description: 'Focus search input in Library / Dictionary' },
        { keys: ['Esc'], description: 'Clear search / close modals / exit focus mode or back out' },
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/80">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Keyboard className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Keyboard Navigation</span>
          </div>
          <DialogTitle className="text-xl">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Complete study sessions touch-free. Practice and navigate without reaching for the touchpad.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4 space-y-6">
          {GROUPS.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                {group.category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="surface-inset flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5 text-xs shadow-neu-inset-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">{item.description}</div>
                      {item.note ? (
                        <div className="text-[10px] text-muted-foreground truncate">{item.note}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k, kIdx) =>
                        k === 'then' || k === 'or' || k === '–' ? (
                          <span key={kIdx} className="text-[10px] text-muted-foreground/70 px-0.5">
                            {k}
                          </span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className="inline-flex min-w-5 h-5 items-center justify-center rounded-md border border-white/60 dark:border-white/10 bg-card px-1.5 font-mono text-[11px] font-semibold text-foreground shadow-neu-sm"
                          >
                            {k}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 bg-muted/20 px-6 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Press <kbd className="rounded-md border border-white/60 dark:border-white/10 bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground shadow-neu-sm">?</kbd> anywhere to open this guide.
          </span>
          <span className="text-[11px] font-medium">LexiLearn Touch-Free</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
