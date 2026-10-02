/* LexiLearn service worker - hand-rolled, no dependencies.
 *
 * Strategy:
 *  - App shell (navigations): network-first, cache fallback -> the app always
 *    opens, even when the local server is unreachable.
 *  - /_next/static (immutable hashed assets): cache-first.
 *  - /api/lexilearn GETs: network-first with cached fallback, but ONLY for an
 *    allowlist of slowly-changing reads (decks, deck pages, dashboard,
 *    categories, settings). Quiz draws, due queues, search results and mentor
 *    traffic must never be served stale — replaying yesterday's due queue
 *    offline would silently rewind progress. Entries carry a 5-minute TTL and
 *    the cache is capped (LRU-ish) so every deck page and search keystroke
 *    cannot grow it without bound.
 */

const VERSION = 'lexilearn-v3'
const SHELL_CACHE = `${VERSION}-shell`
const STATIC_CACHE = `${VERSION}-static`
const API_CACHE = `${VERSION}-api`

const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/logo.png', '/apple-touch-icon.png', '/icon.svg', '/favicon.ico']

// Actions safe to replay briefly offline. Everything else (quiz, reviewable,
// due, new, search, analytics, mentor*, claimChallenge, ...) passes through
// and fails honestly offline instead of lying with stale data.
const CACHEABLE_ACTIONS = new Set(['decks', 'deck', 'dashboard', 'categories', 'settings'])
const API_TTL_MS = 5 * 60 * 1000
const API_MAX_ENTRIES = 60

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

/** Invalidate stale API caches when a new version activates. */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
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
          // Only successful responses become the offline shell — a transient
          // 500 must never be cached as the fallback people see offline (N9).
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => {})
          }
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
            // Cache-first means a cached entry sticks until VERSION changes, so
            // never store an error response (N9).
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {})
            }
            return res
          })
      )
    )
    return
  }

  // 3. Allowlisted API reads: network-first, TTL-bound cached fallback.
  if (url.pathname === '/api/lexilearn') {
    const action = url.searchParams.get('action')
    if (!action || !CACHEABLE_ACTIONS.has(action)) return // pass through untouched
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(API_CACHE).then(async (c) => {
              try {
                // Stamp the write time: TTL is enforced on read, and the cap
                // keeps every paged/filtered URL from growing the cache forever.
                const body = await copy.arrayBuffer()
                const headers = new Headers(res.headers)
                headers.set('x-lexilearn-cached-at', String(Date.now()))
                await c.put(req, new Response(body, { status: res.status, headers }))
                const keys = await c.keys()
                if (keys.length > API_MAX_ENTRIES) {
                  await Promise.all(keys.slice(0, keys.length - API_MAX_ENTRIES).map((k) => c.delete(k)))
                }
              } catch { /* cache is best-effort */ }
            }).catch(() => {})
          }
          return res
        })
        .catch(async () => {
          const hit = await caches.match(req)
          if (hit) {
            const cachedAt = Number(hit.headers.get('x-lexilearn-cached-at') || 0)
            if (Date.now() - cachedAt < API_TTL_MS) return hit
          }
          return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
        })
    )
  }
  // Everything else passes through untouched.
})
