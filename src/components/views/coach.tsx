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
 * analytics lab for people who want the numbers. Each sub-view owns its
 * own page header, so exactly one <h1> is on screen at a time.
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
      className="space-y-5"
    >
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
