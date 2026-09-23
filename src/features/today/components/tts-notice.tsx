'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { isSpeechSupported } from '@/lib/tts'
import { useAppStore } from '@/lib/store'

const DISMISSED_KEY = 'lexilearn-tts-notice-dismissed'

/**
 * Only appears when pronunciation genuinely cannot work, so it never nags
 * people whose browser is fine.
 */
export function TtsNotice() {
  const [visible, setVisible] = useState(false)
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch {
      return
    }
    if (typeof window === 'undefined') return
    const unsupported = !isSpeechSupported()
    // All state updates happen inside the timeout callback so the effect body
    // never sets state synchronously (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      if (unsupported) {
        setVisible(true)
        return
      }
      if (window.speechSynthesis?.getVoices().length === 0) setVisible(true)
    }, unsupported ? 0 : 2000)
    const onVoices = () => {
      if (window.speechSynthesis.getVoices().length > 0) setVisible(false)
    }
    window.speechSynthesis?.addEventListener?.('voiceschanged', onVoices)
    return () => {
      window.clearTimeout(id)
      window.speechSynthesis?.removeEventListener?.('voiceschanged', onVoices)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="surface flex items-start gap-3 border-warning/30 bg-warning-soft p-3.5"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-warning">Pronunciation audio is unavailable</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Your browser did not provide a speech voice, so listening exercises are skipped. Firefox usually
          ships with voices. You can pick a voice in{' '}
          <button
            type="button"
            onClick={() => navigate('progress', { progressTab: 'settings' })}
            className="font-medium text-primary underline underline-offset-2"
          >
            Settings
          </button>
          . Everything else works normally.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss pronunciation notice"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED_KEY, 'true')
          } catch {
            /* storage unavailable */
          }
          setVisible(false)
        }}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
