'use client'

/**
 * Dictation audio — engine-agnostic playback for "hear it, type it".
 *
 * Today the only provider is the browser's speech synthesis (the same voice
 * the rest of the app uses). The provider interface means a server-side TTS
 * voice can drop in later without touching the dictation page.
 */

import { useEffect, useState } from 'react'
import { getEnglishVoices, isSpeechSupported, speak, stopSpeaking } from '@/lib/tts'

export type DictationPreset = 'slow' | 'normal'

/** Slow enough to catch every syllable, fast enough to sound natural. */
export const PRESET_RATES: Record<DictationPreset, number> = { slow: 0.7, normal: 1.0 }

export type AudioProbe =
  | { ok: true; voices: number; voiceName: string | null }
  | { ok: false; reason: 'unsupported' | 'no-voices' }

/**
 * Is there actually a voice to dictate with? Browsers (especially on Linux)
 * can report `speechSynthesis` with zero English voices, so a dictation page
 * must check before it promises anything.
 */
export async function probeDictationAudio(timeoutMs = 2500): Promise<AudioProbe> {
  if (typeof window === 'undefined' || !isSpeechSupported()) {
    return { ok: false, reason: 'unsupported' }
  }
  const first = getEnglishVoices()
  if (first.length > 0) {
    return { ok: true, voices: first.length, voiceName: first[0]?.name ?? null }
  }
  // Voices often arrive a beat after load — wait for the event once, then decide.
  await new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        window.clearTimeout(timer)
        resolve()
      }
    }
    const timer = window.setTimeout(finish, timeoutMs)
    const handler = () => finish()
    try {
      window.speechSynthesis?.addEventListener?.('voiceschanged', handler, { once: true })
      window.setTimeout(
        () => window.speechSynthesis?.removeEventListener?.('voiceschanged', handler),
        timeoutMs + 60
      )
    } catch {
      finish()
    }
  })
  const after = getEnglishVoices()
  if (after.length > 0) {
    return { ok: true, voices: after.length, voiceName: after[0]?.name ?? null }
  }
  return { ok: false, reason: 'no-voices' }
}

export interface DictationPlayer {
  readonly speaking: boolean
  play(text: string, opts?: { preset?: DictationPreset; rate?: number; voice?: string }): Promise<void>
  stop(): void
}

/**
 * Promise-based playback with an `onend` watchdog: if the browser never fires
 * the end event, the UI still un-wedges after an estimated duration.
 */
export function createDictationPlayer(): DictationPlayer {
  let speaking = false
  let finished = true
  let finishTimer: number | null = null
  let resolveCurrent: (() => void) | null = null

  const settle = () => {
    if (finished) return
    finished = true
    speaking = false
    if (finishTimer !== null) {
      window.clearTimeout(finishTimer)
      finishTimer = null
    }
    const resolve = resolveCurrent
    resolveCurrent = null
    resolve?.()
  }

  return {
    get speaking() {
      return speaking
    },
    play(text, opts = {}) {
      const rate = opts.rate ?? PRESET_RATES[opts.preset ?? 'normal'] ?? 1
      try {
        stopSpeaking()
      } catch {
        /* audio unavailable — settle below */
      }
      settle()
      finished = false
      speaking = true
      return new Promise<void>((resolve, reject) => {
        resolveCurrent = resolve
        let started = false
        try {
          started = speak(text, { rate, voice: opts.voice, onEnd: () => settle() })
        } catch {
          started = false
        }
        if (!started) {
          settle()
          reject(new Error('audio-unavailable'))
          return
        }
        const words = Math.max(1, text.trim().split(/\s+/).length)
        const estimateMs = (words * 480) / Math.max(0.5, rate) + 2500
        finishTimer = window.setTimeout(() => settle(), Math.min(30000, estimateMs))
      })
    },
    stop() {
      try {
        stopSpeaking()
      } catch {
        /* noop */
      }
      settle()
    },
  }
}

/** Probe once while the start screen is visible — never blocks rendering. */
export function useAudioReadiness(active: boolean) {
  const [state, setState] = useState<{ status: 'probing' | 'ready' | 'unavailable'; probe?: AudioProbe }>({
    status: 'probing',
  })

  useEffect(() => {
    if (!active) return
    let live = true
    void probeDictationAudio().then((probe) => {
      if (live) setState({ status: probe.ok ? 'ready' : 'unavailable', probe })
    })
    return () => {
      live = false
    }
  }, [active])

  return state
}
