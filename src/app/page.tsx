'use client'

import { Sidebar, MobileNav } from '@/components/sidebar'
import { DashboardView } from '@/components/views/dashboard'
import { LearnView } from '@/components/views/learn'
import { ReviewView } from '@/components/views/review'
import { QuizView } from '@/components/views/quiz'
import { DecksView, DeckDetailView } from '@/components/views/decks'
import { StatsView } from '@/components/views/stats'
import { SettingsView } from '@/components/views/settings'
import { SearchView } from '@/components/views/search'
import { MentorView } from '@/components/views/mentor'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAppStore } from '@/lib/store'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  learn: 'Learn New Words',
  review: 'Review Session',
  quiz: 'Quiz',
  mentor: 'AI Mentor',
  decks: 'Word Decks',
  'deck-detail': 'Deck Detail',
  stats: 'Statistics',
  settings: 'Settings',
  search: 'Dictionary Search',
}

function ViewContainer({ view }: { view: string }) {
  switch (view) {
    case 'dashboard': return <DashboardView />
    case 'learn': return <LearnView />
    case 'review': return <ReviewView />
    case 'quiz': return <QuizView />
    case 'mentor': return <MentorView />
    case 'decks': return <DecksView />
    case 'deck-detail': return <DeckDetailView />
    case 'custom-deck': return <DecksView />
    case 'stats': return <StatsView />
    case 'settings': return <SettingsView />
    case 'search': return <SearchView />
    default: return <DashboardView />
  }
}

export default function Home() {
  const view = useAppStore((s) => s.view)
  const prevView = useRef(view)

  // Scroll to top on view change
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [view])

  // Update page title
  useEffect(() => {
    const title = VIEW_TITLES[view]
    if (title) document.title = `${title} — LexiLearn`
    prevView.current = view
  }, [view])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-8">
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            L
          </div>
          <span className="font-semibold">LexiLearn</span>
        </div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary key={`eb-${view}`}>
                <ViewContainer view={view} />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
