'use client'

import { motion } from 'framer-motion'

export function Checkmark({ size = 64, tone = 'success' }: { size?: number; tone?: 'success' | 'error' }) {
  const color = tone === 'success' ? 'stroke-success' : 'stroke-destructive'
  const bg = tone === 'success' ? 'bg-success-soft' : 'bg-destructive-soft'
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 16 }}
      className={`flex items-center justify-center rounded-3xl ${bg}`}
      style={{ width: size + 24, height: size + 24 }}
    >
      <svg width={size} height={size} viewBox="0 0 52 52">
        <motion.circle cx="26" cy="26" r="24" fill="none" className={color} strokeWidth={3}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
        {tone === 'success' ? (
          <motion.path fill="none" className={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            d="M14 27l8 8 16-16"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.25 }} />
        ) : (
          <motion.path fill="none" className={color} strokeWidth={4} strokeLinecap="round"
            d="M18 18l16 16M34 18L18 34"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.2 }} />
        )}
      </svg>
    </motion.div>
  )
}
