'use client'

import { useEffect, useRef } from 'react'
import { isMac } from '@/features/coach/lib/keys'

export type ShortcutModifier = 'ctrl' | 'meta' | 'alt' | 'shift' | 'mod' // 'mod' means meta on Mac, ctrl on others

export interface ShortcutDefinition {
  key: string // e.g. 'Enter', ' ', 'r', 'k', '?'
  modifiers?: ShortcutModifier[]
  allowInInput?: boolean // true if this shortcut should fire even when an input or textarea is focused
  description: string
  action: (event: KeyboardEvent) => void
}

/** Check if active element is an input, textarea, or contentEditable element */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as { tagName?: string; isContentEditable?: boolean }
  const tag = el.tagName?.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable
}

/**
 * Normalizes keyboard event matching against ShortcutDefinition
 */
export function matchesShortcut(e: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const mac = isMac()
  const keyLower = shortcut.key.toLowerCase()
  const eventKeyLower = e.key.toLowerCase()

  // Match key: special casing for Space
  const keyMatches =
    shortcut.key === ' '
      ? e.key === ' ' || e.code === 'Space'
      : eventKeyLower === keyLower || e.code.toLowerCase() === `key${keyLower}`

  if (!keyMatches) return false

  const modifiers = shortcut.modifiers ?? []
  const needCtrl = modifiers.includes('ctrl') || (modifiers.includes('mod') && !mac)
  const needMeta = modifiers.includes('meta') || (modifiers.includes('mod') && mac)
  const needAlt = modifiers.includes('alt')
  const needShift = modifiers.includes('shift')

  if (needCtrl !== e.ctrlKey) return false
  if (needMeta !== e.metaKey) return false
  if (needAlt !== e.altKey) return false
  if (needShift !== e.shiftKey) return false

  return true
}

/**
 * Hook to bind multiple keyboard shortcuts to the window.
 */
export function useShortcuts(shortcuts: ShortcutDefinition[], enabled = true) {
  const shortcutsRef = useRef(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = isTypingTarget(e.target)

      for (const sc of shortcutsRef.current) {
        if (isTyping && !sc.allowInInput) {
          continue
        }

        if (matchesShortcut(e, sc)) {
          e.preventDefault()
          e.stopPropagation()
          sc.action(e)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [enabled])
}
