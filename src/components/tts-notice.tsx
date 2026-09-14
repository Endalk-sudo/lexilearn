'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Volume2, X } from 'lucide-react'
import { isSpeechSupported } from '@/lib/tts'
import { useAppStore } from '@/lib/store'

const DISMISSED_KEY = 'lexilearn-tts-notice-dismissed'

export function TtsNotice() {
  const [visible, setVisible] = useState(false)
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed) return
    if (!isSpeechSupported()) {
      setVisible(true)
      return
    }
    if (typeof window === 'undefined') return
    const check = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) {
        setVisible(true)
      }
    }
    const id = setTimeout(check, 2000)
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVisible(false)
      }
    })
    return () => clearTimeout(id)
  }, [])

  if (!visible) return null

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
      <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-2 shrink-0 mt-0.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Pronunciation audio unavailable
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
          This browser doesn&apos;t support text-to-speech on Linux. Use <strong>Firefox</strong> for built-in voices, or visit{' '}
          <button
            onClick={() => navigate('settings')}
            className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-100"
          >
            Settings
          </button>{' '}
          for diagnostic info.
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, 'true')
          setVisible(false)
        }}
        className="rounded-md p-1 hover:bg-amber-200/50 dark:hover:bg-amber-800/50 shrink-0"
      >
        <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </button>
    </div>
  )
}
