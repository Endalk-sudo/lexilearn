'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Local-first app: nothing left the device, so there is nothing to clean up.
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="surface mx-auto w-full max-w-md p-6 text-center sm:p-7">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive" aria-hidden="true">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">The app hit an unexpected error</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your words, decks and progress are stored locally and untouched. Try again — if it keeps happening,
          a reload usually clears it.
        </p>
        {error.message ? (
          <p className="mt-3 rounded-md bg-muted/60 p-2.5 text-left font-mono text-xs leading-relaxed text-muted-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/92"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-sm font-medium shadow-xs transition-colors hover:border-primary-line"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reload the app
          </button>
        </div>
      </div>
    </main>
  )
}
