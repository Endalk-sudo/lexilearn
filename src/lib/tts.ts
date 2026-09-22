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

/**
 * Resolve the voice to speak with: the user's choice if it still exists, then
 * any English voice, otherwise nothing (the caller falls back to an `en-US`
 * hint so a browser with only a default voice still reads English as English).
 *
 * This used to sit behind a module-level "voices ready" flag, which was set by
 * a single retry plus a `voiceschanged` listener. Browsers that populate voices
 * late *and* never fire that event (seen on some Linux/Chrome builds) stayed
 * flagged as not-ready for the whole session, so speech fell back to the system
 * default language. Looking up voices on every utterance removes that trap:
 * `getVoices()` is synchronous and cheap.
 */
function resolveVoice(preferred?: string): SpeechSynthesisVoice | null {
  let all: SpeechSynthesisVoice[] = []
  try {
    all = window.speechSynthesis.getVoices()
  } catch {
    return null
  }
  if (preferred) {
    const match = all.find((v) => v.name === preferred)
    if (match) return match
  }
  return all.find((v) => v.lang.toLowerCase().startsWith('en')) ?? null
}

function buildUtterance(text: string, opts: SpeakOpts): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = opts.rate ?? 1
  utterance.pitch = opts.pitch ?? 1
  utterance.volume = opts.volume ?? 1

  const voice = resolveVoice(opts.voice)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'en-US'
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
