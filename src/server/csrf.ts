// Cross-site request forgery guard for the mutation endpoints.
//
// LexiLearn has no accounts and no cookies, so there is no ambient credential
// for an attacker to ride — but there IS an ambient one that matters here: the
// browser will happily send a POST from any page on the internet to
// http://localhost:3000/api/lexilearn. `action=reset` in particular would wipe
// the user's study history, and a `text/plain` body is a CORS "simple request"
// that triggers no preflight, so the browser sends it and the server runs it.
//
// Two headers close that without an allowlist:
//   - Sec-Fetch-Site: browsers set this on every fetch/XHR. `cross-site` means
//     the request came from a different site, full stop.
//   - Origin vs Host: a same-origin request has Origin whose host equals the
//     Host it was sent to. This holds for localhost, 127.0.0.1 and a LAN IP
//     alike, which is why no host list is needed.
//
// Non-browser clients (curl, the e2e runner, seed scripts) send neither header
// and are allowed through — the endpoint is local-only by design.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function assertSameOrigin(req: NextRequest): NextResponse | null {
  if (req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'cross-site request blocked' }, { status: 403 })
  }

  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host) {
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {
      originHost = ''
    }
    if (originHost !== host) {
      return NextResponse.json({ error: 'cross-site request blocked' }, { status: 403 })
    }
  }

  return null
}
