'use client'

import { motion } from 'framer-motion'
import { FlaskConical, Sparkles } from 'lucide-react'
import { SegmentedControl } from '@/components/layout/segmented-control'
import { MentorView } from '@/components/views/mentor'
import { CoachLabView } from '@/components/views/coach-lab'
import { useAppStore } from '@/lib/store'
import { fadeUp, useMotionSafe } from '@/lib/motion'

/**
 * One AI Coach destination with two depths: every-day practice, and the
 * analytics lab for people who want the numbers. The sub-views own their own
 * headings, so nothing is announced twice.
 */
export function CoachView() {
  const tab = useAppStore((s) => s.coachTab)
  const setTab = useAppStore((s) => s.setCoachTab)
  const { v, t } = useMotionSafe()

  return (
    <motion.div
      variants={v(fadeUp)}
      initial="hidden"
      animate="show"
      transition={t()}
      className="mx-auto max-w-4xl space-y-5"
    >
      <div>
        <div className="label text-primary">AI Coach</div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Mentor</h1>
      </div>
      <SegmentedControl
        ariaLabel="Coach sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'coach', label: 'Mentor', icon: Sparkles },
          { value: 'lab', label: 'Insights', icon: FlaskConical },
        ]}
      />
      {tab === 'coach' ? <MentorView /> : <CoachLabView />}
    </motion.div>
  )
}
