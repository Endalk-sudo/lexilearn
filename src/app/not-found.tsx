import Link from 'next/link'
import { Compass, Library, BrainCircuit } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="mx-auto w-full max-w-md text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
          aria-hidden="true"
        >
          <Compass className="h-6 w-6" />
        </div>
        <p className="label mt-4 text-primary">404</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">That page does not exist</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The link may be old or mistyped. Your words and progress are safe — nothing here touches your data.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href="/#/today"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/92"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            Go to Today
          </Link>
          <Link
            href="/#/review"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-sm font-medium shadow-xs transition-colors hover:border-primary-line"
          >
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            Review due cards
          </Link>
          <Link
            href="/#/library"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-6 text-sm font-medium shadow-xs transition-colors hover:border-primary-line"
          >
            <Library className="h-4 w-4" aria-hidden="true" />
            Library
          </Link>
        </div>
      </div>
    </main>
  )
}
