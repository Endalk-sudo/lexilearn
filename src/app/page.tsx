'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { AppSidebar, MobileTabs, MobileTopBar, ShellOverlays } from '@/components/app-shell'
import { LaptopTopNav } from '@/components/layout/laptop-top-nav'
import { TodayView } from '@/features/today/components/today'
import { LearnView } from '@/features/learn/components/learn'
import { ReviewView } from '@/features/review/components/review'
import { SessionSkeleton } from '@/components/feedback/session-skeleton'
import { ErrorBoundary } from '@/components/error-boundary'
import { useAppStore, VIEW_TITLES } from '@/lib/store'
import { useRouteSync } from '@/lib/router'
import { fadeUp, useMotionSafe } from '@/lib/motion'
import { api } from '@/lib/api'

// Today / Learn / Review stay eager: they are the first paint and the two
// hottest session paths. Everything else splits off — previously the first
// paint downloaded and parsed recharts, dnd-kit, canvas-confetti, the whole
// coach lab and the dictation engine even for a user who only opens Today.
const QuizView = dynamic(
  () => import('@/features/quiz/components/quiz').then((m) => m.QuizView),
  { loading: () => <SessionSkeleton /> },
)
const DictationView = dynamic(
  () => import('@/features/dictation/components/dictation').then((m) => m.DictationView),
  // The component takes a deckId prop; dynamic() forwards props through.
  { loading: () => <SessionSkeleton /> },
)
const LibraryViews = dynamic(
  () => import('@/features/library/components/library').then((m) => ({
    default: ({ view }: { view: string }) =>
      view === 'library-deck' ? <m.DeckDetailView /> : <m.LibraryView />,
  })),
  { loading: () => <SessionSkeleton /> },
)
const ProgressView = dynamic(
  () => import('@/features/progress/components/progress').then((m) => m.ProgressView),
  { loading: () => <SessionSkeleton /> },
)
const CoachView = dynamic(
  () => import('@/features/coach/components/coach').then((m) => m.CoachView),
  { loading: () => <SessionSkeleton /> },
)

function ViewContainer({ view }: { view: string }) {
  const dictationDeckId = useAppStore((s) => s.dictationDeckId)
  switch (view) {
    case 'learn':
      return <LearnView />
    case 'review':
      return <ReviewView />
    case 'quiz':
      return <QuizView />
    case 'dictation':
      return <DictationView deckId={dictationDeckId} />
    case 'library':
    case 'library-deck':
      return <LibraryViews view={view} />
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

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s && typeof s.autoSpeak === 'boolean') {
        useAppStore.getState().setAutoSpeak(s.autoSpeak)
      }
    }).catch(() => {})
  }, [])

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
        <LaptopTopNav />
        <main id="main" tabIndex={-1} className="flex-1 pb-28 focus:outline-none md:pb-12">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {/* sync, not wait: the old view must not hold the new one hostage
                for a full exit animation on every tab switch. */}
            <AnimatePresence mode="sync">
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
