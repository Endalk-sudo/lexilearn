/* LexiLearn service worker - hand-rolled, no dependencies.
 *
 * Strategy:
 *  - App shell (navigations): network-first, cache fallback -> the app always
 *    opens, even when the local server is unreachable.
 *  - /_next/static (immutable hashed assets): cache-first.
 *  - /api/lexilearn GETs (dashboard, decks, overview...): network-first with
 *    cached fallback -> learning and reviewing keep working offline; only AI
 *    generation needs the local Ollama process.
 */

const VERSION = 'lexilearn-v1'
const SHELL_CACHE = `${VERSION}-shell`
const STATIC_CACHE = `${VERSION}-static`
const API_CACHE = `${VERSION}-api`

const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/logo.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort: one bad icon must never break the offline shell.
      Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 1. Navigations: network-first, fall back to the cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => {})
          return res
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/')) || Response.error())
    )
    return
  }

  // 2. Immutable build assets: cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/logo.png' || url.pathname === '/apple-touch-icon.png') {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          })
      )
    )
    return
  }

  // 3. Read-only API data: network-first, cached fallback + background refresh.
  if (url.pathname === '/api/lexilearn') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(async () => (await caches.match(req)) || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    )
  }
  // Everything else passes through untouched.
})
