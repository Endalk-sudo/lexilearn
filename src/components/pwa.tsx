'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/**
 * Registers the service worker (production only - in dev a stale SW would
 * serve cached chunks and break hot reload) and shows one honest line when
 * the device is offline: the data is local, everything except AI generation
 * keeps working.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration is best-effort; the app works without it */
      })
    }, 1200)
    return () => window.clearTimeout(id)
  }, [])
  return null
}

function readOnline() {
  return navigator.onLine
}

/**
 * One reassurance line, shown only when actually offline. It replaces the
 * bare "Offline" dot with the answer the user actually cares about:
 * is my data safe, and what still works?
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, readOnline, () => true)
  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-1.5 text-center text-xs font-medium text-foreground"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
      Offline — your words and streak are safe on this device. Everything except AI generation still works.
    </div>
  )
}
