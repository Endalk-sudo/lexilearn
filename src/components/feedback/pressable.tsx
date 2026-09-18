'use client'

import { motion } from 'framer-motion'
import { useCallback, useRef, type ReactNode, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { useHaptics } from '@/lib/feel'
import { press } from '@/lib/motion'

/**
 * Tappable surface with ripple + haptic feedback.
 *
 * This is a real <button>, so Enter/Space work for free (the previous version
 * was a clickable <div> and was unreachable by keyboard).
 */
export function Pressable({
  children,
  onTap,
  className,
  haptic = 'light',
  disabled,
  ariaLabel,
  type = 'button',
}: {
  children: ReactNode
  onTap?: (e: MouseEvent<HTMLButtonElement>) => void
  className?: string
  haptic?: 'light' | 'medium' | 'success' | 'error' | false
  disabled?: boolean
  ariaLabel?: string
  type?: 'button' | 'submit'
}) {
  const tick = useHaptics()
  const ref = useRef<HTMLButtonElement>(null)

  const handle = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return
      // Ripple - pointer input only, so keyboard activation does not spawn one in a corner.
      if (e.detail > 0) {
        const el = ref.current
        if (el) {
          const rect = el.getBoundingClientRect()
          const size = Math.max(rect.width, rect.height)
          const ripple = document.createElement('span')
          ripple.className = 'pressable-ripple'
          ripple.style.width = ripple.style.height = `${size}px`
          ripple.style.left = `${e.clientX - rect.left - size / 2}px`
          ripple.style.top = `${e.clientY - rect.top - size / 2}px`
          el.appendChild(ripple)
          window.setTimeout(() => ripple.remove(), 480)
        }
      }
      if (haptic !== false) tick(haptic)
      onTap?.(e)
    },
    [disabled, haptic, onTap, tick]
  )

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={handle}
      disabled={disabled}
      aria-label={ariaLabel}
      whileTap={disabled ? undefined : press}
      className={cn(
        'pressable-wrap relative overflow-hidden text-left select-none',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {children}
    </motion.button>
  )
}
