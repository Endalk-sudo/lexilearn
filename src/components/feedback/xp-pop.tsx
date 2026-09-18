'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type XpPopItem = { id: number; amount: number; x: number; y: number }

let popId = 0

const CHIP_W = 76
const CHIP_H = 34

/**
 * XP feedback anchored at the point of interaction (previously it always floated
 * in the top-right corner, disconnected from the action that earned it).
 */
export function useXpPops() {
  const [pops, setPops] = useState<XpPopItem[]>([])

  const pop = (amount: number, x?: number, y?: number) => {
    if (!amount) return
    const id = ++popId
    const maxX = typeof window !== 'undefined' ? window.innerWidth - CHIP_W - 8 : 320
    const maxY = typeof window !== 'undefined' ? window.innerHeight - CHIP_H - 8 : 600
    const rawX = x ?? (typeof window !== 'undefined' ? window.innerWidth - CHIP_W - 24 : 280)
    const rawY = y ?? 96
    const px = Math.min(Math.max(8, rawX), Math.max(8, maxX))
    const py = Math.min(Math.max(8, rawY), Math.max(8, maxY))
    setPops((p) => [...p.slice(-3), { id, amount, x: px, y: py }])
    window.setTimeout(() => setPops((p) => p.filter((i) => i.id !== id)), 900)
  }

  return { pops, pop }
}

export function XpPopLayer({ pops }: { pops: XpPopItem[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" role="status" aria-live="polite">
      <AnimatePresence>
        {pops.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: -26, scale: 1 }}
            exit={{ opacity: 0, y: -36, scale: 0.96 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'absolute rounded-full border border-primary-line bg-card px-3 py-1',
              'text-xs font-semibold text-primary shadow-md num'
            )}
            style={{ left: p.x, top: p.y }}
          >
            +{p.amount} XP
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Fire an XP pop from a click event, clamped inside the viewport. */
export function popXpAt(
  amount: number,
  e?: { clientX: number; clientY: number },
  fallback?: (a: number, x: number, y: number) => void
) {
  if (!fallback) return
  if (e) fallback(amount, e.clientX - 24, e.clientY - 46)
  else if (typeof window !== 'undefined') fallback(amount, window.innerWidth - 110, 96)
}

/** Pop XP at the centre of the element that was tapped. */
export function popXpFromElement(
  amount: number,
  el: HTMLElement | null,
  fallback?: (a: number, x: number, y: number) => void
) {
  if (!fallback) return
  if (!el) {
    popXpAt(amount, undefined, fallback)
    return
  }
  const rect = el.getBoundingClientRect()
  fallback(amount, rect.left + rect.width / 2 - 38, rect.top - 10)
}
