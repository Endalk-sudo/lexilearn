'use client'

import { useCallback, useEffect, useRef } from 'react'

const SOUND_KEY = 'lexilearn-sound-enabled'
const HAPTIC_KEY = 'lexilearn-haptics-enabled'

export function isSoundEnabled() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  window.dispatchEvent(new CustomEvent('lexilearn-feel'))
}

export function isHapticsEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(HAPTIC_KEY) !== 'off'
}

export function setHapticsEnabled(on: boolean) {
  localStorage.setItem(HAPTIC_KEY, on ? 'on' : 'off')
  window.dispatchEvent(new CustomEvent('lexilearn-feel'))
}

function tone(freq: number, dur = 0.08, type: OscillatorType = 'sine', gain = 0.05, when = 0) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime + when)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(ctx.currentTime + when)
    o.stop(ctx.currentTime + when + dur + 0.02)
    window.setTimeout(() => ctx.close().catch(() => {}), 400)
  } catch { /* audio unavailable */ }
}

export function playSound(kind: 'tap' | 'correct' | 'wrong' | 'levelup' | 'xp' = 'tap') {
  if (!isSoundEnabled()) return
  if (typeof window === 'undefined') return
  switch (kind) {
    case 'correct': tone(660, 0.09, 'sine', 0.06); tone(880, 0.12, 'sine', 0.06, 0.08); break
    case 'wrong': tone(220, 0.14, 'sawtooth', 0.03); break
    case 'levelup': tone(523, 0.1, 'triangle', 0.07); tone(659, 0.1, 'triangle', 0.07, 0.1); tone(784, 0.16, 'triangle', 0.07, 0.2); break
    case 'xp': tone(980, 0.07, 'sine', 0.045); break
    default: tone(520, 0.05, 'sine', 0.03); break
  }
}

export function buzz(pattern: number | number[] | 'light' | 'medium' | 'success' | 'error' = 12) {
  if (!isHapticsEnabled()) return
  let p: number | number[]
  if (pattern === 'success') p = [12, 40, 18]
  else if (pattern === 'error') p = [30, 40, 30]
  else if (pattern === 'medium') p = 18
  else if (pattern === 'light') p = 10
  else p = pattern
  try { navigator.vibrate?.(p) } catch { /* noop */ }
}

export function useHaptics() {
  return useCallback((kind: 'light' | 'medium' | 'success' | 'error' = 'light') => {
    if (kind === 'success') buzz([12, 40, 18])
    else if (kind === 'error') buzz([30, 40, 30])
    else if (kind === 'medium') buzz(18)
    else buzz(10)
  }, [])
}

export function useSound() {
  return useCallback((kind: Parameters<typeof playSound>[0] = 'tap') => playSound(kind), [])
}

export function useFeelVersion() {
  const ref = useRef(0)
  useEffect(() => {
    const h = () => { ref.current += 1 }
    window.addEventListener('lexilearn-feel', h)
    return () => window.removeEventListener('lexilearn-feel', h)
  }, [])
  return ref
}

/* ---------------------------------------------------------------------------
 * Typing sounds - the "hook" layer.
 * A shared AudioContext (creating one per keystroke is too expensive), very
 * low gain, randomized pitch so rapid typing sounds organic instead of
 * machine-gun, and a minimum spacing so it never becomes noise.
 * ------------------------------------------------------------------------- */

let sharedCtx: AudioContext | null = null
let lastTypeAt = 0

function typeCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!sharedCtx) sharedCtx = new Ctx()
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {})
    return sharedCtx
  } catch { return null }
}

function blip(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  const c = typeCtx()
  if (!c) return
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    const t0 = c.currentTime
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start(t0)
    o.stop(t0 + dur + 0.01)
  } catch { /* audio unavailable */ }
}

/** Soft tick for a regular keystroke. Pitch wobbles ±60 cents around 560 Hz. */
export function playType() {
  if (!isSoundEnabled() || typeof window === 'undefined') return
  const now = performance.now()
  if (now - lastTypeAt < 30) return
  lastTypeAt = now
  const cents = (Math.random() - 0.5) * 120
  blip(560 * Math.pow(2, cents / 1200), 0.03, 0.016, 'sine')
}

 /** Lower "thock" for the space bar. */
export function playSpace() {
  if (!isSoundEnabled() || typeof window === 'undefined') return
  const now = performance.now()
  if (now - lastTypeAt < 30) return
  lastTypeAt = now
  blip(300, 0.045, 0.026, 'sine')
}

/** Quieter, slightly lower tick when deleting. */
export function playDelete() {
  if (!isSoundEnabled() || typeof window === 'undefined') return
  const now = performance.now()
  if (now - lastTypeAt < 30) return
  lastTypeAt = now
  blip(380, 0.03, 0.013, 'sine')
}

/** Quick upward chirp when a message/answer is sent. */
export function playSend() {
  if (!isSoundEnabled() || typeof window === 'undefined') return
  blip(480, 0.07, 0.035, 'sine', 720)
}

/**
 * Shared keydown classifier for text inputs: maps a keyboard event to the
 * right typing sound. Attach in onKeyDown of any free-text input.
 * Ignores modifiers, navigation and shortcut combos.
 */
export function typeFeelFromKey(e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'Backspace' || e.key === 'Delete') { playDelete(); return }
  if (e.key.length !== 1) return
  if (e.key === ' ') { playSpace(); return }
  playType()
}

