'use client'

/**
 * Small platform helper for keyboard-shortcut labels.
 * The app must never lie about the modifier key, so every displayed
 * shortcut asks the platform first instead of assuming Cmd.
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const source = navigator.platform ?? navigator.userAgent ?? ''
  return /mac|iphone|ipad|ipod/i.test(source)
}
