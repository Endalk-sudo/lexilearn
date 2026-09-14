'use client'

type SpeakOpts = {
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
  onEnd?: () => void
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return []
  return window.speechSynthesis.getVoices()
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return getAvailableVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
}

let voicesReady = false
let voiceInitAttempted = false

function tryInitVoices(): void {
  if (voiceInitAttempted) return
  voiceInitAttempted = true
  if (!isSpeechSupported()) return
  const v = window.speechSynthesis.getVoices()
  if (v.length > 0) {
    voicesReady = true
  }
}

if (typeof window !== 'undefined') {
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
    voicesReady = true
  })
  tryInitVoices()
  if (!voicesReady) {
    setTimeout(tryInitVoices, 500)
  }
}

function buildUtterance(text: string, opts: SpeakOpts): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = opts.rate ?? 1
  utterance.pitch = opts.pitch ?? 1
  utterance.volume = opts.volume ?? 1

  if (voicesReady) {
    const all = window.speechSynthesis.getVoices()
    if (opts.voice) {
      const match = all.find((v) => v.name === opts.voice)
      if (match) {
        utterance.voice = match
        utterance.lang = match.lang
      }
    }
    if (!utterance.voice) {
      const enVoice = all.find((v) => v.lang.toLowerCase().startsWith('en'))
      if (enVoice) {
        utterance.voice = enVoice
        utterance.lang = enVoice.lang
      }
    }
  }

  utterance.onerror = (e) => {
    console.warn('[LexiLearn TTS] speak() error:', e)
  }
  if (opts.onEnd) {
    utterance.onend = opts.onEnd
  }

  return utterance
}

export function speak(text: string, opts: SpeakOpts = {}): boolean {
  if (!isSpeechSupported()) {
    console.warn('[LexiLearn TTS] SpeechSynthesis API not found.')
    return false
  }

  const utterance = buildUtterance(text, opts)

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance)
    }, 50)
    return true
  }

  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
