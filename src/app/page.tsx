'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppSidebar, MobileTabs, MobileTopBar, ShellOverlays } from '@/components/app-shell'
import { TodayView } from '@/features/today/components/today'
import { LearnView } from '@/features/learn/components/learn'
import { ReviewView } from '@/features/review/components/review'
import { QuizView } from '@/features/quiz/components/quiz'
import { DictationView } from '@/features/dictation/components/dictation'
import { LibraryView, DeckDetailView } from '@/features/library/components/library'
import { ProgressView } from '@/features/progress/components/progress'
import { CoachView } from '@/features/coach/components/coach'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAppStore, VIEW_TITLES } from '@/lib/store'
import { useRouteSync } from '@/lib/router'
import { fadeUp, useMotionSafe } from '@/lib/motion'

function ViewContainer({ view }: { view: string }) {
  switch (view) {
    case 'learn':
      return <LearnView />
    case 'review':
      return <ReviewView />
    case 'quiz':
      return <QuizView />
    case 'dictation':
      return <DictationView deckId={useAppStore.getState().dictationDeckId} />
    case 'library':
      return <LibraryView />
    case 'library-deck':
      return <DeckDetailView />
    case 'progress':
      return <ProgressView />
    case 'coach':
      return <CoachView />
    case 'today':
    default:
      return <TodayView />
  }
}

export default function Home() {
  const view = useAppStore((s) => s.view)
  const deckId = useAppStore((s) => s.deckId)
  const { v, t } = useMotionSafe()

  useRouteSync()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view, deckId])

  useEffect(() => {
    document.title = `${VIEW_TITLES[view]} · LexiLearn`
  }, [view])

  return (
    <div className="relative flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-primary-line focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main id="main" tabIndex={-1} className="flex-1 pb-28 focus:outline-none md:pb-12">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${deckId ?? ''}`}
                variants={v(fadeUp)}
                initial="hidden"
                animate="show"
                exit="exit"
                transition={t()}
              >
                <ErrorBoundary key={`eb-${view}`}>
                  <ViewContainer view={view} />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <MobileTabs />
      <ShellOverlays />
    </div>
  )
}
