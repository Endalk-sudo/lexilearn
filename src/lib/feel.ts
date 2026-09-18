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
